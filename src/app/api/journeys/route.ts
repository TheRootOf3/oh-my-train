import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import { cleanJourney, isValidDateKey, monthRange } from "@/lib/journeys";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/journeys?month=YYYY-MM&scope=all|mine
 * The communal catalogue of sorrow — everyone can read it.
 * scope=mine narrows to the signed-in user's own rows.
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const range = monthRange(month);
  if (!range) return NextResponse.json({ error: "Bad month" }, { status: 400 });

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const scope = req.nextUrl.searchParams.get("scope") === "mine" ? "mine" : "all";
  if (scope === "mine" && !userId) {
    return NextResponse.json({ error: "Sign in to filter to your own misery" }, { status: 401 });
  }

  const conds: SQL[] = [gte(journeys.travelDate, range.start), lt(journeys.travelDate, range.end)];
  if (scope === "mine" && userId) conds.push(eq(journeys.userId, userId));

  const rows = await db()
    .select()
    .from(journeys)
    .where(and(...conds))
    .orderBy(asc(journeys.travelDate), asc(journeys.id));

  return NextResponse.json({
    journeys: rows.map((r) => ({
      id: r.id,
      date: r.travelDate,
      status: r.status,
      depTime: r.depTime ?? undefined,
      origin: r.origin ?? undefined,
      destination: r.destination ?? undefined,
      label: r.label ?? undefined,
      mins: r.mins ?? undefined,
      mine: userId !== null && r.userId === userId,
    })),
  });
}

/**
 * POST /api/journeys — log one more disappointment.
 * Open to everyone; anonymous entries are stored with a NULL user id and,
 * like words shouted at a departure board, can never be taken back.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req.headers))) {
    return NextResponse.json(
      { error: "Easy there. This endpoint is rate-limited — unlike the actual railway." },
      { status: 429 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { date } = (body ?? {}) as { date?: unknown };
  if (typeof date !== "string" || !isValidDateKey(date)) {
    return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }
  const journey = cleanJourney(body, { requireDelayMins: true });
  if (!journey) {
    return NextResponse.json(
      { error: "Bad journey — delayed trains must confess their minutes" },
      { status: 400 }
    );
  }

  const [row] = await db()
    .insert(journeys)
    .values({
      userId,
      travelDate: date,
      status: journey.status,
      depTime: journey.depTime,
      origin: journey.origin,
      destination: journey.destination,
      label: journey.label,
      mins: journey.mins,
    })
    .returning();

  return NextResponse.json(
    {
      journey: {
        id: row.id,
        date: row.travelDate,
        status: row.status,
        depTime: row.depTime ?? undefined,
        origin: row.origin ?? undefined,
        destination: row.destination ?? undefined,
        label: row.label ?? undefined,
        mins: row.mins ?? undefined,
        mine: userId !== null,
      },
    },
    { status: 201 }
  );
}

/** DELETE /api/journeys?id=N — you may only cancel your own journeys. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const deleted = await db()
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.userId, userId)))
    .returning({ id: journeys.id });

  if (!deleted.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
