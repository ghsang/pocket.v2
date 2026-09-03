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
import { getSettlementMonth } from '$lib/server/settlement-month';
import type { PageServerLoad, Actions } from './$types';

type GeneratedSettlement = {
	month: string;
	categoryId: number;
	fromUser: string;
	toUser: string;
	amount: string;
	isCompleted: boolean;
};

function getSettlementKey(settlement: {
	categoryId: number;
	fromUser: string;
	toUser: string;
}): string {
	return JSON.stringify([settlement.categoryId, settlement.fromUser, settlement.toUser]);
}

// Reconcile expense settlements for the target month.
// 각 사용자가 각 카테고리에서 얼마나 지출했는지 계산하고,
// 해당 카테고리 계좌 담당자가 지출자에게 송금해야 하는 항목 생성
async function generateExpenseSettlements(month: string, monthEnd: string) {
	await db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${`expense-settlements:${month}`}))`
		);

		// Get all expenses after taking the month lock so concurrent loads reconcile in order.
		const monthExpenses = await tx.query.expenses.findMany({
			where: and(gte(expenses.date, month), sql`${expenses.date} <= ${monthEnd}`),
			with: {
				user: true,
				category: {
					with: {
						account: true
					}
				},
				paymentMethod: true
			}
		});

		// Group by category and user (who spent)
		const expensesByUserAndCategory: Record<
			string,
			{ categoryId: number; username: string; total: number; accountHolder: string | null }
		> = {};

		for (const expense of monthExpenses) {
			if (!expense.category || expense.category.type === 'savings') continue;

			// 결제수단의 연결 계좌가 카테고리 예산 계좌와 동일하면 정산 제외
			// (이미 예산 계좌에서 직접 출금되었으므로 송금이 불필요)
			if (
				expense.paymentMethod &&
				expense.category.accountId &&
				expense.paymentMethod.accountId === expense.category.accountId
			) {
				continue;
			}

			const key = JSON.stringify([expense.categoryId, expense.user?.username]);
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
		// 담당자 자신도 포함 (예산 계좌 → 개인 계좌로 송금)
		const generatedSettlements: GeneratedSettlement[] = [];
		for (const data of Object.values(expensesByUserAndCategory)) {
			if (!data.accountHolder) continue;

			generatedSettlements.push({
				month,
				categoryId: data.categoryId,
				fromUser: data.accountHolder,
				toUser: data.username,
				amount: data.total.toFixed(2),
				isCompleted: false
			});
		}

		// Preserve IDs only when both the business key and amount are unchanged.
		// A changed amount gets a new ID so a previously checked local item is shown again.
		const existingSettlements = await tx
			.select()
			.from(expenseSettlements)
			.where(eq(expenseSettlements.month, month));
		const existingByKey = new Map<string, (typeof existingSettlements)[number]>();

		for (const settlement of existingSettlements) {
			const key = getSettlementKey(settlement);
			if (!existingByKey.has(key)) {
				existingByKey.set(key, settlement);
			}
		}

		const preservedIds = new Set<number>();
		const replacedIds = new Set<number>();
		for (const settlement of generatedSettlements) {
			const existing = existingByKey.get(getSettlementKey(settlement));
			if (existing?.amount === settlement.amount) {
				preservedIds.add(existing.id);
			} else {
				if (existing) {
					replacedIds.add(existing.id);
					await tx.delete(expenseSettlements).where(eq(expenseSettlements.id, existing.id));
				}
				await tx.insert(expenseSettlements).values(settlement);
			}
		}

		const obsoleteIds = existingSettlements
			.filter((settlement) => !preservedIds.has(settlement.id) && !replacedIds.has(settlement.id))
			.map((settlement) => settlement.id);
		if (obsoleteIds.length > 0) {
			await tx.delete(expenseSettlements).where(inArray(expenseSettlements.id, obsoleteIds));
		}
	});
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		throw redirect(302, '/login');
	}

	const targetMonth = getSettlementMonth();

	// Check existing deposit for target month (지난달 정산)
	const existingDeposit = await db.query.monthlyDeposits.findFirst({
		where: and(eq(monthlyDeposits.userId, user.id), eq(monthlyDeposits.month, targetMonth.start)),
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
		.where(and(gte(expenses.date, targetMonth.start), sql`${expenses.date} <= ${targetMonth.end}`))
		.groupBy(expenses.categoryId, budgetCategories.name, budgetCategories.type);

	// Check if all users have completed their deposits for this month
	const allDeposits = await db.query.monthlyDeposits.findMany({
		where: eq(monthlyDeposits.month, targetMonth.start),
		with: { items: true }
	});
	const allDepositsCompleted = allDeposits.length > 0 && allDeposits.every((d) => d.isCompleted);

	// 지출 정산 항목을 최신 지출 내역과 동기화
	await generateExpenseSettlements(targetMonth.start, targetMonth.end);

	// Get expense settlements for this month (지출 정산 체크리스트)
	// 현재 사용자가 송금해야 하는 항목만 조회 (fromUser = 현재 사용자)
	const settlements = await db.query.expenseSettlements.findMany({
		where: and(
			eq(expenseSettlements.month, targetMonth.start),
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
		targetMonth: targetMonth.label,
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

		const targetMonth = getSettlementMonth();

		// Check if deposit already exists for target month
		const existing = await db.query.monthlyDeposits.findFirst({
			where: and(eq(monthlyDeposits.userId, user.id), eq(monthlyDeposits.month, targetMonth.start))
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
			await db.transaction(async (tx) => {
				// Create monthly deposit for target month (지난달)
				const [deposit] = await tx
					.insert(monthlyDeposits)
					.values({
						userId: user.id,
						month: targetMonth.start,
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
					await tx.insert(depositItems).values(depositItemsData);
				}
			});

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
		const itemId = Number(formData.get('itemId'));
		const completionValue = formData.get('isCompleted');

		if (!Number.isInteger(itemId) || itemId <= 0) {
			return fail(400, { error: '올바른 항목 ID가 필요합니다.' });
		}
		if (completionValue !== 'true' && completionValue !== 'false') {
			return fail(400, { error: '올바른 완료 상태가 필요합니다.' });
		}
		const isCompleted = completionValue === 'true';
		const targetMonth = getSettlementMonth();

		try {
			const updated = await db.transaction(async (tx) => {
				const item = await tx.query.depositItems.findFirst({
					where: eq(depositItems.id, itemId),
					with: {
						deposit: true,
						category: true
					}
				});

				const isResponsibleCategory =
					item?.category?.type === 'savings' || item?.category?.depositManager === user.username;
				if (
					!item?.deposit ||
					item.deposit.userId !== user.id ||
					item.deposit.month !== targetMonth.start ||
					!isResponsibleCategory
				) {
					return false;
				}
				const [lockedDeposit] = await tx
					.select({ id: monthlyDeposits.id })
					.from(monthlyDeposits)
					.where(
						and(
							eq(monthlyDeposits.id, item.depositId),
							eq(monthlyDeposits.userId, user.id),
							eq(monthlyDeposits.month, targetMonth.start)
						)
					)
					.for('update');
				if (!lockedDeposit) {
					return false;
				}

				await tx
					.update(depositItems)
					.set({
						isCompleted,
						completedAt: isCompleted ? new Date() : null
					})
					.where(and(eq(depositItems.id, itemId), eq(depositItems.depositId, item.depositId)));

				const deposit = await tx.query.monthlyDeposits.findFirst({
					where: and(
						eq(monthlyDeposits.id, item.depositId),
						eq(monthlyDeposits.userId, user.id),
						eq(monthlyDeposits.month, targetMonth.start)
					),
					with: {
						items: {
							with: { category: true }
						}
					}
				});

				if (!deposit) {
					return false;
				}

				const userItems = deposit.items.filter(
					(item) =>
						item.category?.type === 'savings' || item.category?.depositManager === user.username
				);
				const allCompleted = userItems.length > 0 && userItems.every((item) => item.isCompleted);
				if (allCompleted !== deposit.isCompleted) {
					await tx
						.update(monthlyDeposits)
						.set({
							isCompleted: allCompleted,
							depositedAt: allCompleted ? new Date() : null
						})
						.where(eq(monthlyDeposits.id, deposit.id));
				}

				return true;
			});

			if (!updated) {
				return fail(404, {
					error: '현재 월 정산 항목을 찾을 수 없습니다. 화면을 새로고침해주세요.'
				});
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
		const salary = Number(formData.get('salary'));
		const deduction = Number(formData.get('deduction') || 0);
		const depositId = Number(formData.get('depositId'));

		if (
			!Number.isFinite(salary) ||
			salary <= 0 ||
			!Number.isFinite(deduction) ||
			deduction < 0 ||
			!Number.isInteger(depositId) ||
			depositId <= 0
		) {
			return fail(400, { error: '올바른 월급과 차감액을 입력해주세요.' });
		}
		const targetMonth = getSettlementMonth();

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

			const savingsCategory = userCategories.find((c) => c.type === 'savings');
			const updated = await db.transaction(async (tx) => {
				const deposits = await tx
					.update(monthlyDeposits)
					.set({
						salary: String(salary),
						totalBudget: String(totalBudget),
						savingsAmount: String(Math.max(0, savingsAmount))
					})
					.where(
						and(
							eq(monthlyDeposits.id, depositId),
							eq(monthlyDeposits.userId, user.id),
							eq(monthlyDeposits.month, targetMonth.start)
						)
					)
					.returning({ id: monthlyDeposits.id });

				if (deposits.length === 0) {
					return false;
				}

				if (savingsCategory) {
					await tx
						.update(depositItems)
						.set({ amount: String(Math.max(0, savingsAmount)) })
						.where(
							and(
								eq(depositItems.depositId, depositId),
								eq(depositItems.categoryId, savingsCategory.id)
							)
						);
				}

				return true;
			});

			if (!updated) {
				return fail(404, {
					error: '현재 월 정산을 찾을 수 없습니다. 화면을 새로고침해주세요.'
				});
			}

			return { success: true, message: '월급이 업데이트되었습니다.' };
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
		const depositId = Number(formData.get('depositId'));

		if (!Number.isInteger(depositId) || depositId <= 0) {
			return fail(400, { error: '올바른 예산 입금 ID가 필요합니다.' });
		}
		const targetMonth = getSettlementMonth();

		try {
			const deleted = await db.transaction(async (tx) => {
				const [deposit] = await tx
					.select({ id: monthlyDeposits.id })
					.from(monthlyDeposits)
					.where(
						and(
							eq(monthlyDeposits.id, depositId),
							eq(monthlyDeposits.userId, user.id),
							eq(monthlyDeposits.month, targetMonth.start)
						)
					)
					.for('update');

				if (!deposit) {
					return false;
				}

				await tx.delete(depositItems).where(eq(depositItems.depositId, depositId));
				await tx
					.delete(monthlyDeposits)
					.where(and(eq(monthlyDeposits.id, depositId), eq(monthlyDeposits.userId, user.id)));

				return true;
			});

			if (!deleted) {
				return fail(404, {
					error: '현재 월 정산을 찾을 수 없습니다. 화면을 새로고침해주세요.'
				});
			}

			return { success: true, message: '예산 입금이 초기화되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '초기화 중 오류가 발생했습니다.' });
		}
	}
};
