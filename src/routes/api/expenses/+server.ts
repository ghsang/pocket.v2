import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { expenses } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { verifyToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const session = cookies.get('session');
	const token = session ? verifyToken(session) : null;
	if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

	const limit = Number(url.searchParams.get('limit')) || 20;
	const offset = Number(url.searchParams.get('offset')) || 0;

	// Load all expenses (shared between users)
	const data = await db.query.expenses.findMany({
		orderBy: [desc(expenses.date), desc(expenses.createdAt)],
		limit: limit,
		offset: offset,
		with: {
			category: true,
			paymentMethod: true,
			user: true
		}
	});

	return json(data);
};
