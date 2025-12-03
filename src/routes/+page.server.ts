import { db } from '$lib/server/db';
import { budgetCategories, paymentMethods, expenses } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq, sql, and, gte } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

// Helper to get current month's first day
function getCurrentMonthStart(): string {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return {
			categories: [],
			paymentMethods: []
		};
	}

	const monthStart = getCurrentMonthStart();

	// Fetch all budget categories (shared)
	const allCategories = await db.query.budgetCategories.findMany();

	// Fetch payment methods owned by current user
	const methods = await db.query.paymentMethods.findMany({
		where: eq(paymentMethods.owner, user.username)
	});

	// Calculate usage for this month per category (all users' expenses)
	const usage = await db
		.select({
			categoryId: expenses.categoryId,
			total: sql<number>`COALESCE(sum(${expenses.amount}), 0)`
		})
		.from(expenses)
		.where(gte(expenses.date, monthStart))
		.groupBy(expenses.categoryId);

	// Map usage to categories
	const categoriesWithUsage = allCategories.map((cat) => {
		const used = usage.find((u) => u.categoryId === cat.id)?.total || 0;
		return {
			...cat,
			used: Number(used),
			allocatedAmount: Number(cat.allocatedAmount)
		};
	});

	return {
		categories: categoriesWithUsage,
		paymentMethods: methods,
		user: { id: user.id, username: user.username }
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const amount = formData.get('amount');
		const description = formData.get('description');
		const categoryId = formData.get('categoryId');
		const paymentMethodId = formData.get('paymentMethodId');
		const date = formData.get('date');

		if (!amount || !categoryId || !paymentMethodId || !date) {
			return fail(400, { error: '모든 필수 항목을 입력해주세요.' });
		}

		try {
			await db.insert(expenses).values({
				userId: user.id, // Keep track of who created it
				amount: String(amount),
				description: String(description || ''),
				categoryId: Number(categoryId),
				paymentMethodId: Number(paymentMethodId),
				date: String(date)
			});
			return { success: true, message: '지출이 등록되었습니다!' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	}
};
