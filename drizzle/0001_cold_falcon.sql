CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"link" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clock_in_records" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "clock_out_records" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "clock_in_records" ADD CONSTRAINT "clock_in_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_out_records" ADD CONSTRAINT "clock_out_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;