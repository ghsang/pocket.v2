CREATE TABLE "deposit_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"deposit_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monthly_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" date NOT NULL,
	"salary" numeric(12, 2) NOT NULL,
	"total_budget" numeric(12, 2) NOT NULL,
	"savings_amount" numeric(12, 2) NOT NULL,
	"is_completed" boolean DEFAULT false,
	"deposited_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"local_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"category_id" integer,
	"payment_method_id" integer,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "linked_account" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD COLUMN "spending_account_user_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "is_offline_sync" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "is_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD CONSTRAINT "deposit_items_deposit_id_monthly_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."monthly_deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_items" ADD CONSTRAINT "deposit_items_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_deposits" ADD CONSTRAINT "monthly_deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_expenses" ADD CONSTRAINT "pending_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_deposits_user_month_idx" ON "monthly_deposits" USING btree ("user_id","month");--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_spending_account_user_id_users_id_fk" FOREIGN KEY ("spending_account_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;