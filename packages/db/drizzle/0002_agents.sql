ALTER TABLE "agent_versions" ADD COLUMN "output_format" text DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;