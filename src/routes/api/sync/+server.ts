import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { expenses, pendingExpenses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// POST - Sync a single offline expense
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: '인증이 필요합니다.' }, { status: 401 });
	}

	try {
		const data = await request.json();
		const { localId, description, amount, date, categoryId, paymentMethodId } = data;

		if (!localId || !amount || !date) {
			return json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
		}

		// Check if already synced (prevent duplicates)
		const existing = await db.query.pendingExpenses.findFirst({
			where: eq(pendingExpenses.localId, localId)
		});

		if (existing?.syncedAt) {
			return json({ message: '이미 동기화된 데이터입니다.', alreadySynced: true });
		}

		// Insert into main expenses table
		const [newExpense] = await db
			.insert(expenses)
			.values({
				userId: user.id,
				description: description || '',
				amount: String(amount),
				date: date,
				categoryId: categoryId || null,
				paymentMethodId: paymentMethodId || null,
				isOfflineSync: true
			})
			.returning();

		// Track in pending expenses table (for deduplication)
		await db.insert(pendingExpenses).values({
			localId,
			userId: user.id,
			description: description || '',
			amount: String(amount),
			date: date,
			categoryId: categoryId || null,
			paymentMethodId: paymentMethodId || null,
			syncedAt: new Date()
		});

		return json({
			success: true,
			expenseId: newExpense.id,
			message: '동기화 완료'
		});
	} catch (e) {
		console.error('Sync error:', e);
		return json({ error: '동기화 중 오류가 발생했습니다.' }, { status: 500 });
	}
};

// GET - Get sync status
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: '인증이 필요합니다.' }, { status: 401 });
	}

	try {
		// Get count of all expenses (shared)
		const allExpenses = await db.query.expenses.findMany();

		const offlineSynced = allExpenses.filter((e) => e.isOfflineSync).length;

		return json({
			totalExpenses: allExpenses.length,
			offlineSynced,
			lastSync: new Date().toISOString()
		});
	} catch {
		return json({ error: '상태 조회 중 오류가 발생했습니다.' }, { status: 500 });
	}
};
