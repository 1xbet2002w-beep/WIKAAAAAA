CREATE TABLE "application_state" (
	"id" text PRIMARY KEY,
	"payload" jsonb NOT NULL,
	"demo_matches" jsonb
);
