ALTER TABLE "HW12_container" ADD COLUMN "source" varchar(8) DEFAULT 'live' NOT NULL;--> statement-breakpoint
-- Every container that exists before this migration was created by the seed
-- scripts; live rows only start appearing once an agent registers them.
UPDATE "HW12_container" SET "source" = 'seed';
