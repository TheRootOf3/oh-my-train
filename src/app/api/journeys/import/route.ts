import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import { cleanJourney, isValidDateKey, type Status } from "@/lib/journeys";

export const dynamic = "force-dynamic";

const MAX_IMPORT = 5000;
const CHUNK = 500;

/**
 * POST /api/journeys/import
 * Accepts the old static site's export shape: { "YYYY-MM-DD": [{status, label?, mins?}, …], … }
 * Your historical suffering deserves to be preserved.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an object of date keys" }, { status: 400 });
  }

  const rows: {
    userId: string;
    travelDate: string;
    status: Status;
    depTime?: string;
    origin?: string;
    destination?: string;
    label?: string;
    mins?: number;
  }[] = [];
  let skipped = 0;

  for (const [dateKey, list] of Object.entries(body as Record<string, unknown>)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(list)) {
      skipped += Array.isArray(list) ? list.length : 1;
      continue;
    }
    for (const raw of list) {
      // lenient: static-era delayed entries without minutes are grudgingly accepted
      const j = cleanJourney(raw);
      if (!j) {
        skipped++;
        continue;
      }
      rows.push({
        userId,
        travelDate: dateKey,
        status: j.status,
        depTime: j.depTime,
        origin: j.origin,
        destination: j.destination,
        label: j.label,
        mins: j.mins,
      });
    }
  }

  if (rows.length > MAX_IMPORT) {
    return NextResponse.json(
      { error: `Too many journeys (max ${MAX_IMPORT}). Even we didn't think it was this bad.` },
      { status: 413 }
    );
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db().insert(journeys).values(rows.slice(i, i + CHUNK));
  }

  return NextResponse.json({ imported: rows.length, skipped });
}
