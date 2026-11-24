CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"assistant_id" text NOT NULL,
	"assistant_version" integer NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"forked_from" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "assistant_id" text;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "threads_workspace_updated" ON "threads" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "threads_workspace_status" ON "threads" USING btree ("workspace_id","status");