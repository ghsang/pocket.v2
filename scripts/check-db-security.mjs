import postgres from 'postgres';

const expectedTables = [
	'bank_accounts',
	'budget_categories',
	'deposit_items',
	'expense_settlements',
	'expenses',
	'monthly_deposits',
	'payment_methods',
	'pending_expenses',
	'user_category_accounts',
	'users'
];

async function checkSecurity() {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set.');
	let hostname;
	try {
		hostname = new URL(process.env.DATABASE_URL).hostname;
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
	}
	const sql = postgres(process.env.DATABASE_URL, {
		max: 1,
		prepare: false,
		connect_timeout: 10,
		...(/\.supabase\.(co|com)$/.test(hostname) ? { ssl: 'require' } : {})
	});
	const failures = [];
	try {
		const { tables, clientRoles } = await sql.begin('read only', async (tx) => {
			const tables = await tx`
				select c.relname as name, c.relrowsecurity as rls,
					(r.rolsuper or r.rolbypassrls or (
						not c.relforcerowsecurity and pg_has_role(r.oid, c.relowner, 'USAGE')
					)) as server_bypasses_rls
				from pg_class c
				join pg_namespace n on n.oid = c.relnamespace
				join pg_roles r on r.rolname = current_user
				where n.nspname = 'public' and c.relkind in ('r', 'p')
			`;
			for (const name of expectedTables) {
				const table = tables.find((table) => table.name === name);
				if (!table) failures.push(`Missing expected table public.${name}.`);
				else if (!table.server_bypasses_rls) {
					failures.push(`Server connection cannot bypass RLS on public.${name}.`);
				}
			}
			for (const table of tables) {
				if (!table.rls) failures.push(`RLS is disabled on public.${table.name}.`);
			}

			const clientRoles = await tx`
				select rolname as name from pg_roles where rolname in ('anon', 'authenticated')
			`;
			const privileges = await tx`
				with clients as (
					select oid, rolname from pg_roles where rolname in ('anon', 'authenticated')
				), objects as (
					select c.* from pg_class c join pg_namespace n on n.oid = c.relnamespace
					where n.nspname = 'public'
				)
				select r.rolname as role, c.relname as object, 'table' as kind, p.privilege
				from clients r cross join objects c
				cross join lateral unnest(
					array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
					|| case when current_setting('server_version_num')::integer >= 170000
						then array['MAINTAIN'] else array[]::text[] end
				) p(privilege)
				where c.relkind in ('r', 'p', 'v', 'm', 'f')
					and has_table_privilege(r.oid, c.oid, p.privilege)
				union all
				select r.rolname, c.relname || '.' || a.attname, 'column', p.privilege
				from clients r cross join objects c
				join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
				cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) p(privilege)
				where c.relkind in ('r', 'p', 'v', 'm', 'f')
					and has_column_privilege(r.oid, c.oid, a.attnum, p.privilege)
				union all
				select r.rolname, c.relname, 'sequence', p.privilege
				from clients r cross join objects c
				cross join unnest(array['USAGE', 'SELECT', 'UPDATE']) p(privilege)
				where c.relkind = 'S' and has_sequence_privilege(r.oid, c.oid, p.privilege)
			`;
			for (const grant of privileges) {
				failures.push(
					`${grant.role} retains ${grant.privilege} on ${grant.kind} public.${grant.object}.`
				);
			}

			const defaults = await tx`
				select case d.defaclnamespace when 0 then 'global' else 'public' end as scope,
					case d.defaclobjtype when 'r' then 'table' else 'sequence' end as kind,
					a.privilege_type as privilege
				from pg_default_acl d
				cross join lateral aclexplode(d.defaclacl) a
				where d.defaclrole = (select oid from pg_roles where rolname = current_user)
					and d.defaclnamespace in (0, (select oid from pg_namespace where nspname = 'public'))
					and d.defaclobjtype in ('r', 'S')
					and case when a.grantee = 0 then true else exists (
						select 1 from pg_roles r where r.rolname in ('anon', 'authenticated')
							and pg_has_role(r.oid, a.grantee, 'USAGE')
					) end
			`;
			for (const grant of defaults) {
				failures.push(
					`${grant.scope} default ${grant.kind} privileges expose ${grant.privilege} to client roles.`
				);
			}
			for (const name of expectedTables) {
				if (tables.some((table) => table.name === name)) {
					await tx`select * from ${tx(`public.${name}`)} limit 0`;
				}
			}
			return { tables, clientRoles };
		});

		for (const role of clientRoles) {
			for (const name of ['bank_accounts', 'users']) {
				if (!tables.some((table) => table.name === name)) continue;
				let roleSelected = false;
				const unexpectedAccess = new Error('Client SELECT unexpectedly succeeded.');
				try {
					await sql.begin('read only', async (tx) => {
						await tx`set local role ${tx(role.name)}`;
						roleSelected = true;
						await tx`select * from ${tx(`public.${name}`)} limit 0`;
						throw unexpectedAccess; // Always roll back, including unexpected success.
					});
				} catch (error) {
					if (error === unexpectedAccess) {
						failures.push(`${role.name} can SELECT public.${name}.`);
					} else if (!roleSelected || error.code !== '42501') {
						throw error;
					}
				}
			}
		}

		if (failures.length) {
			console.error(`Database security verification failed (${failures.length} findings):`);
			for (const failure of failures) console.error(`- ${failure}`);
			process.exitCode = 1;
		} else {
			console.log(
				`Database security verified: ${tables.length} public tables have RLS; ` +
					`${expectedTables.length} server reads pass; client privileges and defaults are closed.`
			);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}

checkSecurity().catch((error) => {
	// Driver errors can contain connection details; report only a sanitized error code.
	const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : '';
	console.error(`Database security verification could not finish${code ? ` (${code})` : ''}.`);
	process.exitCode = 1;
});
