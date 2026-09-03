CREATE TABLE "pops_riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"cnic" text,
	"salary_pkr" integer,
	"from_area" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"shift_label" text,
	"clock_in" text,
	"clock_out" text,
	"status" text DEFAULT 'present' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_employee_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount_pkr" integer NOT NULL,
	"reason" text,
	"cash_movement_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"payroll_run_id" uuid,
	"client_request_id" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pops_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" uuid,
	"employee_code" text NOT NULL,
	"display_name" text NOT NULL,
	"job_title" text NOT NULL,
	"department" text,
	"shift_label" text,
	"base_salary_pkr" integer DEFAULT 0 NOT NULL,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"join_date" date,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"gross_pkr" integer NOT NULL,
	"deductions_pkr" integer DEFAULT 0 NOT NULL,
	"overtime_pkr" integer DEFAULT 0 NOT NULL,
	"net_pkr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_staff_food" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"employee_id" uuid,
	"supplier_id" uuid,
	"expense_category" text DEFAULT 'Staff Meals' NOT NULL,
	"expense_id" uuid,
	"consumer_type" text NOT NULL,
	"person_name" text NOT NULL,
	"meal_date" date NOT NULL,
	"items_ordered" text NOT NULL,
	"amount_pkr" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_accounting_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_email" text NOT NULL,
	"old_value_json" text,
	"new_value_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"subtype" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text,
	"balance_pkr" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"txn_ref" text NOT NULL,
	"type" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"txn_date" date NOT NULL,
	"memo" text,
	"target_bank_account_id" uuid,
	"journal_entry_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" text,
	"employee_id" uuid,
	"party_kind" text,
	"client_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"session_ref" text NOT NULL,
	"opened_by" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_float_pkr" integer DEFAULT 0 NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"expected_cash_pkr" integer,
	"counted_cash_pkr" integer,
	"variance_pkr" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pops_customer_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"invoice_ref" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"amount_pkr" integer NOT NULL,
	"paid_pkr" integer DEFAULT 0 NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"description" text,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_ref" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"payment_date" date NOT NULL,
	"method" text NOT NULL,
	"journal_entry_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"expense_ref" text NOT NULL,
	"category" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"expense_date" date NOT NULL,
	"vendor" text,
	"description" text,
	"receipt_url" text,
	"recurring" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"submitted_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"entry_ref" text NOT NULL,
	"entry_date" date NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_pkr" integer DEFAULT 0 NOT NULL,
	"credit_pkr" integer DEFAULT 0 NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "pops_payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"payroll_ref" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_gross_pkr" integer NOT NULL,
	"total_deductions_pkr" integer DEFAULT 0 NOT NULL,
	"total_net_pkr" integer NOT NULL,
	"staff_count" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"journal_entry_id" uuid,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_tax_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"tax_name" text DEFAULT 'GST' NOT NULL,
	"sales_tax_pct" integer DEFAULT 15 NOT NULL,
	"service_tax_pct" integer DEFAULT 10 NOT NULL,
	"tax_registration_no" text,
	"pos_charges_json" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"bill_ref" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" text,
	"amount_pkr" integer NOT NULL,
	"paid_pkr" integer DEFAULT 0 NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"source_ref" text,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"payment_ref" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"payment_date" date NOT NULL,
	"method" text NOT NULL,
	"journal_entry_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_goods_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"batch_number" text,
	"expiry_date" date
);
--> statement-breakpoint
CREATE TABLE "pops_goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"grn_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"purchase_order_id" uuid,
	"invoice_number" text,
	"delivery_date" date NOT NULL,
	"total_cost_pkr" integer DEFAULT 0 NOT NULL,
	"received_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"category_id" uuid,
	"store_product_id" uuid,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"max_stock" integer DEFAULT 0 NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_inventory_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_production_batch_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"cost_pkr" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"batch_ref" text NOT NULL,
	"recipe_id" uuid,
	"output_name" text NOT NULL,
	"output_description" text,
	"output_ingredient_id" uuid,
	"output_qty" integer DEFAULT 1 NOT NULL,
	"waste_pct" integer DEFAULT 0 NOT NULL,
	"total_cost_pkr" integer DEFAULT 0 NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"received_qty" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"status" text DEFAULT 'Draft' NOT NULL,
	"total_amount_pkr" integer DEFAULT 0 NOT NULL,
	"expected_date" date,
	"requested_by" text,
	"chef" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_recipe_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"menu_item_id" uuid,
	"version" text DEFAULT 'v1.0' NOT NULL,
	"portion_size" text,
	"total_cost_pkr" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_stock_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"batch_number" text,
	"expiry_date" date,
	"location" text DEFAULT 'Main store' NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_stock_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"system_qty" integer NOT NULL,
	"physical_qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"count_number" text NOT NULL,
	"type" text NOT NULL,
	"count_date" date NOT NULL,
	"status" text DEFAULT 'In Progress' NOT NULL,
	"items_counted" integer DEFAULT 0 NOT NULL,
	"variances" integer DEFAULT 0 NOT NULL,
	"conducted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms" text,
	"opening_balance_pkr" integer DEFAULT 0 NOT NULL,
	"onboarded_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_waste_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"waste_type" text NOT NULL,
	"reason" text,
	"cost_impact_pkr" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"bill_ref" text NOT NULL,
	"order_ref" text,
	"table_label" text NOT NULL,
	"waiter_id" uuid,
	"waiter_name" text NOT NULL,
	"lines_json" text NOT NULL,
	"notes" text,
	"subtotal_pkr" integer NOT NULL,
	"discount_pkr" integer DEFAULT 0 NOT NULL,
	"service_pkr" integer DEFAULT 0 NOT NULL,
	"tax_pkr" integer DEFAULT 0 NOT NULL,
	"total_pkr" integer NOT NULL,
	"service_pct" integer DEFAULT 0 NOT NULL,
	"tax_pct" integer DEFAULT 0 NOT NULL,
	"payments_json" text,
	"split_group_ref" text,
	"rider_id" uuid,
	"delivery_charge_pkr" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"inventory_deducted_at" timestamp with time zone,
	"inventory_reversed_at" timestamp with time zone,
	"pra_mode" text,
	"pra_invoice_number" text,
	"pra_invoice_id" text,
	"pra_qr_payload" text,
	"pra_issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_seating_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"table_number" text NOT NULL,
	"seats" integer DEFAULT 4 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"branch_scope" text DEFAULT 'all' NOT NULL,
	"pin_required" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"nav_allowlist" jsonb,
	"staff_pin_hash" text,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pops_menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_menu_item_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"label" text NOT NULL,
	"price_pkr" integer NOT NULL,
	"barcode" text,
	"happy_hour" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"secondary_name" text,
	"image_url" text,
	"portion" text,
	"price_pkr" integer NOT NULL,
	"barcode" text,
	"happy_hour" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"discountable" boolean DEFAULT true NOT NULL,
	"non_discountable" boolean DEFAULT false NOT NULL,
	"non_taxable" boolean DEFAULT false NOT NULL,
	"ask_for_price" boolean DEFAULT false NOT NULL,
	"ask_for_qty" boolean DEFAULT false NOT NULL,
	"allow_manual_discount" boolean DEFAULT false NOT NULL,
	"default_discount_pct" integer DEFAULT 0 NOT NULL,
	"simple_price" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_branch_price_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"price_pkr" integer NOT NULL,
	"notes" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_branch_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_branch_id" uuid NOT NULL,
	"to_branch_id" uuid NOT NULL,
	"transfer_ref" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"ingredient_sku" text NOT NULL,
	"ingredient_name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" text,
	"dispatched_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"channel" text NOT NULL,
	"recipient_label" text NOT NULL,
	"template_key" text,
	"template_name" text NOT NULL,
	"body_preview" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sms_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"printer_alerts_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"body" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"semver" varchar(64) NOT NULL,
	"artifact_url" text NOT NULL,
	"digest_sha256" varchar(64) NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"publisher" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_active_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"channel" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"text" text NOT NULL,
	"tone" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_daily_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sales_date" text NOT NULL,
	"amount_pkr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"min_qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_kitchen_line_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"ticket_ref" text NOT NULL,
	"order_ref" text,
	"station_label" text DEFAULT 'Counter' NOT NULL,
	"menu_item_id" uuid,
	"label" text NOT NULL,
	"qty_canceled" integer NOT NULL,
	"unit_price_pkr" integer DEFAULT 0 NOT NULL,
	"ticket_status_at_cancel" text NOT NULL,
	"canceled_by_user_id" uuid,
	"canceled_by_name" text,
	"source" text DEFAULT 'pos_edit' NOT NULL,
	"canceled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_kitchen_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"ticket_ref" text NOT NULL,
	"order_ref" text,
	"station_label" text DEFAULT 'Counter' NOT NULL,
	"items_summary" text DEFAULT '' NOT NULL,
	"lines_json" text,
	"bill_id" uuid,
	"rider_id" uuid,
	"delivery_charge_pkr" integer DEFAULT 0 NOT NULL,
	"delivery_status" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text NOT NULL,
	"created_by_user_id" uuid,
	"created_by_name" text,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sold_at" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"ref" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"payment" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"system_type" text DEFAULT 'restaurant' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"licence_key" text,
	"licence_plan" text,
	"licence_expires_at" timestamp with time zone,
	"enabled_modules" jsonb,
	"fbr_allowed" boolean DEFAULT false NOT NULL,
	"pra_fake_allowed" boolean DEFAULT false NOT NULL,
	"pra_real_allowed" boolean DEFAULT false NOT NULL,
	"fbr_enabled" boolean DEFAULT false NOT NULL,
	"pra_enabled" boolean DEFAULT false NOT NULL,
	"pra_fake_enabled" boolean DEFAULT false NOT NULL,
	"pra_real_enabled" boolean DEFAULT false NOT NULL,
	"pra_fake_invoice_seq" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licence_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_days" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"paid_by_label" text,
	"note" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licence_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"to_email" text,
	"success" text DEFAULT 'true' NOT NULL,
	"detail" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period_key" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_branch_closing_state" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"orders_paused" boolean DEFAULT false NOT NULL,
	"orders_paused_at" timestamp with time zone,
	"orders_paused_by" text,
	"last_z_report_at" timestamp with time zone,
	"last_z_report_ref" text,
	"last_z_report_json" text,
	"last_backup_at" timestamp with time zone,
	"last_backup_ref" text,
	"last_day_closed_at" timestamp with time zone,
	"last_day_closed_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_day_close_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" text NOT NULL,
	"z_report_ref" text,
	"sales_total_pkr" integer DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"cash_variance_pkr" integer DEFAULT 0 NOT NULL,
	"summary_json" text
);
--> statement-breakpoint
CREATE TABLE "pharmacy_controlled_drug_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"sale_id" uuid,
	"patient_id" uuid,
	"prescription_id" uuid,
	"qty" integer NOT NULL,
	"approved_by_user_id" uuid,
	"buyer_info_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"specialization" text,
	"clinic" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_khata_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"sale_id" uuid,
	"type" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"balance_after_pkr" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_medicine_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medicine_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"manufacturing_date" date,
	"expiry_date" date NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"generic_name" text,
	"dosage_strength" text,
	"presentation" text,
	"brand_name" text,
	"category" text DEFAULT 'Tablet' NOT NULL,
	"manufacturer" text,
	"barcode" text,
	"purchase_price_pkr" integer DEFAULT 0 NOT NULL,
	"selling_price_pkr" integer DEFAULT 0 NOT NULL,
	"tax_pct" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"suggested_reorder_qty" integer DEFAULT 0 NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'Piece' NOT NULL,
	"rack_location" text,
	"shelf_location" text,
	"aisle_location" text,
	"tablets_per_strip" integer DEFAULT 1 NOT NULL,
	"strips_per_box" integer DEFAULT 1 NOT NULL,
	"is_controlled" boolean DEFAULT false NOT NULL,
	"warnings_json" text,
	"instructions_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"date_of_birth" date,
	"allergies_json" text,
	"medical_conditions_json" text,
	"chronic_diseases_json" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"outstanding_pkr" integer DEFAULT 0 NOT NULL,
	"credit_limit_pkr" integer DEFAULT 0 NOT NULL,
	"credit_due_date" date,
	"refill_reminder_enabled" boolean DEFAULT false NOT NULL,
	"refill_reminder_channel" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"dosage" text,
	"quantity" integer NOT NULL,
	"dispensed_qty" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"prescription_number" text NOT NULL,
	"patient_id" uuid,
	"doctor_id" uuid,
	"status" text DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"attachment_json" text,
	"verified_at" timestamp with time zone,
	"dispensed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_refill_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"last_sale_id" uuid,
	"refill_due_date" date NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"medicine_id" uuid NOT NULL,
	"batch_id" uuid,
	"sale_unit" text,
	"qty" integer NOT NULL,
	"tablets_qty" integer DEFAULT 0 NOT NULL,
	"unit_price_pkr" integer NOT NULL,
	"line_total_pkr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"patient_id" uuid,
	"prescription_id" uuid,
	"shift_id" uuid,
	"cashier_user_id" uuid,
	"payment_method" text DEFAULT 'Cash' NOT NULL,
	"payments_json" text,
	"amount_paid_pkr" integer DEFAULT 0 NOT NULL,
	"amount_due_pkr" integer DEFAULT 0 NOT NULL,
	"subtotal_pkr" integer DEFAULT 0 NOT NULL,
	"tax_pkr" integer DEFAULT 0 NOT NULL,
	"discount_pkr" integer DEFAULT 0 NOT NULL,
	"total_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pharmacy_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"cashier_user_id" uuid,
	"cashier_name" text NOT NULL,
	"opening_cash_pkr" integer DEFAULT 0 NOT NULL,
	"closing_cash_pkr" integer,
	"expected_cash_pkr" integer,
	"cash_difference_pkr" integer,
	"total_sales_pkr" integer DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store_bin_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_pkr" integer NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"min_purchase_pkr" integer DEFAULT 0 NOT NULL,
	"is_active" text DEFAULT 'yes' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"credit_limit_pkr" integer DEFAULT 0 NOT NULL,
	"outstanding_pkr" integer DEFAULT 0 NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"membership_tier" text DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"card_number" text NOT NULL,
	"initial_balance_pkr" integer NOT NULL,
	"balance_pkr" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issued_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_grn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"grn_number" text NOT NULL,
	"purchase_order_id" uuid,
	"supplier_id" uuid,
	"warehouse_id" uuid,
	"status" text DEFAULT 'Received' NOT NULL,
	"total_pkr" integer DEFAULT 0 NOT NULL,
	"invoice_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_grn_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_pkr" integer DEFAULT 0 NOT NULL,
	"batch_number" text,
	"expiry_date" date
);
--> statement-breakpoint
CREATE TABLE "store_inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"reference" text,
	"notes" text,
	"warehouse_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_pos_shortcuts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"hotkey" text NOT NULL,
	"label" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_barcodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"code" text NOT NULL,
	"is_primary" text DEFAULT 'no' NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"lot_number" text,
	"manufacturing_date" date,
	"expiry_date" date,
	"quantity" integer DEFAULT 0 NOT NULL,
	"warehouse_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"kit_product_id" uuid NOT NULL,
	"component_product_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"batch_id" uuid,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"subcategory_id" uuid,
	"brand_id" uuid,
	"unit_id" uuid,
	"variant_of_id" uuid,
	"barcode" text,
	"qr_code" text,
	"image_url" text,
	"supplier_id" uuid,
	"purchase_price_pkr" integer DEFAULT 0 NOT NULL,
	"order_cost_pkr" integer DEFAULT 0 NOT NULL,
	"selling_price_pkr" integer DEFAULT 0 NOT NULL,
	"sale_price_pkr" integer DEFAULT 0 NOT NULL,
	"mrp_price_pkr" integer DEFAULT 0 NOT NULL,
	"wholesale_price_pkr" integer DEFAULT 0 NOT NULL,
	"custom_price_pkr" integer DEFAULT 0 NOT NULL,
	"market_sale_price_pkr" integer DEFAULT 0 NOT NULL,
	"margin_pct" integer DEFAULT 0 NOT NULL,
	"markup_pct" integer DEFAULT 0 NOT NULL,
	"tax_pct" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"available_stock" integer DEFAULT 0 NOT NULL,
	"reserved_stock" integer DEFAULT 0 NOT NULL,
	"damaged_stock" integer DEFAULT 0 NOT NULL,
	"expired_stock" integer DEFAULT 0 NOT NULL,
	"in_transit_stock" integer DEFAULT 0 NOT NULL,
	"track_batch" text DEFAULT 'no' NOT NULL,
	"track_serial" text DEFAULT 'no' NOT NULL,
	"is_weighed" text DEFAULT 'no' NOT NULL,
	"color" text,
	"size" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"product_ids_json" text DEFAULT '[]' NOT NULL,
	"config_json" text DEFAULT '{}' NOT NULL,
	"is_active" text DEFAULT 'yes' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_pkr" integer DEFAULT 0 NOT NULL,
	"received_qty" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" uuid,
	"requisition_id" uuid,
	"warehouse_id" uuid,
	"status" text DEFAULT 'Draft' NOT NULL,
	"total_pkr" integer DEFAULT 0 NOT NULL,
	"expected_delivery" date,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_requisition_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisition_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_requisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"requisition_number" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_pkr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"supplier_id" uuid,
	"reason" text NOT NULL,
	"total_amount_pkr" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"is_weighed" text DEFAULT 'no' NOT NULL,
	"unit_price_pkr" integer NOT NULL,
	"line_total_pkr" integer NOT NULL,
	"display_name" text,
	"batch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "store_sale_return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"refund_amount_pkr" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sale_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"refund_method" text NOT NULL,
	"total_refund_pkr" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" uuid,
	"order_number" text,
	"status" text DEFAULT 'Completed' NOT NULL,
	"payment_method" text DEFAULT 'Cash' NOT NULL,
	"is_credit" text DEFAULT 'no' NOT NULL,
	"subtotal_pkr" integer DEFAULT 0 NOT NULL,
	"tax_pkr" integer DEFAULT 0 NOT NULL,
	"discount_pkr" integer DEFAULT 0 NOT NULL,
	"promotion_discount_pkr" integer DEFAULT 0 NOT NULL,
	"loyalty_points_earned" integer DEFAULT 0 NOT NULL,
	"loyalty_points_redeemed" integer DEFAULT 0 NOT NULL,
	"amount_paid_pkr" integer DEFAULT 0 NOT NULL,
	"amount_due_pkr" integer DEFAULT 0 NOT NULL,
	"payments_json" text,
	"shift_id" uuid,
	"terminal_id" text,
	"held_label" text,
	"held_cart_json" text,
	"coupon_code" text,
	"gift_card_number" text,
	"total_pkr" integer DEFAULT 0 NOT NULL,
	"delivery_status" text DEFAULT 'Delivered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"cashier_name" text NOT NULL,
	"terminal_id" text,
	"opening_cash_pkr" integer DEFAULT 0 NOT NULL,
	"closing_cash_pkr" integer,
	"expected_cash_pkr" integer,
	"cash_difference_pkr" integer,
	"total_sales_pkr" integer DEFAULT 0 NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store_stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_change" integer NOT NULL,
	"stock_type" text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"adjustment_number" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_stock_audit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"system_qty" integer NOT NULL,
	"counted_qty" integer NOT NULL,
	"variance" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_stock_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"audit_number" text NOT NULL,
	"audit_type" text DEFAULT 'physical' NOT NULL,
	"status" text DEFAULT 'In Progress' NOT NULL,
	"warehouse_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"transfer_number" text NOT NULL,
	"from_warehouse_id" uuid,
	"to_warehouse_id" uuid,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms" text,
	"quality_score" integer DEFAULT 80 NOT NULL,
	"avg_delivery_days" integer DEFAULT 7 NOT NULL,
	"opening_balance_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text DEFAULT 'pc' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_warehouse_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"is_default" text DEFAULT 'no' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"branch_id" uuid,
	"event_type" text NOT NULL,
	"user_email" text NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_authority_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"authority" text DEFAULT 'pra' NOT NULL,
	"event" text NOT NULL,
	"invoice_number" text,
	"pra_invoice_number" text,
	"status" text DEFAULT '' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"meta_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_authority_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"authority" text NOT NULL,
	"invoice_mode" text DEFAULT 'real' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_ref" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"taxable_amount_pkr" integer DEFAULT 0 NOT NULL,
	"tax_amount_pkr" integer DEFAULT 0 NOT NULL,
	"request_json" text,
	"response_json" text,
	"authority_invoice_number" text,
	"qr_payload" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_authority_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"ntn" text DEFAULT '' NOT NULL,
	"strn" text DEFAULT '' NOT NULL,
	"business_type" text DEFAULT '' NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"branch_name" text DEFAULT '' NOT NULL,
	"branch_code" text DEFAULT '' NOT NULL,
	"fbr_client_id" text,
	"fbr_client_secret" text,
	"fbr_pos_id" text,
	"fbr_terminal_id" text,
	"fbr_environment" text DEFAULT 'sandbox' NOT NULL,
	"fbr_status" text DEFAULT 'disconnected' NOT NULL,
	"fbr_access_token" text,
	"fbr_token_expires_at" timestamp with time zone,
	"fbr_connected_at" timestamp with time zone,
	"fbr_last_error" text,
	"pra_registration_number" text,
	"pra_username" text,
	"pra_password" text,
	"pra_branch_code" text,
	"pra_environment" text DEFAULT 'sandbox' NOT NULL,
	"pra_status" text DEFAULT 'disconnected' NOT NULL,
	"pra_access_token" text,
	"pra_token_expires_at" timestamp with time zone,
	"pra_connected_at" timestamp with time zone,
	"pra_last_error" text,
	"pra_last_token_refresh_at" timestamp with time zone,
	"pra_last_invoice_sent_at" timestamp with time zone,
	"pra_auto_submit" boolean DEFAULT true NOT NULL,
	"pra_offline_queue" boolean DEFAULT true NOT NULL,
	"pra_retry_failed" boolean DEFAULT true NOT NULL,
	"pra_max_retry_attempts" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_code" text NOT NULL,
	"alert_type" text NOT NULL,
	"message" text NOT NULL,
	"printer_id" uuid,
	"job_id" uuid,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_branch_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"server_key" text NOT NULL,
	"branch_code" text NOT NULL,
	"branch_name" text NOT NULL,
	"server_name" text NOT NULL,
	"hostname" text,
	"local_ip" text NOT NULL,
	"port" integer DEFAULT 9740 NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"printer_count" integer DEFAULT 0 NOT NULL,
	"queue_pending" integer DEFAULT 0 NOT NULL,
	"queue_failed" integer DEFAULT 0 NOT NULL,
	"version" text,
	"cloud_sync_enabled" boolean DEFAULT true NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs_cloud" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_code" text NOT NULL,
	"branch_server_id" uuid,
	"local_job_id" text,
	"user_id" text,
	"device_id" text,
	"device_label" text,
	"printer_id" uuid,
	"printer_name" text,
	"order_id" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error" text,
	"payload_json" jsonb NOT NULL,
	"cloud_queued" boolean DEFAULT false NOT NULL,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_printer_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_code" text NOT NULL,
	"name" text NOT NULL,
	"printer_type" text DEFAULT 'receipt' NOT NULL,
	"windows_printer_name" text,
	"ip_address" text,
	"mac_address" text,
	"hostname" text,
	"port" integer,
	"connection_type" text DEFAULT 'other' NOT NULL,
	"paper_size" text DEFAULT '80mm' NOT NULL,
	"online" boolean DEFAULT true NOT NULL,
	"reachable" boolean,
	"ping_ms" integer,
	"backup_printer_id" uuid,
	"legacy_profile_id" text,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"last_set_password" text,
	"platform_role" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"branch_scope" text DEFAULT 'all' NOT NULL,
	"pin_required" boolean DEFAULT false NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "entity_deletion_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"original_email" text,
	"label" text,
	"payload" jsonb NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pops_riders" ADD CONSTRAINT "pops_riders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_riders" ADD CONSTRAINT "pops_riders_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_riders" ADD CONSTRAINT "pops_riders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_attendance" ADD CONSTRAINT "pops_attendance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_attendance" ADD CONSTRAINT "pops_attendance_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_attendance" ADD CONSTRAINT "pops_attendance_employee_id_pops_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."pops_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employee_advances" ADD CONSTRAINT "pops_employee_advances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employee_advances" ADD CONSTRAINT "pops_employee_advances_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employee_advances" ADD CONSTRAINT "pops_employee_advances_employee_id_pops_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."pops_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employee_advances" ADD CONSTRAINT "pops_employee_advances_payroll_run_id_pops_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."pops_payroll_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employees" ADD CONSTRAINT "pops_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employees" ADD CONSTRAINT "pops_employees_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_employees" ADD CONSTRAINT "pops_employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_leave_requests" ADD CONSTRAINT "pops_leave_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_leave_requests" ADD CONSTRAINT "pops_leave_requests_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_leave_requests" ADD CONSTRAINT "pops_leave_requests_employee_id_pops_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."pops_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_payroll_lines" ADD CONSTRAINT "pops_payroll_lines_payroll_run_id_pops_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."pops_payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_payroll_lines" ADD CONSTRAINT "pops_payroll_lines_employee_id_pops_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."pops_employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_staff_food" ADD CONSTRAINT "pops_staff_food_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_staff_food" ADD CONSTRAINT "pops_staff_food_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_staff_food" ADD CONSTRAINT "pops_staff_food_employee_id_pops_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."pops_employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_staff_food" ADD CONSTRAINT "pops_staff_food_supplier_id_pops_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."pops_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_staff_food" ADD CONSTRAINT "pops_staff_food_expense_id_pops_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."pops_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_accounting_audit_logs" ADD CONSTRAINT "pops_accounting_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_accounting_audit_logs" ADD CONSTRAINT "pops_accounting_audit_logs_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_accounts" ADD CONSTRAINT "pops_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_accounts" ADD CONSTRAINT "pops_accounts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_accounts" ADD CONSTRAINT "pops_bank_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_accounts" ADD CONSTRAINT "pops_bank_accounts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_transactions" ADD CONSTRAINT "pops_bank_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_transactions" ADD CONSTRAINT "pops_bank_transactions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_transactions" ADD CONSTRAINT "pops_bank_transactions_bank_account_id_pops_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."pops_bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_transactions" ADD CONSTRAINT "pops_bank_transactions_target_bank_account_id_pops_bank_accounts_id_fk" FOREIGN KEY ("target_bank_account_id") REFERENCES "public"."pops_bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bank_transactions" ADD CONSTRAINT "pops_bank_transactions_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_cash_movements" ADD CONSTRAINT "pops_cash_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_cash_movements" ADD CONSTRAINT "pops_cash_movements_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_cash_movements" ADD CONSTRAINT "pops_cash_movements_session_id_pops_cash_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pops_cash_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_cash_sessions" ADD CONSTRAINT "pops_cash_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_cash_sessions" ADD CONSTRAINT "pops_cash_sessions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_customer_invoices" ADD CONSTRAINT "pops_customer_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_customer_invoices" ADD CONSTRAINT "pops_customer_invoices_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_customer_invoices" ADD CONSTRAINT "pops_customer_invoices_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_customer_payments" ADD CONSTRAINT "pops_customer_payments_invoice_id_pops_customer_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."pops_customer_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_customer_payments" ADD CONSTRAINT "pops_customer_payments_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_expenses" ADD CONSTRAINT "pops_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_expenses" ADD CONSTRAINT "pops_expenses_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_expenses" ADD CONSTRAINT "pops_expenses_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_journal_entries" ADD CONSTRAINT "pops_journal_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_journal_entries" ADD CONSTRAINT "pops_journal_entries_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_journal_lines" ADD CONSTRAINT "pops_journal_lines_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_journal_lines" ADD CONSTRAINT "pops_journal_lines_account_id_pops_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pops_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_payroll_runs" ADD CONSTRAINT "pops_payroll_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_payroll_runs" ADD CONSTRAINT "pops_payroll_runs_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_payroll_runs" ADD CONSTRAINT "pops_payroll_runs_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_tax_settings" ADD CONSTRAINT "pops_tax_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_tax_settings" ADD CONSTRAINT "pops_tax_settings_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_bills" ADD CONSTRAINT "pops_vendor_bills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_bills" ADD CONSTRAINT "pops_vendor_bills_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_bills" ADD CONSTRAINT "pops_vendor_bills_supplier_id_pops_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."pops_suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_bills" ADD CONSTRAINT "pops_vendor_bills_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_payments" ADD CONSTRAINT "pops_vendor_payments_vendor_bill_id_pops_vendor_bills_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."pops_vendor_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_vendor_payments" ADD CONSTRAINT "pops_vendor_payments_journal_entry_id_pops_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."pops_journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipt_lines" ADD CONSTRAINT "pops_goods_receipt_lines_goods_receipt_id_pops_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."pops_goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipt_lines" ADD CONSTRAINT "pops_goods_receipt_lines_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipts" ADD CONSTRAINT "pops_goods_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipts" ADD CONSTRAINT "pops_goods_receipts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipts" ADD CONSTRAINT "pops_goods_receipts_supplier_id_pops_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."pops_suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipts" ADD CONSTRAINT "pops_goods_receipts_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_goods_receipts" ADD CONSTRAINT "pops_goods_receipts_purchase_order_id_pops_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."pops_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_ingredients" ADD CONSTRAINT "pops_ingredients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_ingredients" ADD CONSTRAINT "pops_ingredients_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_ingredients" ADD CONSTRAINT "pops_ingredients_category_id_pops_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."pops_inventory_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_ingredients" ADD CONSTRAINT "pops_ingredients_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_audit_logs" ADD CONSTRAINT "pops_inventory_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_audit_logs" ADD CONSTRAINT "pops_inventory_audit_logs_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_categories" ADD CONSTRAINT "pops_inventory_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_categories" ADD CONSTRAINT "pops_inventory_categories_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batch_lines" ADD CONSTRAINT "pops_production_batch_lines_batch_id_pops_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."pops_production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batch_lines" ADD CONSTRAINT "pops_production_batch_lines_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batches" ADD CONSTRAINT "pops_production_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batches" ADD CONSTRAINT "pops_production_batches_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batches" ADD CONSTRAINT "pops_production_batches_recipe_id_pops_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."pops_recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_production_batches" ADD CONSTRAINT "pops_production_batches_output_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("output_ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_order_lines" ADD CONSTRAINT "pops_purchase_order_lines_purchase_order_id_pops_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."pops_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_order_lines" ADD CONSTRAINT "pops_purchase_order_lines_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_orders" ADD CONSTRAINT "pops_purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_orders" ADD CONSTRAINT "pops_purchase_orders_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_orders" ADD CONSTRAINT "pops_purchase_orders_supplier_id_pops_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."pops_suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_purchase_orders" ADD CONSTRAINT "pops_purchase_orders_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_recipe_lines" ADD CONSTRAINT "pops_recipe_lines_recipe_id_pops_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."pops_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_recipe_lines" ADD CONSTRAINT "pops_recipe_lines_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_recipes" ADD CONSTRAINT "pops_recipes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_recipes" ADD CONSTRAINT "pops_recipes_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_recipes" ADD CONSTRAINT "pops_recipes_menu_item_id_pops_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."pops_menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_adjustments" ADD CONSTRAINT "pops_stock_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_adjustments" ADD CONSTRAINT "pops_stock_adjustments_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_adjustments" ADD CONSTRAINT "pops_stock_adjustments_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_batches" ADD CONSTRAINT "pops_stock_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_batches" ADD CONSTRAINT "pops_stock_batches_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_batches" ADD CONSTRAINT "pops_stock_batches_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_count_lines" ADD CONSTRAINT "pops_stock_count_lines_stock_count_id_pops_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."pops_stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_count_lines" ADD CONSTRAINT "pops_stock_count_lines_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_counts" ADD CONSTRAINT "pops_stock_counts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_stock_counts" ADD CONSTRAINT "pops_stock_counts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_suppliers" ADD CONSTRAINT "pops_suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_suppliers" ADD CONSTRAINT "pops_suppliers_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_waste_records" ADD CONSTRAINT "pops_waste_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_waste_records" ADD CONSTRAINT "pops_waste_records_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_waste_records" ADD CONSTRAINT "pops_waste_records_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bills" ADD CONSTRAINT "pops_bills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bills" ADD CONSTRAINT "pops_bills_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_bills" ADD CONSTRAINT "pops_bills_waiter_id_users_id_fk" FOREIGN KEY ("waiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_seating_sections" ADD CONSTRAINT "pops_seating_sections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_seating_sections" ADD CONSTRAINT "pops_seating_sections_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_tables" ADD CONSTRAINT "pops_tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_tables" ADD CONSTRAINT "pops_tables_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_tables" ADD CONSTRAINT "pops_tables_section_id_pops_seating_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."pops_seating_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_categories" ADD CONSTRAINT "pops_menu_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_categories" ADD CONSTRAINT "pops_menu_categories_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_item_variants" ADD CONSTRAINT "pops_menu_item_variants_menu_item_id_pops_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."pops_menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_items" ADD CONSTRAINT "pops_menu_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_items" ADD CONSTRAINT "pops_menu_items_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_menu_items" ADD CONSTRAINT "pops_menu_items_category_id_pops_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."pops_menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_price_overrides" ADD CONSTRAINT "pops_branch_price_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_price_overrides" ADD CONSTRAINT "pops_branch_price_overrides_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_price_overrides" ADD CONSTRAINT "pops_branch_price_overrides_menu_item_id_pops_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."pops_menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_transfers" ADD CONSTRAINT "pops_branch_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_transfers" ADD CONSTRAINT "pops_branch_transfers_from_branch_id_pops_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_transfers" ADD CONSTRAINT "pops_branch_transfers_to_branch_id_pops_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_transfers" ADD CONSTRAINT "pops_branch_transfers_ingredient_id_pops_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."pops_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_notification_log" ADD CONSTRAINT "pops_notification_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_notification_log" ADD CONSTRAINT "pops_notification_log_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_notification_settings" ADD CONSTRAINT "pops_notification_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_notification_templates" ADD CONSTRAINT "pops_notification_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_versions" ADD CONSTRAINT "module_versions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_active_orders" ADD CONSTRAINT "pops_active_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_active_orders" ADD CONSTRAINT "pops_active_orders_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_alerts" ADD CONSTRAINT "pops_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_alerts" ADD CONSTRAINT "pops_alerts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branches" ADD CONSTRAINT "pops_branches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_daily_sales" ADD CONSTRAINT "pops_daily_sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_daily_sales" ADD CONSTRAINT "pops_daily_sales_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_items" ADD CONSTRAINT "pops_inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_inventory_items" ADD CONSTRAINT "pops_inventory_items_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_kitchen_line_cancellations" ADD CONSTRAINT "pops_kitchen_line_cancellations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_kitchen_line_cancellations" ADD CONSTRAINT "pops_kitchen_line_cancellations_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_kitchen_line_cancellations" ADD CONSTRAINT "pops_kitchen_line_cancellations_ticket_id_pops_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."pops_kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_kitchen_tickets" ADD CONSTRAINT "pops_kitchen_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_kitchen_tickets" ADD CONSTRAINT "pops_kitchen_tickets_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_sales" ADD CONSTRAINT "pops_sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_sales" ADD CONSTRAINT "pops_sales_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_payments" ADD CONSTRAINT "licence_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licence_reminders" ADD CONSTRAINT "licence_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_alerts" ADD CONSTRAINT "org_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_closing_state" ADD CONSTRAINT "pops_branch_closing_state_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_branch_closing_state" ADD CONSTRAINT "pops_branch_closing_state_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_day_close_records" ADD CONSTRAINT "pops_day_close_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_day_close_records" ADD CONSTRAINT "pops_day_close_records_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_medicine_id_pharmacy_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."pharmacy_medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_sale_id_pharmacy_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pharmacy_sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_patient_id_pharmacy_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."pharmacy_patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_prescription_id_pharmacy_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."pharmacy_prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_controlled_drug_logs" ADD CONSTRAINT "pharmacy_controlled_drug_logs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_doctors" ADD CONSTRAINT "pharmacy_doctors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_doctors" ADD CONSTRAINT "pharmacy_doctors_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_khata_entries" ADD CONSTRAINT "pharmacy_khata_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_khata_entries" ADD CONSTRAINT "pharmacy_khata_entries_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_khata_entries" ADD CONSTRAINT "pharmacy_khata_entries_patient_id_pharmacy_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."pharmacy_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_khata_entries" ADD CONSTRAINT "pharmacy_khata_entries_sale_id_pharmacy_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pharmacy_sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_medicine_batches" ADD CONSTRAINT "pharmacy_medicine_batches_medicine_id_pharmacy_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."pharmacy_medicines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_medicines" ADD CONSTRAINT "pharmacy_medicines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_medicines" ADD CONSTRAINT "pharmacy_medicines_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_patients" ADD CONSTRAINT "pharmacy_patients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_patients" ADD CONSTRAINT "pharmacy_patients_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescription_items" ADD CONSTRAINT "pharmacy_prescription_items_prescription_id_pharmacy_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."pharmacy_prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescription_items" ADD CONSTRAINT "pharmacy_prescription_items_medicine_id_pharmacy_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."pharmacy_medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_patient_id_pharmacy_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."pharmacy_patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_doctor_id_pharmacy_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."pharmacy_doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_refill_reminders" ADD CONSTRAINT "pharmacy_refill_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_refill_reminders" ADD CONSTRAINT "pharmacy_refill_reminders_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_refill_reminders" ADD CONSTRAINT "pharmacy_refill_reminders_patient_id_pharmacy_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."pharmacy_patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_refill_reminders" ADD CONSTRAINT "pharmacy_refill_reminders_medicine_id_pharmacy_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."pharmacy_medicines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_refill_reminders" ADD CONSTRAINT "pharmacy_refill_reminders_last_sale_id_pharmacy_sales_id_fk" FOREIGN KEY ("last_sale_id") REFERENCES "public"."pharmacy_sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sale_lines" ADD CONSTRAINT "pharmacy_sale_lines_sale_id_pharmacy_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."pharmacy_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sale_lines" ADD CONSTRAINT "pharmacy_sale_lines_medicine_id_pharmacy_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."pharmacy_medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sale_lines" ADD CONSTRAINT "pharmacy_sale_lines_batch_id_pharmacy_medicine_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."pharmacy_medicine_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "pharmacy_sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "pharmacy_sales_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "pharmacy_sales_patient_id_pharmacy_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."pharmacy_patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "pharmacy_sales_prescription_id_pharmacy_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."pharmacy_prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "pharmacy_sales_cashier_user_id_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_shifts" ADD CONSTRAINT "pharmacy_shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_shifts" ADD CONSTRAINT "pharmacy_shifts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pharmacy_shifts" ADD CONSTRAINT "pharmacy_shifts_cashier_user_id_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_bin_locations" ADD CONSTRAINT "store_bin_locations_shelf_id_store_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."store_shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_brands" ADD CONSTRAINT "store_brands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_brands" ADD CONSTRAINT "store_brands_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cash_movements" ADD CONSTRAINT "store_cash_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cash_movements" ADD CONSTRAINT "store_cash_movements_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cash_movements" ADD CONSTRAINT "store_cash_movements_shift_id_store_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."store_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_coupons" ADD CONSTRAINT "store_coupons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_coupons" ADD CONSTRAINT "store_coupons_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_gift_cards" ADD CONSTRAINT "store_gift_cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_gift_cards" ADD CONSTRAINT "store_gift_cards_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn" ADD CONSTRAINT "store_grn_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn" ADD CONSTRAINT "store_grn_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn" ADD CONSTRAINT "store_grn_purchase_order_id_store_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."store_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn" ADD CONSTRAINT "store_grn_supplier_id_store_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."store_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn" ADD CONSTRAINT "store_grn_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn_items" ADD CONSTRAINT "store_grn_items_grn_id_store_grn_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."store_grn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_grn_items" ADD CONSTRAINT "store_grn_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_transactions" ADD CONSTRAINT "store_inventory_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_transactions" ADD CONSTRAINT "store_inventory_transactions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_inventory_transactions" ADD CONSTRAINT "store_inventory_transactions_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_pos_shortcuts" ADD CONSTRAINT "store_pos_shortcuts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_pos_shortcuts" ADD CONSTRAINT "store_pos_shortcuts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_pos_shortcuts" ADD CONSTRAINT "store_pos_shortcuts_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_barcodes" ADD CONSTRAINT "store_product_barcodes_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_batches" ADD CONSTRAINT "store_product_batches_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_kits" ADD CONSTRAINT "store_product_kits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_kits" ADD CONSTRAINT "store_product_kits_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_kits" ADD CONSTRAINT "store_product_kits_kit_product_id_store_products_id_fk" FOREIGN KEY ("kit_product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_kits" ADD CONSTRAINT "store_product_kits_component_product_id_store_products_id_fk" FOREIGN KEY ("component_product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_serials" ADD CONSTRAINT "store_product_serials_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_serials" ADD CONSTRAINT "store_product_serials_batch_id_store_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."store_product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_subcategory_id_store_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."store_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_brand_id_store_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."store_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_unit_id_store_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."store_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_promotions" ADD CONSTRAINT "store_promotions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_promotions" ADD CONSTRAINT "store_promotions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_order_items" ADD CONSTRAINT "store_purchase_order_items_purchase_order_id_store_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."store_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_order_items" ADD CONSTRAINT "store_purchase_order_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_orders" ADD CONSTRAINT "store_purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_orders" ADD CONSTRAINT "store_purchase_orders_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_orders" ADD CONSTRAINT "store_purchase_orders_supplier_id_store_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."store_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_orders" ADD CONSTRAINT "store_purchase_orders_requisition_id_store_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."store_purchase_requisitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_orders" ADD CONSTRAINT "store_purchase_orders_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_requisition_items" ADD CONSTRAINT "store_purchase_requisition_items_requisition_id_store_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."store_purchase_requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_requisition_items" ADD CONSTRAINT "store_purchase_requisition_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_requisitions" ADD CONSTRAINT "store_purchase_requisitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_requisitions" ADD CONSTRAINT "store_purchase_requisitions_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_return_items" ADD CONSTRAINT "store_purchase_return_items_return_id_store_purchase_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."store_purchase_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_return_items" ADD CONSTRAINT "store_purchase_return_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_returns" ADD CONSTRAINT "store_purchase_returns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_returns" ADD CONSTRAINT "store_purchase_returns_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchase_returns" ADD CONSTRAINT "store_purchase_returns_supplier_id_store_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."store_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_racks" ADD CONSTRAINT "store_racks_zone_id_store_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."store_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_lines" ADD CONSTRAINT "store_sale_lines_sale_id_store_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."store_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_lines" ADD CONSTRAINT "store_sale_lines_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_return_lines" ADD CONSTRAINT "store_sale_return_lines_return_id_store_sale_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."store_sale_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_return_lines" ADD CONSTRAINT "store_sale_return_lines_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_returns" ADD CONSTRAINT "store_sale_returns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_returns" ADD CONSTRAINT "store_sale_returns_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sale_returns" ADD CONSTRAINT "store_sale_returns_sale_id_store_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."store_sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sales" ADD CONSTRAINT "store_sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sales" ADD CONSTRAINT "store_sales_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sales" ADD CONSTRAINT "store_sales_customer_id_store_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."store_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sales" ADD CONSTRAINT "store_sales_shift_id_store_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."store_shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_shelves" ADD CONSTRAINT "store_shelves_rack_id_store_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."store_racks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_shifts" ADD CONSTRAINT "store_shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_shifts" ADD CONSTRAINT "store_shifts_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_adjustment_items" ADD CONSTRAINT "store_stock_adjustment_items_adjustment_id_store_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."store_stock_adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_adjustment_items" ADD CONSTRAINT "store_stock_adjustment_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_adjustments" ADD CONSTRAINT "store_stock_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_adjustments" ADD CONSTRAINT "store_stock_adjustments_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_audit_items" ADD CONSTRAINT "store_stock_audit_items_audit_id_store_stock_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."store_stock_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_audit_items" ADD CONSTRAINT "store_stock_audit_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_audits" ADD CONSTRAINT "store_stock_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_audits" ADD CONSTRAINT "store_stock_audits_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_audits" ADD CONSTRAINT "store_stock_audits_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfer_items" ADD CONSTRAINT "store_stock_transfer_items_transfer_id_store_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."store_stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfer_items" ADD CONSTRAINT "store_stock_transfer_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfers" ADD CONSTRAINT "store_stock_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfers" ADD CONSTRAINT "store_stock_transfers_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfers" ADD CONSTRAINT "store_stock_transfers_from_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock_transfers" ADD CONSTRAINT "store_stock_transfers_to_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_suppliers" ADD CONSTRAINT "store_suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_suppliers" ADD CONSTRAINT "store_suppliers_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_units" ADD CONSTRAINT "store_units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_units" ADD CONSTRAINT "store_units_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouse_stock" ADD CONSTRAINT "store_warehouse_stock_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouse_stock" ADD CONSTRAINT "store_warehouse_stock_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouse_stock" ADD CONSTRAINT "store_warehouse_stock_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouse_stock" ADD CONSTRAINT "store_warehouse_stock_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouses" ADD CONSTRAINT "store_warehouses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warehouses" ADD CONSTRAINT "store_warehouses_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_zones" ADD CONSTRAINT "store_zones_warehouse_id_store_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."store_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_security_events" ADD CONSTRAINT "pops_security_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_security_events" ADD CONSTRAINT "pops_security_events_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pops_security_events" ADD CONSTRAINT "pops_security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_activity_logs" ADD CONSTRAINT "tax_authority_activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_activity_logs" ADD CONSTRAINT "tax_authority_activity_logs_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_invoices" ADD CONSTRAINT "tax_authority_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_invoices" ADD CONSTRAINT "tax_authority_invoices_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_profiles" ADD CONSTRAINT "tax_authority_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_authority_profiles" ADD CONSTRAINT "tax_authority_profiles_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_alerts" ADD CONSTRAINT "print_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_branch_servers" ADD CONSTRAINT "print_branch_servers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_branch_servers" ADD CONSTRAINT "print_branch_servers_branch_id_pops_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."pops_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs_cloud" ADD CONSTRAINT "print_jobs_cloud_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs_cloud" ADD CONSTRAINT "print_jobs_cloud_branch_server_id_print_branch_servers_id_fk" FOREIGN KEY ("branch_server_id") REFERENCES "public"."print_branch_servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs_cloud" ADD CONSTRAINT "print_jobs_cloud_printer_id_print_printer_nodes_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."print_printer_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_printer_nodes" ADD CONSTRAINT "print_printer_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pops_bills_branch_status_created_idx" ON "pops_bills" USING btree ("branch_id","status","created_at");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_slug_unique" ON "modules" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pops_branches_org_code_uidx" ON "pops_branches" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "pops_kitchen_tickets_branch_status_idx" ON "pops_kitchen_tickets" USING btree ("branch_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "licence_reminders_org_period_kind_uidx" ON "licence_reminders" USING btree ("organization_id","period_key","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "org_alerts_org_period_kind_uidx" ON "org_alerts" USING btree ("organization_id","period_key","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_authority_invoices_source_uidx" ON "tax_authority_invoices" USING btree ("organization_id","authority","invoice_mode","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_authority_profiles_org_branch_uidx" ON "tax_authority_profiles" USING btree ("organization_id","branch_id");