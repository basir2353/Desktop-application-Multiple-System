CREATE TABLE "store_cooking_unit_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"cooking_unit_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_cooking_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pops_menu_categories" ADD COLUMN "cooking_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "store_stock_transfer_items" ADD COLUMN "cooking_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "store_stock_transfers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "store_cooking_unit_stock" ADD CONSTRAINT "store_cooking_unit_stock_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cooking_unit_stock" ADD CONSTRAINT "store_cooking_unit_stock_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cooking_unit_stock" ADD CONSTRAINT "store_cooking_unit_stock_cooking_unit_id_store_cooking_units_id_fk" FOREIGN KEY ("cooking_unit_id") REFERENCES "public"."store_cooking_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cooking_unit_stock" ADD CONSTRAINT "store_cooking_unit_stock_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cooking_units" ADD CONSTRAINT "store_cooking_units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cooking_units" ADD CONSTRAINT "store_cooking_units_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_cooking_unit_stock_unit_product_uidx" ON "store_cooking_unit_stock" USING btree ("organization_id","branch_id","cooking_unit_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_cooking_units_org_branch_code_uidx" ON "store_cooking_units" USING btree ("organization_id","branch_id","code");--> statement-breakpoint
ALTER TABLE "pops_menu_categories" ADD CONSTRAINT "pops_menu_categories_cooking_unit_id_store_cooking_units_id_fk" FOREIGN KEY ("cooking_unit_id") REFERENCES "public"."store_cooking_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfer_items" ADD CONSTRAINT "store_stock_transfer_items_cooking_unit_id_store_cooking_units_id_fk" FOREIGN KEY ("cooking_unit_id") REFERENCES "public"."store_cooking_units"("id") ON DELETE set null ON UPDATE no action;