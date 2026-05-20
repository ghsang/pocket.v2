-- Step 1: Add nullable account_id column
ALTER TABLE "payment_methods" ADD COLUMN "account_id" integer;--> statement-breakpoint

-- Step 2: Backfill account_id from existing linked_account text ("{bank_name} {account_number}")
UPDATE "payment_methods" pm
SET "account_id" = ba."id"
FROM "bank_accounts" ba
WHERE ba."bank_name" || ' ' || ba."account_number" = pm."linked_account";--> statement-breakpoint

-- Step 3: Enforce NOT NULL and FK constraint
ALTER TABLE "payment_methods" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 4: Drop legacy linked_account column
ALTER TABLE "payment_methods" DROP COLUMN "linked_account";
