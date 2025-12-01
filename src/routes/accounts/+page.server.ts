import { db } from '$lib/server/db';
import { bankAccounts, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { accounts: [], holders: [] };
	}

	const accounts = await db.query.bankAccounts.findMany({
		orderBy: (bankAccounts, { asc }) => [asc(bankAccounts.bankName)]
	});

	// Get the two real users (exclude dev user)
	const allUsers = await db.query.users.findMany({
		where: eq(users.isApproved, true)
	});
	const holders = allUsers.filter((u) => !u.kakaoId.startsWith('dev-')).map((u) => u.username);

	return { accounts, holders };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const bankName = formData.get('bankName');
		const accountNumber = formData.get('accountNumber');
		const accountHolder = formData.get('accountHolder');
		const alias = formData.get('alias');

		if (!bankName || !accountNumber || !accountHolder) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			await db.insert(bankAccounts).values({
				bankName: String(bankName),
				accountNumber: String(accountNumber),
				accountHolder: String(accountHolder),
				alias: alias ? String(alias) : null
			});

			return { success: true, message: '계좌가 추가되었습니다.' };
		} catch (e) {
			console.error(e);
			return fail(500, { error: '저장 중 오류가 발생했습니다.' });
		}
	},

	update: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');
		const bankName = formData.get('bankName');
		const accountNumber = formData.get('accountNumber');
		const accountHolder = formData.get('accountHolder');
		const alias = formData.get('alias');

		if (!id || !bankName || !accountNumber || !accountHolder) {
			return fail(400, { error: '필수 항목을 입력해주세요.' });
		}

		try {
			await db
				.update(bankAccounts)
				.set({
					bankName: String(bankName),
					accountNumber: String(accountNumber),
					accountHolder: String(accountHolder),
					alias: alias ? String(alias) : null
				})
				.where(eq(bankAccounts.id, Number(id)));

			return { success: true, message: '수정되었습니다.' };
		} catch {
			return fail(500, { error: '수정 중 오류가 발생했습니다.' });
		}
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: '로그인이 필요합니다.' });
		}

		const formData = await request.formData();
		const id = formData.get('id');

		if (!id) {
			return fail(400, { error: 'ID가 필요합니다.' });
		}

		try {
			await db.delete(bankAccounts).where(eq(bankAccounts.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: '삭제 중 오류가 발생했습니다.' });
		}
	}
};
