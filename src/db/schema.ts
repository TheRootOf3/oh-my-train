import { bigserial, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const journeys = pgTable(
  "journeys",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // GitHub numeric user id as a string; NULL for anonymous platform-4 shouts
    userId: text("user_id"),
    travelDate: date("travel_date").notNull(),
    status: text("status", { enum: ["ontime", "delayed", "cancelled"] }).notNull(),
    depTime: text("dep_time"),
    origin: text("origin"),
    destination: text("destination"),
    // free-text description from the static-site era
    label: text("label"),
    mins: integer("mins"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("journeys_user_date_idx").on(t.userId, t.travelDate),
    index("journeys_date_idx").on(t.travelDate),
  ]
);

export type JourneyRow = typeof journeys.$inferSelect;
