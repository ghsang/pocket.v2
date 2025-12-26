import { db } from '$lib/server/db';
import {
	budgetCategories,
	users,
	bankAccounts,
	expenses,
	depositItems,
	BUDGET_TYPES
} from '$lib/server/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

// 이번 달 시작일과 종료일
function getCurrentMonthRange() {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1; // 1-indexed
	const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
	return { startDate, endDate };
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return { categories: [], allUsers: [], accounts: [], budgetTypes: BUDGET_TYPES };
	}

	// Fetch all budget categories (shared between users)
	const categories = await db.query.budgetCategories.findMany({
		with: {
			account: true
		}
	});

	// 이번 달 카테고리별 지출 합계 조회
	const { startDate, endDate } = getCurrentMonthRange();
	const monthlyExpenses = await db
		.select({
			categoryId: expenses.categoryId,
			total: sql<number>`COALESCE(sum(${expenses.amount}), 0)`
		})
		.from(expenses)
		.where(and(gte(expenses.date, startDate), sql`${expenses.date} <= ${endDate}`))
		.groupBy(expenses.categoryId);

	// 이번 달 지출 맵
	const monthlyExpenseMap = new Map(monthlyExpenses.map((e) => [e.categoryId, Number(e.total)]));

	// 누적 입금액 (완료된 deposit_items 합계)
	const totalDeposits = await db
		.select({
			categoryId: depositItems.categoryId,
			total: sql<number>`COALESCE(sum(${depositItems.amount}), 0)`
		})
		.from(depositItems)
		.where(eq(depositItems.isCompleted, true))
		.groupBy(depositItems.categoryId);

	const depositMap = new Map(totalDeposits.map((d) => [d.categoryId, Number(d.total)]));

	// 누적 지출액 (전체 기간)
	const totalExpenses = await db
		.select({
			categoryId: expenses.categoryId,
			total: sql<number>`COALESCE(sum(${expenses.amount}), 0)`
		})
		.from(expenses)
		.groupBy(expenses.categoryId);

	const totalExpenseMap = new Map(totalExpenses.map((e) => [e.categoryId, Number(e.total)]));

	// Fetch all approved users (exclude dev user)
	const allUsers = await db.query.users.findMany({
		where: eq(users.isApproved, true)
	});
	const realUsers = allUsers.filter((u) => !u.kakaoId.startsWith('dev-'));

	// Fetch all bank accounts
	const accounts = await db.query.bankAccounts.findMany({
		orderBy: (bankAccounts, { asc }) => [asc(bankAccounts.bankName)]
	});

	// Sort categories: 생활비 -> 문화/여행비 -> 경조사비 -> 저축
	const typeOrder: Record<string, number> = {
		living: 0,
		cultural: 1,
		event: 2,
		savings: 3
	};

	const sortedCategories = categories
		.map((c) => {
			const initialBalance = Number(c.initialBalance) || 0;
			const totalDeposited = depositMap.get(c.id) || 0;
			const totalSpent = totalExpenseMap.get(c.id) || 0;
			// 잔액 = 초기 잔액 + 누적 입금 - 누적 지출
			const balance = initialBalance + totalDeposited - totalSpent;

			return {
				...c,
				allocatedAmount: Number(c.allocatedAmount),
				initialBalance,
				monthlySpent: monthlyExpenseMap.get(c.id) || 0, // 이번 달 지출
				totalDeposited, // 누적 입금
				totalSpent, // 누적 지출
				balance // 누적 잔액
			};
		})
		.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

	return {
		categories: sortedCategories,
		allUsers: realUsers.map((u) => ({
			id: u.id,
			username: u.username
		})),
		accounts,
		budgetTypes: BUDGET_TYPES
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const name = formData.get('name');
		const type = formData.get('type');
		const allocatedAmount = formData.get('allocatedAmount');
		const accountId = formData.get('accountId');
		const depositManager = formData.get('depositManager');

		if (!name || !type || !allocatedAmount) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		// Check for duplicate budget type (shared)
		const existing = await db.query.budgetCategories.findFirst({
			where: eq(budgetCategories.type, String(type) as 'event' | 'cultural' | 'savings' | 'living')
		});

		if (existing) {
			return fail(400, {
				error: `'${BUDGET_TYPES[type as keyof typeof BUDGET_TYPES]}' 예산이 이미 존재합니다.`
			});
		}

		try {
			await db.insert(budgetCategories).values({
				userId: user.id, // Keep track of who created it
				name: String(name),
				type: String(type) as 'event' | 'cultural' | 'savings' | 'living',
				allocatedAmount: String(allocatedAmount),
				accountId: accountId ? Number(accountId) : null,
				depositManager: depositManager ? String(depositManager) : null
			});

			return { success: true, message: '예산이 추가되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	},

	update: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');
		const name = formData.get('name');
		const type = formData.get('type');
		const allocatedAmount = formData.get('allocatedAmount');
		const accountId = formData.get('accountId');
		const depositManager = formData.get('depositManager');
		const initialBalance = formData.get('initialBalance');

		if (!id || !name || !type || !allocatedAmount) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			await db
				.update(budgetCategories)
				.set({
					name: String(name),
					type: String(type) as 'event' | 'cultural' | 'savings' | 'living',
					allocatedAmount: String(allocatedAmount),
					initialBalance: initialBalance ? String(initialBalance) : '0',
					accountId: accountId ? Number(accountId) : null,
					depositManager: depositManager ? String(depositManager) : null
				})
				.where(eq(budgetCategories.id, Number(id)));

			return { success: true, message: '수정되었습니다.' };
		} catch {
			return fail(500, { error: '수정 중 오류가 발생했습니다.' });
		}
	},

	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		try {
			await db.delete(budgetCategories).where(eq(budgetCategories.id, Number(id)));

			return { success: true };
		} catch {
			return fail(500, { error: '삭제 중 오류가 발생했습니다.' });
		}
	}
};
