import { db } from '$lib/server/db';
import {
	users,
	budgetCategories,
	userCategoryAccounts,
	bankAccounts,
	BUDGET_TYPES
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { users: [], categories: [], categoryAccounts: [], bankAccounts: [] };
	}

	// Get the two real users (exclude dev user)
	const allUsers = await db.query.users.findMany({
		where: eq(users.isApproved, true)
	});
	const realUsers = allUsers.filter((u) => !u.kakaoId.startsWith('dev-'));

	// Get all budget categories (excluding savings)
	const categories = await db.query.budgetCategories.findMany();
	const nonSavingsCategories = categories.filter((c) => c.type !== 'savings');

	// Get current user's category accounts with bank account info
	const categoryAccounts = await db.query.userCategoryAccounts.findMany({
		where: eq(userCategoryAccounts.username, locals.user.username),
		with: {
			account: true
		}
	});

	// Get current user's bank accounts only (by account_holder = username)
	const userBankAccounts = await db.query.bankAccounts.findMany({
		where: eq(bankAccounts.accountHolder, locals.user.username)
	});

	return {
		users: realUsers.map((u) => ({
			id: u.id,
			username: u.username,
			defaultDeduction: u.defaultDeduction ?? '0'
		})),
		categories: nonSavingsCategories.map((c) => ({
			id: c.id,
			name: c.name,
			type: c.type
		})),
		categoryAccounts: categoryAccounts.map((a) => ({
			id: a.id,
			categoryId: a.categoryId,
			accountId: a.accountId,
			bankName: a.account?.bankName,
			accountNumber: a.account?.accountNumber,
			accountHolder: a.account?.accountHolder
		})),
		bankAccounts: userBankAccounts.map((a) => ({
			id: a.id,
			bankName: a.bankName,
			accountNumber: a.accountNumber,
			accountHolder: a.accountHolder,
			alias: a.alias
		})),
		budgetTypes: BUDGET_TYPES,
		currentUsername: locals.user.username
	};
};

export const actions: Actions = {
	updateDeduction: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId');
		const defaultDeduction = formData.get('defaultDeduction');

		if (!userId || defaultDeduction === null) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			await db
				.update(users)
				.set({
					defaultDeduction: String(defaultDeduction),
					updatedAt: new Date()
				})
				.where(eq(users.id, Number(userId)));

			return { success: true, message: '차감액이 저장되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	},

	updateCategoryAccount: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const categoryId = formData.get('categoryId');
		const accountId = formData.get('accountId');

		if (!categoryId || !accountId) {
			return fail(400, { error: '계좌를 선택해주세요.' });
		}

		try {
			// Upsert: 있으면 업데이트, 없으면 생성
			const existing = await db.query.userCategoryAccounts.findFirst({
				where: and(
					eq(userCategoryAccounts.username, locals.user.username),
					eq(userCategoryAccounts.categoryId, Number(categoryId))
				)
			});

			if (existing) {
				await db
					.update(userCategoryAccounts)
					.set({
						accountId: Number(accountId),
						updatedAt: new Date()
					})
					.where(eq(userCategoryAccounts.id, existing.id));
			} else {
				await db.insert(userCategoryAccounts).values({
					username: locals.user.username,
					categoryId: Number(categoryId),
					accountId: Number(accountId)
				});
			}

			return { success: true, message: '계좌 정보가 저장되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	}
};
