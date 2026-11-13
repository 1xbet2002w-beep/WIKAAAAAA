import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';

export const applicationState = pgTable('application_state', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').notNull(),
  demoMatches: jsonb('demo_matches'),
});
