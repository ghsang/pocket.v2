CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"alias" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" date NOT NULL,
	"category_id" integer NOT NULL,
	"from_user" text NOT NULL,
	"to_user" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_category_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"category_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "budget_categories" DROP CONSTRAINT "budget_categories_spending_account_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_categories" ADD COLUMN "initial_balance" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_categories" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "owner" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_deduction" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD CONSTRAINT "expense_settlements_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_accounts" ADD CONSTRAINT "user_category_accounts_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_accounts" ADD CONSTRAINT "user_category_accounts_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_category_accounts_idx" ON "user_category_accounts" USING btree ("username","category_id");--> statement-breakpoint
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_categories" DROP COLUMN "savings_account";--> statement-breakpoint
ALTER TABLE "budget_categories" DROP COLUMN "spending_account_user_id";