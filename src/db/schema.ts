import { bigint, bigserial, date, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const journeys = pgTable(
  "journeys",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // GitHub numeric user id as a string; NULL for anonymous platform-4 shouts
    userId: text("user_id"),
    travelDate: date("travel_date").notNull(),
    status: text("status", { enum: ["ontime", "delayed", "cancelled", "walked"] }).notNull(),
    depTime: text("dep_time"),
    origin: text("origin"),
    destination: text("destination"),
    // free-text description from the static-site era
    label: text("label"),
    mins: integer("mins"),
    // the official excuse — "awaiting train crew", "the wrong kind of snow", …
    reason: text("reason"),
    // the cancelled journey this one replaced — a cascade of disappointment
    followsId: bigint("follows_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("journeys_user_date_idx").on(t.userId, t.travelDate),
    index("journeys_date_idx").on(t.travelDate),
    // a cancelled train gets exactly one successor — cascades are chains, not trees
    uniqueIndex("journeys_follows_id_uniq").on(t.followsId),
  ]
);

export type JourneyRow = typeof journeys.$inferSelect;
