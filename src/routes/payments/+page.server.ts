import { db } from '$lib/server/db';
import { paymentMethods, bankAccounts, users } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return { methods: [], accounts: [], currentUsername: '' };
	}

	// Load only current user's payment methods (owner = current username)
	const methods = await db.query.paymentMethods.findMany({
		where: eq(paymentMethods.owner, user.username),
		orderBy: (methods, { asc }) => [asc(methods.createdAt)]
	});

	// Fetch only current user's bank accounts for dropdown
	const accounts = await db.query.bankAccounts.findMany({
		where: eq(bankAccounts.accountHolder, user.username),
		orderBy: (bankAccounts, { asc }) => [asc(bankAccounts.bankName)]
	});

	return {
		methods: methods.map((m) => ({
			...m,
			isDefault: m.isDefault || false
		})),
		accounts,
		currentUsername: user.username
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
		const linkedAccount = formData.get('linkedAccount');
		const isDefault = formData.get('isDefault') === 'true';

		if (!name || !linkedAccount) {
			return fail(400, { error: '모든 필수 항목을 입력해주세요.' });
		}

		try {
			// If setting as default, unset other defaults for this user only
			if (isDefault) {
				await db
					.update(paymentMethods)
					.set({ isDefault: false })
					.where(eq(paymentMethods.owner, user.username));
			}

			await db.insert(paymentMethods).values({
				userId: user.id,
				name: String(name),
				linkedAccount: String(linkedAccount),
				owner: user.username, // 자동으로 현재 사용자로 설정
				isDefault
			});

			return { success: true, message: '결제 수단이 추가되었습니다.' };
		} catch {
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
		const linkedAccount = formData.get('linkedAccount');
		const isDefault = formData.get('isDefault') === 'true';

		if (!id || !name || !linkedAccount) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			// If setting as default, unset other defaults for this user only
			if (isDefault) {
				await db
					.update(paymentMethods)
					.set({ isDefault: false })
					.where(eq(paymentMethods.owner, user.username));
			}

			await db
				.update(paymentMethods)
				.set({
					name: String(name),
					linkedAccount: String(linkedAccount),
					isDefault
				})
				.where(and(eq(paymentMethods.id, Number(id)), eq(paymentMethods.owner, user.username)));

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
			// 자기 소유 결제 수단만 삭제 가능
			await db
				.delete(paymentMethods)
				.where(and(eq(paymentMethods.id, Number(id)), eq(paymentMethods.owner, user.username)));

			return { success: true };
		} catch {
			return fail(500, { error: '삭제 중 오류가 발생했습니다.' });
		}
	}
};
