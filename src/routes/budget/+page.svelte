<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let showAddForm = $state(false);
	let editingCategory = $state<(typeof data.categories)[0] | null>(null);
	let showMessage = $state(false);

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

	// Form state
	let newCategory = $state({
		name: '',
		type: 'living' as keyof typeof data.budgetTypes,
		allocatedAmount: '',
		accountId: '',
		depositManager: ''
	});

	// Calculate total budget
	let totalBudget = $derived(data.categories.reduce((sum, cat) => sum + cat.allocatedAmount, 0));

	// Get existing budget types
	let existingTypes = $derived(new Set(data.categories.map((c) => c.type)));

	// Budget type colors
	const typeColors: Record<string, string> = {
		event: 'bg-purple-100 text-purple-800',
		cultural: 'bg-blue-100 text-blue-800',
		savings: 'bg-green-100 text-green-800',
		living: 'bg-orange-100 text-orange-800'
	};

	// Budget type icons
	const typeIcons: Record<string, string> = {
		event: '🎉',
		cultural: '🎭',
		savings: '💰',
		living: '🏠'
	};

	// Get first available (non-existing) type
	function getFirstAvailableType(): keyof typeof data.budgetTypes {
		const types = ['living', 'event', 'cultural', 'savings'] as const;
		return types.find((t) => !existingTypes.has(t)) || 'living';
	}

	function openAddForm() {
		const availableType = getFirstAvailableType();
		newCategory = {
			name: data.budgetTypes[availableType],
			type: availableType,
			allocatedAmount: '',
			accountId: '',
			depositManager: ''
		};
		showAddForm = true;
	}

	function resetForm() {
		showAddForm = false;
	}

	function openEdit(category: (typeof data.categories)[0]) {
		editingCategory = { ...category };
	}

	function closeEdit() {
		editingCategory = null;
	}

	function handleCreate() {
		return async ({ result }: { result: any }) => {
			if (result.type === 'success') {
				resetForm();
				await invalidateAll();
			}
		};
	}

	function handleUpdate() {
		return async ({ result }: { result: any }) => {
			if (result.type === 'success') {
				closeEdit();
				await invalidateAll();
			}
		};
	}

	function handleDelete() {
		return async () => {
			await invalidateAll();
		};
	}

	// Preset type selection
	function selectType(type: keyof typeof data.budgetTypes) {
		if (existingTypes.has(type)) return; // Don't allow selecting existing types
		newCategory.type = type;
		newCategory.name = data.budgetTypes[type];
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">예산 관리</h2>
			<p class="text-sm text-gray-500">
				총 예산: ₩{new Intl.NumberFormat('ko-KR').format(totalBudget)}
			</p>
		</div>
		<button
			onclick={() => (showAddForm ? resetForm() : openAddForm())}
			class="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform active:scale-95"
			aria-label={showAddForm ? '추가 취소' : '예산 추가'}
		>
			<svg
				class="h-6 w-6 transition-transform {showAddForm ? 'rotate-45' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<!-- Add Form -->
	{#if showAddForm}
		<div
			class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
			transition:slide={{ duration: 200 }}
		>
			<h3 class="mb-4 font-bold">새 예산 추가</h3>

			<!-- Type preset buttons -->
			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium text-gray-700">예산 카테고리 선택</span>
				<div class="grid grid-cols-2 gap-2">
					{#each Object.entries(data.budgetTypes) as [key, label]}
						{@const typedKey = key as keyof typeof data.budgetTypes}
						{@const isExisting = existingTypes.has(typedKey)}
						<button
							type="button"
							onclick={() => selectType(key as keyof typeof data.budgetTypes)}
							disabled={isExisting}
							class="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors {newCategory.type ===
							key
								? 'border-black bg-black text-white'
								: isExisting
									? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
									: 'border-gray-200 hover:border-gray-300'}"
						>
							<span class="text-lg">{typeIcons[key]}</span>
							<span class="text-sm font-medium">{label}</span>
							{#if isExisting}
								<span class="ml-auto text-xs text-gray-400">등록됨</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<form method="POST" action="?/create" use:enhance={handleCreate} class="space-y-4">
				<input type="hidden" name="type" value={newCategory.type} />
				<input type="hidden" name="name" value={newCategory.name} />

				{#if newCategory.type === 'savings'}
					<div class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
						저축 금액은 월급 입금 시 자동으로 계산됩니다.<br />
						<span class="text-xs">(월급 - 다른 예산 합계)</span>
					</div>
					<input type="hidden" name="allocatedAmount" value="0" />
				{:else}
					<div>
						<label for="new-amount" class="mb-1 block text-sm font-medium text-gray-700"
							>배정 금액</label
						>
						<div class="relative">
							<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
							<input
								id="new-amount"
								type="number"
								name="allocatedAmount"
								bind:value={newCategory.allocatedAmount}
								required
								placeholder="0"
								class="w-full rounded-lg border border-gray-200 p-3 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
							/>
						</div>
					</div>
				{/if}

				<div>
					<label for="new-account" class="mb-1 block text-sm font-medium text-gray-700"
						>입금 계좌</label
					>
					<select
						id="new-account"
						name="accountId"
						bind:value={newCategory.accountId}
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						<option value="">계좌 선택</option>
						{#each data.accounts as account}
							<option value={account.id}>
								{account.bankName}
								{account.accountNumber} ({account.alias || account.accountHolder})
							</option>
						{/each}
					</select>
					{#if data.accounts.length === 0}
						<p class="mt-1 text-xs text-gray-400">
							등록된 계좌가 없습니다. <a href="/accounts" class="underline">계좌 추가하기</a>
						</p>
					{/if}
				</div>

				{#if newCategory.type !== 'savings'}
					<div>
						<label for="new-manager" class="mb-1 block text-sm font-medium text-gray-700"
							>입금 담당자</label
						>
						<select
							id="new-manager"
							name="depositManager"
							bind:value={newCategory.depositManager}
							class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
						>
							<option value="">선택</option>
							{#each data.allUsers as user}
								<option value={user.username}>{user.username}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={resetForm}
						class="flex-1 rounded-lg border border-gray-200 py-3 font-medium"
					>
						취소
					</button>
					<button type="submit" class="flex-1 rounded-lg bg-black py-3 font-medium text-white">
						추가
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Categories List -->
	<div class="space-y-3">
		{#each data.categories as category, i (category.id)}
			<div
				class="card-hover rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
				in:fly={{ y: 20, duration: 300, delay: i * 50 }}
			>
				<div class="mb-3 flex items-start justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xl">{typeIcons[category.type]}</span>
						<div>
							<span class="font-bold text-gray-900">{category.name}</span>
							<span class="ml-2 rounded-full px-2 py-0.5 text-xs {typeColors[category.type]}">
								{data.budgetTypes[category.type as keyof typeof data.budgetTypes]}
							</span>
						</div>
					</div>
					<div class="text-right">
						{#if category.type === 'savings'}
							<div class="text-sm text-amber-600">자동 계산</div>
						{:else}
							<div class="text-lg font-bold">
								₩{new Intl.NumberFormat('ko-KR').format(category.allocatedAmount)}
							</div>
						{/if}
					</div>
				</div>

				<!-- Additional info -->
				<div class="mb-3 space-y-1 text-xs text-gray-500">
					{#if category.account}
						<p>입금 계좌: {category.account.bankName} {category.account.accountNumber}</p>
					{/if}
					{#if category.depositManager}
						<p>입금 담당: {category.depositManager}</p>
					{/if}
				</div>

				<!-- Budget info (hide for savings) -->
				{#if category.type !== 'savings'}
					<!-- 이번 달 예산 사용 -->
					<div class="mb-2">
						<div class="mb-1 flex justify-between text-xs text-gray-500">
							<span>이번 달: ₩{new Intl.NumberFormat('ko-KR').format(category.monthlySpent)}</span>
							<span>예산: ₩{new Intl.NumberFormat('ko-KR').format(category.allocatedAmount)}</span>
						</div>
						<ProgressBar current={category.monthlySpent} max={category.allocatedAmount} />
					</div>

					<!-- 누적 잔액 -->
					<div class="rounded-lg bg-gray-50 p-2 text-xs">
						{#if category.initialBalance !== 0}
							<div class="flex justify-between text-gray-600">
								<span>초기 잔액</span>
								<span class={category.initialBalance < 0 ? 'text-red-600' : ''}>
									{category.initialBalance < 0 ? '-' : ''}₩{new Intl.NumberFormat('ko-KR').format(
										Math.abs(category.initialBalance)
									)}
								</span>
							</div>
						{/if}
						<div class="flex justify-between text-gray-600">
							<span>누적 입금</span>
							<span>₩{new Intl.NumberFormat('ko-KR').format(category.totalDeposited)}</span>
						</div>
						<div class="flex justify-between text-gray-600">
							<span>누적 지출</span>
							<span>-₩{new Intl.NumberFormat('ko-KR').format(category.totalSpent)}</span>
						</div>
						<div
							class="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium {category.balance >=
							0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							<span>잔액</span>
							<span>₩{new Intl.NumberFormat('ko-KR').format(category.balance)}</span>
						</div>
					</div>
				{:else}
					<!-- 저축 카테고리: 누적 잔액만 표시 -->
					<div class="rounded-lg bg-green-50 p-2 text-xs">
						{#if category.initialBalance !== 0}
							<div class="flex justify-between text-gray-600">
								<span>초기 잔액</span>
								<span class={category.initialBalance < 0 ? 'text-red-600' : ''}>
									{category.initialBalance < 0 ? '-' : ''}₩{new Intl.NumberFormat('ko-KR').format(
										Math.abs(category.initialBalance)
									)}
								</span>
							</div>
						{/if}
						<div class="flex justify-between text-gray-600">
							<span>누적 저축</span>
							<span>₩{new Intl.NumberFormat('ko-KR').format(category.totalDeposited)}</span>
						</div>
						<div
							class="mt-1 flex justify-between border-t border-green-200 pt-1 font-medium text-green-600"
						>
							<span>총 잔액</span>
							<span>₩{new Intl.NumberFormat('ko-KR').format(category.balance)}</span>
						</div>
					</div>
				{/if}

				<div class="mt-3 flex justify-end gap-2">
					<button
						onclick={() => openEdit(category)}
						class="text-sm text-blue-500 hover:text-blue-700"
					>
						수정
					</button>
					<form method="POST" action="?/delete" use:enhance={handleDelete} class="inline">
						<input type="hidden" name="id" value={category.id} />
						<button type="submit" class="text-sm text-red-400 hover:text-red-600"> 삭제 </button>
					</form>
				</div>
			</div>
		{/each}

		{#if data.categories.length === 0 && !showAddForm}
			<div class="py-12 text-center" in:fade>
				<div class="mb-4 text-6xl">📊</div>
				<p class="text-gray-400">등록된 예산이 없습니다.</p>
				<button onclick={openAddForm} class="mt-2 text-sm text-black underline">
					첫 예산 추가하기
				</button>
			</div>
		{/if}
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

<!-- Edit Modal -->
{#if editingCategory}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		transition:fade={{ duration: 200 }}
	>
		<button class="absolute inset-0" onclick={closeEdit} aria-label="닫기"></button>
		<div
			class="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
			transition:slide={{ duration: 300 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold">예산 금액 수정</h3>
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

			<form method="POST" action="?/update" use:enhance={handleUpdate} class="space-y-4">
				<input type="hidden" name="id" value={editingCategory.id} />
				<input type="hidden" name="type" value={editingCategory.type} />
				<input type="hidden" name="name" value={editingCategory.name} />

				<!-- Show current budget type (read-only) -->
				<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
					<span class="text-2xl">{typeIcons[editingCategory.type]}</span>
					<div>
						<p class="font-bold">{editingCategory.name}</p>
						<p class="text-sm text-gray-500">
							{data.budgetTypes[editingCategory.type as keyof typeof data.budgetTypes]}
						</p>
					</div>
				</div>

				{#if editingCategory.type === 'savings'}
					<div class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
						저축 금액은 월급 입금 시 자동으로 계산됩니다.<br />
						<span class="text-xs">(월급 - 다른 예산 합계)</span>
					</div>
					<input type="hidden" name="allocatedAmount" value={editingCategory.allocatedAmount} />
				{:else}
					<div>
						<label for="edit-amount" class="mb-1 block text-sm font-medium text-gray-700"
							>월 배정 금액</label
						>
						<div class="relative">
							<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
							<input
								id="edit-amount"
								type="number"
								name="allocatedAmount"
								bind:value={editingCategory.allocatedAmount}
								required
								class="w-full rounded-lg border border-gray-200 p-3 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
							/>
						</div>
					</div>
				{/if}

				<!-- 초기 잔액 수정 -->
				<div>
					<label for="edit-initial-balance" class="mb-1 block text-sm font-medium text-gray-700">
						초기 잔액
						<span class="font-normal text-gray-400">(기존 잔액 보정)</span>
					</label>
					<div class="relative">
						<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
						<input
							id="edit-initial-balance"
							type="number"
							name="initialBalance"
							bind:value={editingCategory.initialBalance}
							class="w-full rounded-lg border border-gray-200 p-3 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-400">
						앱 사용 전 기존 잔액이 있으면 입력하세요 (마이너스 가능)
					</p>
				</div>

				<div>
					<label for="edit-account" class="mb-1 block text-sm font-medium text-gray-700"
						>입금 계좌</label
					>
					<select
						id="edit-account"
						name="accountId"
						bind:value={editingCategory.accountId}
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						<option value="">계좌 선택</option>
						{#each data.accounts as account}
							<option value={account.id}>
								{account.bankName}
								{account.accountNumber} ({account.alias || account.accountHolder})
							</option>
						{/each}
					</select>
				</div>
				{#if editingCategory.type !== 'savings'}
					<div>
						<label for="edit-manager" class="mb-1 block text-sm font-medium text-gray-700"
							>입금 담당자</label
						>
						<select
							id="edit-manager"
							name="depositManager"
							bind:value={editingCategory.depositManager}
							class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
						>
							<option value="">선택</option>
							{#each data.allUsers as user}
								<option value={user.username}>{user.username}</option>
							{/each}
						</select>
					</div>
				{/if}

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
