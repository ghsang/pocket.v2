-- Household data is accessed through the server's private DATABASE_URL only.
-- No Data API policies are intentional: Kakao sessions are not Supabase Auth JWTs.
-- Keep owner/BYPASSRLS access for server queries; do not FORCE ROW LEVEL SECURITY.
ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."budget_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."deposit_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."expense_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."monthly_deposits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."pending_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."user_category_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS does not protect TRUNCATE or sequence operations. Remove client grants as
-- well, including PUBLIC grants inherited by every role and explicit column ACLs.
-- Supabase client roles do not exist in the plain Postgres development database.
DO $$
DECLARE
    client_role text;
    grantee_sql text;
    column_grant record;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['PUBLIC', 'anon', 'authenticated'] LOOP
        IF client_role <> 'PUBLIC'
            AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            CONTINUE;
        END IF;

        grantee_sql := CASE WHEN client_role = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END;

        EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %s', grantee_sql);
        EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %s', grantee_sql);

        FOR column_grant IN
            SELECT c.relname AS table_name, string_agg(quote_ident(a.attname), ', ') AS columns_sql
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
                AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
            GROUP BY c.oid, c.relname
        LOOP
            EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM %s',
                column_grant.columns_sql, column_grant.table_name, grantee_sql);
        END LOOP;

        -- Applies to objects subsequently created by this migration's owner.
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s', grantee_sql);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', grantee_sql);
    END LOOP;
END;
$$;
