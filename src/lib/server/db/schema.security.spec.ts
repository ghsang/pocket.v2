import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

describe('household data access', () => {
	it('keeps every exported table behind server-only RLS, including new tables', () => {
		const tables = Object.values(schema).filter((value) => is(value, PgTable));

		expect(tables.length).toBeGreaterThan(0);
		for (const table of tables) {
			const config = getTableConfig(table);
			expect(config.enableRLS, `${config.name} must enable RLS`).toBe(true);
			expect(config.policies, `${config.name} must deny direct client access`).toEqual([]);
		}
	});
});
