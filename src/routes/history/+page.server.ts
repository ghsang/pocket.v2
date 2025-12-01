import { db } from '$lib/server/db';
import { expenses } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return { initialExpenses: [] };
	}

	// Load all expenses (shared between users)
	const initialExpenses = await db.query.expenses.findMany({
		orderBy: [desc(expenses.date), desc(expenses.createdAt)],
		limit: 20,
		with: {
			category: true,
			paymentMethod: true,
			user: true
		}
	});

	return {
		initialExpenses: initialExpenses.map((e) => ({
			...e,
			amount: Number(e.amount)
		}))
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');

		if (!id) return fail(400, { error: '지출 ID가 필요합니다.' });

		try {
			// Shared: anyone can delete
			await db.delete(expenses).where(eq(expenses.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: '삭제 중 오류가 발생했습니다.' });
		}
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');
		const amount = formData.get('amount');
		const description = formData.get('description');
		const date = formData.get('date');
		const categoryId = formData.get('categoryId');
		const paymentMethodId = formData.get('paymentMethodId');

		if (!id || !amount || !date) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			// Shared: anyone can update
			await db
				.update(expenses)
				.set({
					amount: String(amount),
					description: String(description || ''),
					date: String(date),
					categoryId: categoryId ? Number(categoryId) : null,
					paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null
				})
				.where(eq(expenses.id, Number(id)));

			return { success: true, message: '수정되었습니다.' };
		} catch {
			return fail(500, { error: '수정 중 오류가 발생했습니다.' });
		}
	}
};
