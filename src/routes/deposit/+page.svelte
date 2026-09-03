<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { fly, fade, slide } from 'svelte/transition';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let salary = $state(data.existingDeposit?.salary?.toString() || '');
	let deduction = $state(String(data.defaultDeduction || 0));
	let showSalaryEdit = $state(false);
	let showMessage = $state(false);
	let showResetConfirm = $state(false);

	// 입금 항목: 체크 상태를 서버에 저장(잔액 계산에 반영). optimistic update로 즉각 반영.
	const optimisticItems = new SvelteMap<number, boolean>();
	const pendingItems = new SvelteSet<number>();
	// 지출 정산 체크박스는 잔액과 무관 → 클라이언트 로컬 추적만
	const checkedSettlements = new SvelteSet<number>();

	// Update deduction when data changes (e.g., after reset)
	$effect(() => {
		if (!data.existingDeposit) {
			deduction = String(data.defaultDeduction || 0);
			optimisticItems.clear();
			pendingItems.clear();
			checkedSettlements.clear();
			return;
		}

		for (const [itemId, optimisticValue] of optimisticItems) {
			const serverItem = data.existingDeposit.items.find((item) => item.id === itemId);
			if (!serverItem || (serverItem.isCompleted ?? false) === optimisticValue) {
				optimisticItems.delete(itemId);
			}
		}
	});

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

	// Derived values
	let totalBudget = $derived(
		data.categories
			.filter((c) => c.type !== 'savings')
			.reduce((sum, c) => sum + c.allocatedAmount, 0)
	);

	// 저축 = 월급 - 차감액
	let savingsAmount = $derived(Math.max(0, Number(salary) - Number(deduction)));

	function isItemCompleted(itemId: number, serverValue: boolean): boolean {
		return optimisticItems.has(itemId) ? optimisticItems.get(itemId)! : serverValue;
	}

	let totalItems = $derived(data.existingDeposit?.items.length || 0);
	let completedItems = $derived(
		data.existingDeposit?.items.filter((item) =>
			isItemCompleted(item.id, item.isCompleted ?? false)
		).length || 0
	);
	let progressPercentage = $derived(totalItems > 0 ? (completedItems / totalItems) * 100 : 0);

	// Budget type icons
	const typeIcons: Record<string, string> = {
		event: '🎉',
		cultural: '🎭',
		savings: '💰',
		living: '🏠'
	};

	// Handle form submission with data refresh
	function handleFormSubmit() {
		return async ({ result }: { result: Parameters<typeof applyAction>[0] }) => {
			await invalidateAll();
			await applyAction(result);
		};
	}

	function handleItemToggle(itemId: number): SubmitFunction {
		return ({ cancel, formData }) => {
			if (pendingItems.has(itemId)) {
				cancel();
				return;
			}

			const nextValue = formData.get('isCompleted') === 'true';
			optimisticItems.set(itemId, nextValue);
			pendingItems.add(itemId);

			return async ({ result, update }) => {
				try {
					await update({ reset: false });
				} finally {
					pendingItems.delete(itemId);

					if (result.type !== 'success') {
						optimisticItems.delete(itemId);
					} else {
						const serverItem = data.existingDeposit?.items.find((item) => item.id === itemId);
						if (!serverItem || (serverItem.isCompleted ?? false) === nextValue) {
							optimisticItems.delete(itemId);
						}
					}
				}
			};
		};
	}

	function toggleSettlement(id: number) {
		if (checkedSettlements.has(id)) {
			checkedSettlements.delete(id);
		} else {
			checkedSettlements.add(id);
		}
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-6">
		<a href="/" class="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
			<svg class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			홈으로
		</a>
		<h2 class="text-2xl font-bold text-gray-900">월간 정산</h2>
		<p class="text-sm text-gray-500">{data.targetMonth} 지출 정산</p>
	</div>

	{#if !data.existingDeposit}
		<!-- No deposit yet - Create form -->
		<div
			class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
			in:fly={{ y: 20, duration: 300 }}
		>
			<div class="mb-6 text-center">
				<div class="mb-2 text-5xl">💵</div>
				<h3 class="text-lg font-bold">월급 입력</h3>
				<p class="text-sm text-gray-500">{data.targetMonth} 지출을 정산합니다</p>
			</div>

			<form method="POST" action="?/createDeposit" use:enhance={handleFormSubmit} class="space-y-4">
				<div>
					<label for="salary" class="mb-1 block text-sm font-medium text-gray-700">월급</label>
					<div class="relative">
						<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
						<input
							id="salary"
							type="number"
							name="salary"
							bind:value={salary}
							required
							placeholder="0"
							class="w-full rounded-lg border border-gray-200 p-4 pl-8 text-xl font-bold focus:ring-2 focus:ring-black focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="deduction" class="mb-1 block text-sm font-medium text-gray-700">
						차감액
						<span class="font-normal text-gray-400">(카드값, 보험료 등)</span>
					</label>
					<div class="relative">
						<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
						<input
							id="deduction"
							type="number"
							name="deduction"
							bind:value={deduction}
							placeholder="0"
							class="w-full rounded-lg border border-gray-200 p-4 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-400">
						<a href="/settings" class="text-blue-500 hover:underline">설정</a>에서 기본값 변경 가능
					</p>
				</div>

				{#if salary}
					<div class="space-y-2 rounded-lg bg-gray-50 p-4" transition:slide={{ duration: 200 }}>
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">월급</span>
							<span class="font-medium"
								>₩{new Intl.NumberFormat('ko-KR').format(Number(salary))}</span
							>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">차감액</span>
							<span class="font-medium text-red-500"
								>-₩{new Intl.NumberFormat('ko-KR').format(Number(deduction))}</span
							>
						</div>
						<div class="border-t border-gray-200 pt-2">
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">저축 금액</span>
								<span class="font-bold text-green-600"
									>₩{new Intl.NumberFormat('ko-KR').format(savingsAmount)}</span
								>
							</div>
						</div>
					</div>
				{/if}

				<button
					type="submit"
					disabled={!salary || Number(salary) <= 0}
					class="w-full rounded-lg bg-black py-4 font-bold text-white transition-opacity disabled:opacity-50"
				>
					예산 배분 시작
				</button>
			</form>
		</div>
	{:else}
		<!-- Existing deposit - Checklist view -->
		<div class="space-y-4">
			<!-- Progress Overview -->
			<div
				class="rounded-2xl bg-gradient-to-br from-black to-gray-800 p-6 text-white shadow-lg"
				in:fly={{ y: 20, duration: 300 }}
			>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<p class="text-sm opacity-70">입금 진행률</p>
						<p class="text-2xl font-bold">{completedItems} / {totalItems} 완료</p>
					</div>
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
						<span class="text-2xl font-bold">{Math.round(progressPercentage)}%</span>
					</div>
				</div>

				<!-- Progress bar -->
				<div class="h-2 overflow-hidden rounded-full bg-white/20">
					<div
						class="h-full bg-white transition-all duration-500"
						style="width: {progressPercentage}%"
					></div>
				</div>

				{#if data.existingDeposit.isCompleted}
					<div class="mt-4 flex items-center gap-2 text-green-300">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
						<span class="font-medium">모든 예산 입금 완료!</span>
					</div>
				{/if}
			</div>

			<!-- Salary Info -->
			<div
				class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
				in:fly={{ y: 20, duration: 300, delay: 100 }}
			>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-500">{data.targetMonth} 월급</p>
						<p class="text-xl font-bold">
							₩{new Intl.NumberFormat('ko-KR').format(data.existingDeposit.salary)}
						</p>
					</div>
					<button
						onclick={() => (showSalaryEdit = !showSalaryEdit)}
						class="text-sm text-blue-500 hover:text-blue-700"
					>
						{showSalaryEdit ? '취소' : '수정'}
					</button>
				</div>

				{#if showSalaryEdit}
					<form
						method="POST"
						action="?/updateSalary"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									showSalaryEdit = false;
								}
								await update();
							};
						}}
						class="mt-4 space-y-3"
						transition:slide={{ duration: 200 }}
					>
						<input type="hidden" name="depositId" value={data.existingDeposit.id} />
						<div>
							<label for="edit-salary" class="mb-1 block text-sm font-medium text-gray-700"
								>월급</label
							>
							<div class="relative">
								<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
								<input
									id="edit-salary"
									type="number"
									name="salary"
									value={data.existingDeposit.salary}
									required
									class="w-full rounded-lg border border-gray-200 p-3 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
								/>
							</div>
						</div>
						<div>
							<label for="edit-deduction" class="mb-1 block text-sm font-medium text-gray-700">
								차감액
								<span class="font-normal text-gray-400">(카드값, 보험료 등)</span>
							</label>
							<div class="relative">
								<span class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">₩</span>
								<input
									id="edit-deduction"
									type="number"
									name="deduction"
									value={data.defaultDeduction}
									class="w-full rounded-lg border border-gray-200 p-3 pl-8 focus:ring-2 focus:ring-black focus:outline-none"
								/>
							</div>
						</div>
						<button type="submit" class="w-full rounded-lg bg-black py-2 font-medium text-white">
							저장
						</button>
					</form>
				{/if}

				<div class="mt-3 flex gap-4 text-sm">
					<div>
						<span class="text-gray-500">총 예산</span>
						<span class="ml-1 font-medium"
							>₩{new Intl.NumberFormat('ko-KR').format(data.existingDeposit.totalBudget)}</span
						>
					</div>
					<div>
						<span class="text-gray-500">저축</span>
						<span class="ml-1 font-medium text-green-600"
							>₩{new Intl.NumberFormat('ko-KR').format(data.existingDeposit.savingsAmount)}</span
						>
					</div>
				</div>
			</div>

			<!-- Deposit Items Checklist -->
			<div class="space-y-2">
				<h3 class="font-bold text-gray-900">입금 항목</h3>

				{#each data.existingDeposit.items as item, i (item.id)}
					{@const completed = isItemCompleted(item.id, item.isCompleted ?? false)}
					<div
						class="rounded-xl border bg-white p-4 shadow-sm transition-colors {completed
							? 'border-green-200 bg-green-50'
							: 'border-gray-200'}"
						in:fly={{ y: 20, duration: 300, delay: 150 + i * 50 }}
					>
						<form
							method="POST"
							action="?/completeItem"
							use:enhance={handleItemToggle(item.id)}
							class="flex items-center gap-4"
						>
							<input type="hidden" name="itemId" value={item.id} />
							<input type="hidden" name="isCompleted" value={String(!completed)} />

							<button
								type="submit"
								disabled={pendingItems.has(item.id)}
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors {completed
									? 'border-green-500 bg-green-500 text-white'
									: 'border-gray-300 hover:border-gray-400'} disabled:cursor-wait disabled:opacity-60"
							>
								{#if completed}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="3"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								{/if}
							</button>

							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="text-lg">{typeIcons[item.category?.type || 'living']}</span>
									<span
										class="font-medium {completed ? 'text-gray-500 line-through' : 'text-gray-900'}"
									>
										{item.category?.name || '미분류'}
									</span>
								</div>
								{#if item.category?.account}
									<p class="text-xs text-gray-500">
										{item.category.account.bankName}
										{item.category.account.accountNumber}
									</p>
								{/if}
							</div>

							<div class="text-right">
								<span class="font-bold {completed ? 'text-gray-400' : 'text-gray-900'}">
									₩{new Intl.NumberFormat('ko-KR').format(item.amount)}
								</span>
							</div>
						</form>
					</div>
				{/each}
			</div>

			<!-- Target Month Expenses Summary -->
			{#if data.targetMonthExpenses.length > 0}
				<div
					class="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
					in:fly={{ y: 20, duration: 300, delay: 300 }}
				>
					<h3 class="mb-3 font-bold text-gray-900">{data.targetMonth} 지출 현황</h3>
					<div class="space-y-2">
						{#each data.targetMonthExpenses as expense}
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-2">
									<span>{typeIcons[expense.categoryType || 'living']}</span>
									<span class="text-gray-600">{expense.categoryName || '미분류'}</span>
								</div>
								<span class="font-medium"
									>₩{new Intl.NumberFormat('ko-KR').format(expense.total)}</span
								>
							</div>
						{/each}
						<div class="mt-2 border-t pt-2">
							<div class="flex items-center justify-between font-bold">
								<span>총 지출</span>
								<span
									>₩{new Intl.NumberFormat('ko-KR').format(
										data.targetMonthExpenses.reduce((sum, e) => sum + e.total, 0)
									)}</span
								>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Expense Settlement Section (지출 정산 - 내가 보내야 할 항목만) -->
			{#if data.userSettlements.length > 0}
				<div
					class="mt-6 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm"
					in:fly={{ y: 20, duration: 300, delay: 350 }}
				>
					<div class="mb-4 flex items-center gap-2">
						<span class="text-2xl">💸</span>
						<div>
							<h3 class="font-bold text-blue-900">지출 정산</h3>
							<p class="text-xs text-blue-600">담당 예산 계좌에서 지출자에게 송금하세요</p>
						</div>
					</div>

					<div class="space-y-3">
						{#each data.userSettlements as settlement, i (settlement.id)}
							{@const settlementCompleted = checkedSettlements.has(settlement.id)}
							<div
								class="rounded-xl border bg-white p-4 shadow-sm transition-colors {settlementCompleted
									? 'border-green-200 bg-green-50'
									: 'border-gray-200'}"
								in:fly={{ y: 20, duration: 300, delay: 400 + i * 50 }}
							>
								<!-- 상단: 카테고리, 금액, 체크 -->
								<div class="mb-3 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-lg">{typeIcons[settlement.category?.type || 'living']}</span>
										<span class="font-medium text-gray-900"
											>{settlement.category?.name || '미분류'}</span
										>
									</div>
									<div class="flex items-center gap-3">
										<span
											class="text-lg font-bold {settlementCompleted
												? 'text-gray-400'
												: 'text-gray-900'}"
										>
											₩{new Intl.NumberFormat('ko-KR').format(settlement.amount)}
										</span>
										<button
											type="button"
											onclick={() => toggleSettlement(settlement.id)}
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors
												{settlementCompleted
												? 'border-green-500 bg-green-500 text-white'
												: 'border-blue-400 hover:border-blue-500 hover:bg-blue-50'}"
										>
											{#if settlementCompleted}
												<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="3"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											{/if}
										</button>
									</div>
								</div>

								<!-- 출금 계좌 (예산 계좌) -->
								<div class="mb-2 rounded-lg bg-gray-50 p-2">
									<p class="mb-1 text-xs font-medium text-gray-500">출금 계좌 (예산)</p>
									{#if settlement.category?.account}
										<p class="text-sm font-medium text-gray-800">
											{settlement.category.account.bankName}
											{settlement.category.account.accountNumber}
										</p>
										<p class="text-xs text-gray-500">
											{settlement.category.account.accountHolder}
										</p>
									{:else}
										<p class="text-sm text-gray-400">계좌 정보 없음</p>
									{/if}
								</div>

								<!-- 입금 계좌 (받는 사람) -->
								<div class="rounded-lg bg-blue-50 p-2">
									<p class="mb-1 text-xs font-medium text-blue-600">
										입금 계좌 ({settlement.toUser})
									</p>
									{#if settlement.receiverAccount?.bankName}
										<p class="text-sm font-medium text-gray-800">
											{settlement.receiverAccount.bankName}
											{settlement.receiverAccount.accountNumber}
										</p>
									{:else}
										<p class="text-sm text-gray-400">계좌 정보 없음</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Total Summary -->
					{#if data.userSettlements.some((s) => !checkedSettlements.has(s.id))}
						{@const uncheckedSettlements = data.userSettlements.filter(
							(s) => !checkedSettlements.has(s.id)
						)}
						{@const totalToSend = uncheckedSettlements.reduce((sum, s) => sum + s.amount, 0)}
						<div class="mt-4 rounded-xl bg-blue-600 p-4 text-white">
							<div class="flex items-center justify-between">
								<span class="text-sm">총 송금 금액</span>
								<span class="text-xl font-bold"
									>₩{new Intl.NumberFormat('ko-KR').format(totalToSend)}</span
								>
							</div>
						</div>
					{:else}
						<div class="mt-4 flex items-center justify-center gap-2 text-green-600">
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							<span class="font-medium">모든 지출 정산 완료!</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Reset Button -->
			<div class="mt-6 border-t border-gray-200 pt-4">
				<button
					onclick={() => (showResetConfirm = true)}
					class="w-full rounded-lg border border-red-200 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
				>
					{data.targetMonth} 정산 초기화
				</button>
			</div>
		</div>
	{/if}

	<!-- Reset Confirmation Modal -->
	{#if showResetConfirm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
				transition:fly={{ y: 20, duration: 300 }}
			>
				<div class="mb-4 text-center">
					<div class="mb-3 text-4xl">⚠️</div>
					<h3 class="text-lg font-bold text-gray-900">정산 초기화</h3>
					<p class="mt-2 text-sm text-gray-500">
						{data.targetMonth} 정산 기록이 모두 삭제됩니다.<br />
						이 작업은 되돌릴 수 없습니다.
					</p>
				</div>

				<div class="flex gap-3">
					<button
						onclick={() => (showResetConfirm = false)}
						class="flex-1 rounded-lg border border-gray-200 py-3 font-medium"
					>
						취소
					</button>
					<form
						method="POST"
						action="?/resetDeposit"
						use:enhance={() => {
							return async ({ update }) => {
								showResetConfirm = false;
								await update();
							};
						}}
						class="flex-1"
					>
						<input type="hidden" name="depositId" value={data.existingDeposit?.id} />
						<button
							type="submit"
							class="w-full rounded-lg bg-red-500 py-3 font-medium text-white hover:bg-red-600"
						>
							초기화
						</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

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
