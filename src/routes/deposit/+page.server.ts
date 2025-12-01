import { db } from '$lib/server/db';
import {
	budgetCategories,
	monthlyDeposits,
	depositItems,
	expenses,
	users,
	expenseSettlements,
	userCategoryAccounts,
	BUDGET_TYPES
} from '$lib/server/db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

// Helper functions
// 정산 대상월 = 지난달 (지난달 지출을 이번달에 정산)
function getTargetMonthStart(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // 0-indexed, so this is last month when we subtract nothing for "last month"
	// 지난달 1일
	const lastMonth = month === 0 ? 12 : month;
	const lastYear = month === 0 ? year - 1 : year;
	return `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`;
}

function getTargetMonthEnd(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // current month (0-indexed)
	// 지난달 마지막 날 = 이번달 0일
	const lastDay = new Date(year, month, 0).getDate();
	const lastMonth = month === 0 ? 12 : month;
	const lastYear = month === 0 ? year - 1 : year;
	return `${lastYear}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function getTargetMonthLabel(): string {
	const now = new Date();
	const month = now.getMonth();
	const lastMonth = month === 0 ? 12 : month;
	const lastYear = month === 0 ? now.getFullYear() - 1 : now.getFullYear();
	return `${lastYear}년 ${lastMonth}월`;
}

// Generate expense settlements when all deposits are completed
// 각 사용자가 각 카테고리에서 얼마나 지출했는지 계산하고,
// 해당 카테고리 계좌 담당자가 지출자에게 송금해야 하는 항목 생성
async function generateExpenseSettlements(month: string) {
	const monthEnd = new Date(month);
	monthEnd.setMonth(monthEnd.getMonth() + 1);
	monthEnd.setDate(0);
	const monthEndStr = monthEnd.toISOString().split('T')[0];

	// Check if settlements already exist for this month
	const existing = await db.query.expenseSettlements.findFirst({
		where: eq(expenseSettlements.month, month)
	});
	if (existing) return; // Already generated

	// Get all expenses for the target month with user info
	const monthExpenses = await db.query.expenses.findMany({
		where: and(gte(expenses.date, month), sql`${expenses.date} <= ${monthEndStr}`),
		with: {
			user: true,
			category: {
				with: {
					account: true
				}
			}
		}
	});

	// Group by category and user (who spent)
	const expensesByUserAndCategory: Record<
		string,
		{ categoryId: number; username: string; total: number; accountHolder: string | null }
	> = {};

	for (const expense of monthExpenses) {
		if (!expense.category || expense.category.type === 'savings') continue;

		const key = `${expense.categoryId}-${expense.user?.username}`;
		const accountHolder = expense.category.account?.accountHolder || null;

		if (!expensesByUserAndCategory[key]) {
			expensesByUserAndCategory[key] = {
				categoryId: expense.categoryId!,
				username: expense.user?.username || 'Unknown',
				total: 0,
				accountHolder
			};
		}
		expensesByUserAndCategory[key].total += Number(expense.amount);
	}

	// Create settlement records: 계좌 담당자 → 지출자
	const settlementsToCreate = [];
	for (const data of Object.values(expensesByUserAndCategory)) {
		// Skip if account holder is the same as the spender (자기가 자기 계좌에서 쓴 경우)
		if (!data.accountHolder || data.accountHolder === data.username) continue;

		settlementsToCreate.push({
			month,
			categoryId: data.categoryId,
			fromUser: data.accountHolder, // 송금자 (계좌 담당자)
			toUser: data.username, // 수신자 (지출한 사람)
			amount: String(data.total),
			isCompleted: false
		});
	}

	if (settlementsToCreate.length > 0) {
		await db.insert(expenseSettlements).values(settlementsToCreate);
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	const targetMonthStart = getTargetMonthStart();
	const targetMonthEnd = getTargetMonthEnd();

	// Check existing deposit for target month (지난달 정산)
	const existingDeposit = await db.query.monthlyDeposits.findFirst({
		where: and(eq(monthlyDeposits.userId, user.id), eq(monthlyDeposits.month, targetMonthStart)),
		with: {
			items: {
				with: {
					category: {
						with: {
							account: true
						}
					}
				}
			}
		}
	});

	// Fetch all budget categories (shared)
	const allCategories = await db.query.budgetCategories.findMany();

	// Filter categories where current user is the deposit manager
	// - 저축(savings)은 담당자가 없으므로 모든 사용자에게 표시
	// - 다른 카테고리는 depositManager가 현재 사용자인 경우만
	const userCategories = allCategories.filter(
		(c) => c.type === 'savings' || c.depositManager === user.username
	);

	// Calculate total non-savings budget (for user's categories only)
	const nonSavingsBudget = userCategories
		.filter((c) => c.type !== 'savings')
		.reduce((sum, c) => sum + Number(c.allocatedAmount), 0);
	// Get target month's spending by category (지난달 지출 - 전체 공유)
	const targetMonthExpenses = await db
		.select({
			categoryId: expenses.categoryId,
			categoryName: budgetCategories.name,
			categoryType: budgetCategories.type,
			total: sql<number>`COALESCE(sum(${expenses.amount}), 0)`
		})
		.from(expenses)
		.leftJoin(budgetCategories, eq(expenses.categoryId, budgetCategories.id))
		.where(and(gte(expenses.date, targetMonthStart), sql`${expenses.date} <= ${targetMonthEnd}`))
		.groupBy(expenses.categoryId, budgetCategories.name, budgetCategories.type);

	// Get all budget categories with account info for expense settlement
	const categoriesWithAccounts = await db.query.budgetCategories.findMany({
		with: {
			account: true
		}
	});

	// Check if all users have completed their deposits for this month
	const allDeposits = await db.query.monthlyDeposits.findMany({
		where: eq(monthlyDeposits.month, targetMonthStart),
		with: { items: true }
	});
	const allDepositsCompleted = allDeposits.length > 0 && allDeposits.every((d) => d.isCompleted);

	// Get expense settlements for this month (지출 정산 체크리스트)
	// 현재 사용자가 송금해야 하는 항목만 조회 (fromUser = 현재 사용자)
	const settlements = await db.query.expenseSettlements.findMany({
		where: and(
			eq(expenseSettlements.month, targetMonthStart),
			eq(expenseSettlements.fromUser, user.username)
		),
		with: {
			category: {
				with: {
					account: true
				}
			}
		}
	});

	// 받는 사람(toUser)들의 카테고리별 계좌 정보 조회
	// key: `${username}-${categoryId}`, value: { bankName, accountNumber, accountHolder }
	let receiverAccountMap = new Map<
		string,
		{ bankName: string; accountNumber: string; accountHolder: string }
	>();

	if (settlements.length > 0) {
		// 필요한 (username, categoryId) 쌍들 추출
		const pairs = settlements.map((s) => ({ username: s.toUser, categoryId: s.categoryId }));
		const uniqueUsernames = [...new Set(pairs.map((p) => p.username))];
		const uniqueCategoryIds = [...new Set(pairs.map((p) => p.categoryId))];

		const categoryAccounts = await db.query.userCategoryAccounts.findMany({
			where: and(
				inArray(userCategoryAccounts.username, uniqueUsernames),
				inArray(userCategoryAccounts.categoryId, uniqueCategoryIds)
			),
			with: {
				account: true
			}
		});

		receiverAccountMap = new Map(
			categoryAccounts
				.filter((a) => a.account)
				.map((a) => [
					`${a.username}-${a.categoryId}`,
					{
						bankName: a.account!.bankName,
						accountNumber: a.account!.accountNumber,
						accountHolder: a.account!.accountHolder
					}
				])
		);
	}

	// 정산 항목에 받는 사람의 카테고리별 계좌 정보 추가
	const userSettlements = settlements.map((s) => ({
		...s,
		amount: Number(s.amount),
		receiverAccount: receiverAccountMap.get(`${s.toUser}-${s.categoryId}`) || null
	}));

	// Get user's default deduction
	const currentUser = await db.query.users.findFirst({
		where: eq(users.id, user.id)
	});

	// Filter existing deposit items to only show user's responsible categories
	const filteredDeposit = existingDeposit
		? {
				...existingDeposit,
				salary: Number(existingDeposit.salary),
				totalBudget: Number(existingDeposit.totalBudget),
				savingsAmount: Number(existingDeposit.savingsAmount),
				items: existingDeposit.items
					.filter(
						(item) =>
							item.category?.type === 'savings' || item.category?.depositManager === user.username
					)
					.map((item) => ({
						...item,
						amount: Number(item.amount)
					}))
			}
		: null;

	return {
		existingDeposit: filteredDeposit,
		categories: userCategories.map((c) => ({
			...c,
			allocatedAmount: Number(c.allocatedAmount)
		})),
		nonSavingsBudget,
		targetMonthExpenses: targetMonthExpenses.map((e) => ({
			...e,
			total: Number(e.total)
		})),
		budgetTypes: BUDGET_TYPES,
		targetMonth: getTargetMonthLabel(),
		defaultDeduction: Number(currentUser?.defaultDeduction || 0),
		currentUsername: user.username,
		// 지출 정산 관련 데이터
		userSettlements,
		allDepositsCompleted
	};
};

export const actions: Actions = {
	createDeposit: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const salary = formData.get('salary');
		const deduction = formData.get('deduction') || '0';

		if (!salary || Number(salary) <= 0) {
			return fail(400, { error: '월급을 입력해주세요.' });
		}

		const targetMonthStart = getTargetMonthStart();

		// Check if deposit already exists for target month
		const existing = await db.query.monthlyDeposits.findFirst({
			where: and(eq(monthlyDeposits.userId, user.id), eq(monthlyDeposits.month, targetMonthStart))
		});

		if (existing) {
			return fail(400, { error: '해당 월 정산이 이미 존재합니다.' });
		}

		// Get all categories (shared)
		const allCategories = await db.query.budgetCategories.findMany();

		// Filter to user's responsible categories
		const userCategories = allCategories.filter(
			(c) => c.type === 'savings' || c.depositManager === user.username
		);

		// Calculate totals - 저축 = 월급 - 차감액
		const totalBudget = userCategories
			.filter((c) => c.type !== 'savings')
			.reduce((sum, c) => sum + Number(c.allocatedAmount), 0);
		const savingsAmount = Number(salary) - Number(deduction);

		try {
			// Create monthly deposit for target month (지난달)
			const [deposit] = await db
				.insert(monthlyDeposits)
				.values({
					userId: user.id,
					month: targetMonthStart,
					salary: String(salary),
					totalBudget: String(totalBudget),
					savingsAmount: String(Math.max(0, savingsAmount)),
					isCompleted: false
				})
				.returning();

			// Create deposit items only for user's responsible categories
			const depositItemsData = userCategories.map((cat) => ({
				depositId: deposit.id,
				categoryId: cat.id,
				amount: cat.type === 'savings' ? String(Math.max(0, savingsAmount)) : cat.allocatedAmount,
				isCompleted: false
			}));

			if (depositItemsData.length > 0) {
				await db.insert(depositItems).values(depositItemsData);
			}

			return { success: true, message: '정산이 생성되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	},

	completeItem: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const itemId = formData.get('itemId');
		const isCompleted = formData.get('isCompleted') === 'true';

		if (!itemId) {
			return fail(400, { error: '항목 ID가 필요합니다.' });
		}

		try {
			await db
				.update(depositItems)
				.set({
					isCompleted,
					completedAt: isCompleted ? new Date() : null
				})
				.where(eq(depositItems.id, Number(itemId)));

			// Check if all user's items are completed
			const targetMonthStart = getTargetMonthStart();
			const deposit = await db.query.monthlyDeposits.findFirst({
				where: and(
					eq(monthlyDeposits.userId, user.id),
					eq(monthlyDeposits.month, targetMonthStart)
				),
				with: {
					items: {
						with: {
							category: true
						}
					}
				}
			});

			if (deposit) {
				// Only check items that this user is responsible for
				const userItems = deposit.items.filter(
					(item) =>
						item.category?.type === 'savings' || item.category?.depositManager === user.username
				);
				const allCompleted = userItems.every((item) => item.isCompleted);
				if (allCompleted !== deposit.isCompleted) {
					await db
						.update(monthlyDeposits)
						.set({
							isCompleted: allCompleted,
							depositedAt: allCompleted ? new Date() : null
						})
						.where(eq(monthlyDeposits.id, deposit.id));

					// If all deposits are now completed, generate expense settlements
					if (allCompleted) {
						const allDeposits = await db.query.monthlyDeposits.findMany({
							where: eq(monthlyDeposits.month, targetMonthStart)
						});
						const everyoneCompleted = allDeposits.every((d) => d.isCompleted);

						if (everyoneCompleted) {
							await generateExpenseSettlements(targetMonthStart);
						}
					}
				}
			}

			return { success: true };
		} catch {
			return fail(500, { error: '업데이트 중 오류가 발생했습니다.' });
		}
	},

	updateSalary: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const salary = formData.get('salary');
		const deduction = formData.get('deduction') || '0';
		const depositId = formData.get('depositId');

		if (!salary || !depositId) {
			return fail(400, { error: '필수 정보가 누락되었습니다.' });
		}

		try {
			// Get all categories for recalculation (shared)
			const allCategories = await db.query.budgetCategories.findMany();

			// Filter to user's responsible categories
			const userCategories = allCategories.filter(
				(c) => c.type === 'savings' || c.depositManager === user.username
			);

			const totalBudget = userCategories
				.filter((c) => c.type !== 'savings')
				.reduce((sum, c) => sum + Number(c.allocatedAmount), 0);
			// 저축 = 월급 - 차감액
			const savingsAmount = Number(salary) - Number(deduction);

			// Update deposit
			await db
				.update(monthlyDeposits)
				.set({
					salary: String(salary),
					savingsAmount: String(Math.max(0, savingsAmount))
				})
				.where(and(eq(monthlyDeposits.id, Number(depositId)), eq(monthlyDeposits.userId, user.id)));

			// Update savings category item amount
			const savingsCategory = userCategories.find((c) => c.type === 'savings');
			if (savingsCategory) {
				await db
					.update(depositItems)
					.set({ amount: String(Math.max(0, savingsAmount)) })
					.where(
						and(
							eq(depositItems.depositId, Number(depositId)),
							eq(depositItems.categoryId, savingsCategory.id)
						)
					);
			}

			return { success: true, message: '월급이 업데이트되었습니다.' };
		} catch {
			return fail(500, { error: '업데이트 중 오류가 발생했습니다.' });
		}
	},

	completeSettlement: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const settlementId = formData.get('settlementId');
		const isCompleted = formData.get('isCompleted') === 'true';

		if (!settlementId) {
			return fail(400, { error: '정산 ID가 필요합니다.' });
		}

		try {
			await db
				.update(expenseSettlements)
				.set({
					isCompleted,
					completedAt: isCompleted ? new Date() : null
				})
				.where(eq(expenseSettlements.id, Number(settlementId)));

			return { success: true };
		} catch {
			return fail(500, { error: '업데이트 중 오류가 발생했습니다.' });
		}
	},

	resetDeposit: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const depositId = formData.get('depositId');

		if (!depositId) {
			return fail(400, { error: '예산 입금 ID가 필요합니다.' });
		}

		try {
			// Get the deposit to find the month
			const deposit = await db.query.monthlyDeposits.findFirst({
				where: and(eq(monthlyDeposits.id, Number(depositId)), eq(monthlyDeposits.userId, user.id))
			});

			if (!deposit) {
				return fail(404, { error: '정산을 찾을 수 없습니다.' });
			}

			// Delete expense settlements for this month
			await db.delete(expenseSettlements).where(eq(expenseSettlements.month, deposit.month));

			// Delete all deposit items
			await db.delete(depositItems).where(eq(depositItems.depositId, Number(depositId)));

			// Then delete the deposit itself
			await db
				.delete(monthlyDeposits)
				.where(and(eq(monthlyDeposits.id, Number(depositId)), eq(monthlyDeposits.userId, user.id)));

			return { success: true, message: '예산 입금이 초기화되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '초기화 중 오류가 발생했습니다.' });
		}
	}
};
