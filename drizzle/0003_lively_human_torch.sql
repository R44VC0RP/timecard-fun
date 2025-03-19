ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;