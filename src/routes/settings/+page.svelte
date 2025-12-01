<script lang="ts">
	import { enhance } from '$app/forms';
	import { fly, fade } from 'svelte/transition';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let showMessage = $state(false);
	let editingUser = $state<(typeof data.users)[0] | null>(null);
	let editDeduction = $state('');

	// Category account editing
	let editingCategory = $state<(typeof data.categories)[0] | null>(null);
	let selectedAccountId = $state('');

	// Type icons
	const typeIcons: Record<string, string> = {
		event: '🎉',
		cultural: '🎭',
		savings: '💰',
		living: '🏠'
	};

	// Auto-dismiss message
	$effect(() => {
		if (form?.success || form?.error) {
			showMessage = true;
			const timer = setTimeout(() => {
				showMessage = false;
			}, 2000);
			return () => clearTimeout(timer);
		}
	});

	function formatCurrency(value: string | number): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('ko-KR').format(num);
	}

	function openEdit(user: (typeof data.users)[0]) {
		editingUser = user;
		editDeduction = user.defaultDeduction;
	}

	function closeEdit() {
		editingUser = null;
		editDeduction = '';
	}

	function openCategoryEdit(category: (typeof data.categories)[0]) {
		editingCategory = category;
		const existing = data.categoryAccounts?.find((a) => a.categoryId === category.id);
		selectedAccountId = existing?.accountId?.toString() || '';
	}

	function closeCategoryEdit() {
		editingCategory = null;
		selectedAccountId = '';
	}

	function handleUpdate() {
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				closeEdit();
			}
			await update();
		};
	}

	function handleCategoryUpdate() {
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				closeCategoryEdit();
			}
			await update();
		};
	}

	// Get account info for a category
	function getCategoryAccount(categoryId: number) {
		return data.categoryAccounts?.find((a) => a.categoryId === categoryId);
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-900">설정</h2>
		<p class="text-sm text-gray-500">개인 설정을 관리합니다</p>
	</div>

	<!-- Deduction Settings -->
	<div class="mb-6">
		<h3 class="mb-3 text-lg font-bold text-gray-800">기본 차감액</h3>
		<p class="mb-4 text-sm text-gray-500">
			매월 고정 지출 (카드값, 보험료 등)을 설정하면<br />
			저축 금액이 자동으로 계산됩니다.
		</p>

		<div class="space-y-3">
			{#each data.users as user, i (user.id)}
				<div
					class="card-hover flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
					in:fly={{ y: 20, duration: 300, delay: i * 50 }}
				>
					<div>
						<p class="font-bold text-gray-900">{user.username}</p>
						<p class="text-sm text-gray-500">
							차감액: <span class="font-medium text-gray-700"
								>{formatCurrency(user.defaultDeduction)}원</span
							>
						</p>
					</div>
					<button
						onclick={() => openEdit(user)}
						class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
					>
						수정
					</button>
				</div>
			{/each}

			{#if data.users.length === 0}
				<div class="py-12 text-center" in:fade>
					<div class="mb-4 text-6xl">⚙️</div>
					<p class="text-gray-400">등록된 사용자가 없습니다.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Category Accounts Settings -->
	<div class="mb-6">
		<h3 class="mb-3 text-lg font-bold text-gray-800">카테고리별 입금 계좌</h3>
		<p class="mb-4 text-sm text-gray-500">
			지출 정산 시 각 카테고리별로 입금받을 계좌를 설정합니다.
		</p>

		<div class="space-y-3">
			{#each data.categories ?? [] as category, i (category.id)}
				{@const account = getCategoryAccount(category.id)}
				<div
					class="card-hover flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
					in:fly={{ y: 20, duration: 300, delay: i * 50 }}
				>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="text-lg">{typeIcons[category.type]}</span>
							<p class="font-bold text-gray-900">{category.name}</p>
						</div>
						{#if account}
							<p class="mt-1 text-sm text-gray-500">
								{account.bankName}
								<span class="font-medium text-gray-700">{account.accountNumber}</span>
							</p>
						{:else}
							<p class="mt-1 text-sm text-gray-400">계좌 미설정</p>
						{/if}
					</div>
					<button
						onclick={() => openCategoryEdit(category)}
						class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
					>
						{account ? '수정' : '설정'}
					</button>
				</div>
			{/each}

			{#if !data.categories || data.categories.length === 0}
				<div class="py-8 text-center" in:fade>
					<p class="text-gray-400">등록된 예산 카테고리가 없습니다.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Info Box -->
	<div class="rounded-xl border border-blue-100 bg-blue-50 p-4">
		<div class="flex items-start gap-3">
			<span class="text-xl">💡</span>
			<div class="text-sm text-blue-800">
				<p class="font-medium">차감액이란?</p>
				<p class="mt-1 text-blue-600">
					월급에서 별도 입금 없이 자동으로 빠지는 고정 지출입니다.<br />
					예: 카드값, 보험료, 청약 등
				</p>
				<p class="mt-2 text-blue-600">
					<strong>저축 = 월급 - 차감액</strong>
				</p>
			</div>
		</div>
	</div>

	<!-- Info Box for Category Accounts -->
	<div class="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
		<div class="flex items-start gap-3">
			<span class="text-xl">💸</span>
			<div class="text-sm text-green-800">
				<p class="font-medium">카테고리별 입금 계좌란?</p>
				<p class="mt-1 text-green-600">
					다른 사람이 특정 예산에서 지출하면, 해당 예산 담당자가<br />
					지출자의 카테고리별 계좌로 송금합니다.
				</p>
			</div>
		</div>
	</div>

	<!-- Success/Error Messages -->
	{#if showMessage && form?.success}
		<div
			class="fixed right-4 bottom-24 left-4 rounded-lg bg-green-500 p-3 text-center text-white shadow-lg"
			transition:fly={{ y: 50, duration: 300 }}
		>
			{form.message || '완료되었습니다.'}
		</div>
	{/if}

	{#if showMessage && form?.error}
		<div
			class="fixed right-4 bottom-24 left-4 rounded-lg bg-red-500 p-3 text-center text-white shadow-lg"
			transition:fly={{ y: 50, duration: 300 }}
		>
			{form.error}
		</div>
	{/if}
</div>

<!-- Category Account Edit Modal -->
{#if editingCategory}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		transition:fade={{ duration: 200 }}
	>
		<button class="absolute inset-0" onclick={closeCategoryEdit} aria-label="닫기"></button>
		<div
			class="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
			transition:fly={{ y: 100, duration: 300 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-xl">{typeIcons[editingCategory.type]}</span>
					<h3 class="text-lg font-bold">{editingCategory.name} 입금 계좌</h3>
				</div>
				<button
					onclick={closeCategoryEdit}
					class="text-gray-400 hover:text-gray-600"
					aria-label="닫기"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<p class="mb-4 text-sm text-gray-500">
				{editingCategory.name} 예산에서 지출 후 정산받을 계좌를 선택하세요.
			</p>

			<form
				method="POST"
				action="?/updateCategoryAccount"
				use:enhance={handleCategoryUpdate}
				class="space-y-4"
			>
				<input type="hidden" name="categoryId" value={editingCategory.id} />

				<div>
					<label for="select-account" class="mb-1 block text-sm font-medium text-gray-700">
						입금받을 계좌
					</label>
					{#if data.bankAccounts && data.bankAccounts.length > 0}
						<select
							id="select-account"
							name="accountId"
							bind:value={selectedAccountId}
							required
							class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
						>
							<option value="">계좌를 선택하세요</option>
							{#each data.bankAccounts as account (account.id)}
								<option value={account.id}>
									{account.bankName}
									{account.accountNumber} ({account.accountHolder})
								</option>
							{/each}
						</select>
					{:else}
						<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
							<p>등록된 계좌가 없습니다.</p>
							<a href="/accounts" class="mt-1 inline-block font-medium text-amber-800 underline">
								계좌 관리에서 계좌를 먼저 등록하세요
							</a>
						</div>
					{/if}
				</div>

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeCategoryEdit}
						class="flex-1 rounded-lg border border-gray-200 py-3 font-medium"
					>
						취소
					</button>
					<button
						type="submit"
						disabled={!selectedAccountId || !data.bankAccounts?.length}
						class="flex-1 rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50"
					>
						저장
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if editingUser}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		transition:fade={{ duration: 200 }}
	>
		<button class="absolute inset-0" onclick={closeEdit} aria-label="닫기"></button>
		<div
			class="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
			transition:fly={{ y: 100, duration: 300 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold">{editingUser.username} 차감액 수정</h3>
				<button onclick={closeEdit} class="text-gray-400 hover:text-gray-600" aria-label="닫기">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<form method="POST" action="?/updateDeduction" use:enhance={handleUpdate} class="space-y-4">
				<input type="hidden" name="userId" value={editingUser.id} />

				<div>
					<label for="edit-deduction" class="mb-1 block text-sm font-medium text-gray-700">
						기본 차감액
					</label>
					<div class="relative">
						<input
							id="edit-deduction"
							type="number"
							name="defaultDeduction"
							bind:value={editDeduction}
							required
							min="0"
							step="1000"
							placeholder="0"
							class="w-full rounded-lg border border-gray-200 p-3 pr-10 focus:ring-2 focus:ring-black focus:outline-none"
						/>
						<span class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400">원</span>
					</div>
					<p class="mt-1 text-xs text-gray-400">카드값, 보험료 등 고정 지출 합계</p>
				</div>

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeEdit}
						class="flex-1 rounded-lg border border-gray-200 py-3 font-medium"
					>
						취소
					</button>
					<button type="submit" class="flex-1 rounded-lg bg-black py-3 font-medium text-white">
						저장
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
