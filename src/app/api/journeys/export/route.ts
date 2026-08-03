import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import type { JourneyMap } from "@/lib/journeys";

export const dynamic = "force-dynamic";

/** GET /api/journeys/export — all your data, in the old static site's shape */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const rows = await db()
    .select()
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(asc(journeys.travelDate), asc(journeys.id));

  const out: JourneyMap = {};
  for (const r of rows) {
    (out[r.travelDate] ??= []).push({
      id: r.id,
      status: r.status,
      ...(r.depTime ? { depTime: r.depTime } : {}),
      ...(r.origin ? { origin: r.origin } : {}),
      ...(r.destination ? { destination: r.destination } : {}),
      ...(r.label ? { label: r.label } : {}),
      ...(r.mins ? { mins: r.mins } : {}),
    });
  }

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="oh-my-train-export.json"',
    },
  });
}
