CREATE TABLE "chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"scraper_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_token" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_anon_token_unique" UNIQUE("anon_token")
);
--> statement-breakpoint
CREATE TABLE "generic_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"department_id" smallint,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"size_value" numeric,
	"size_unit" text,
	"search_terms" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generic_concepts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"intent" text NOT NULL,
	"generic_concept_id" uuid,
	"upc" text,
	"raw_query" text NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_intent_check" CHECK ("list_items"."intent" IN ('generic', 'branded')),
	CONSTRAINT "list_items_intent_targets_check" CHECK (("list_items"."intent" = 'generic' AND "list_items"."generic_concept_id" IS NOT NULL AND "list_items"."upc" IS NULL)
          OR ("list_items"."intent" = 'branded' AND "list_items"."upc" IS NOT NULL AND "list_items"."generic_concept_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"name" text DEFAULT 'My list' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_product_id" uuid NOT NULL,
	"regular_cents" integer NOT NULL,
	"sale_cents" integer,
	"sale_ends_on" date,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" char(2) NOT NULL,
	"zip" text NOT NULL,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_generic_match" (
	"store_product_id" uuid NOT NULL,
	"generic_concept_id" uuid NOT NULL,
	"confidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_product_generic_match_store_product_id_generic_concept_id_pk" PRIMARY KEY("store_product_id","generic_concept_id")
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_location_id" uuid NOT NULL,
	"store_sku" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"upc" text,
	"size_value" numeric,
	"size_unit" text,
	"department_id" smallint,
	"image_url" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"zip" text,
	"selected_chain_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"allow_substitutions" boolean DEFAULT false NOT NULL,
	"preferred_location_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generic_concepts" ADD CONSTRAINT "generic_concepts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_generic_concept_id_generic_concepts_id_fk" FOREIGN KEY ("generic_concept_id") REFERENCES "public"."generic_concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_locations" ADD CONSTRAINT "store_locations_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_generic_match" ADD CONSTRAINT "store_product_generic_match_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_generic_match" ADD CONSTRAINT "store_product_generic_match_generic_concept_id_generic_concepts_id_fk" FOREIGN KEY ("generic_concept_id") REFERENCES "public"."generic_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_location_id_store_locations_id_fk" FOREIGN KEY ("store_location_id") REFERENCES "public"."store_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generic_concepts_search_terms_gin" ON "generic_concepts" USING gin ("search_terms");--> statement-breakpoint
CREATE INDEX "prices_product_captured" ON "prices" USING btree ("store_product_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "store_locations_chain_external" ON "store_locations" USING btree ("chain_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_location_sku" ON "store_products" USING btree ("store_location_id","store_sku");--> statement-breakpoint
CREATE INDEX "store_products_upc" ON "store_products" USING btree ("upc") WHERE "store_products"."upc" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "store_products_location" ON "store_products" USING btree ("store_location_id");--> statement-breakpoint
CREATE VIEW "public"."current_prices" AS (SELECT DISTINCT ON (store_product_id)
        store_product_id, regular_cents, sale_cents, sale_ends_on, captured_at
      FROM prices
      ORDER BY store_product_id, captured_at DESC);