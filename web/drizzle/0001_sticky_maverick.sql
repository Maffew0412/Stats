CREATE TABLE "branded_products" (
	"upc" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"size_value" numeric,
	"size_unit" text,
	"department_id" smallint,
	"image_url" text,
	"search_terms" text[],
	"source" text DEFAULT 'seed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branded_products" ADD CONSTRAINT "branded_products_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branded_products_search_terms_gin" ON "branded_products" USING gin ("search_terms");