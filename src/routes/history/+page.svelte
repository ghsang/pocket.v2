<script lang="ts">
	import { enhance } from '$app/forms';
	import { fly, fade, slide } from 'svelte/transition';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let expenses = $state(data.initialExpenses);
	let offset = $state(20);
	let loading = $state(false);
	let allLoaded = $state(data.initialExpenses.length < 20);
	let loadTrigger: HTMLElement | undefined = $state();
	let editingExpense = $state<(typeof expenses)[0] | null>(null);

	// Load More function
	const loadMore = async () => {
		if (loading || allLoaded) return;
		loading = true;

		try {
			const res = await fetch(`/api/expenses?limit=20&offset=${offset}`);
			if (res.ok) {
				const newExpenses = await res.json();
				if (newExpenses.length < 20) {
					allLoaded = true;
				}
				expenses = [...expenses, ...newExpenses];
				offset += 20;
			}
		} finally {
			loading = false;
		}
	};

	// Intersection Observer for infinite scroll
	$effect(() => {
		if (typeof window === 'undefined' || !loadTrigger) return;

		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				loadMore();
			}
		});

		observer.observe(loadTrigger);

		return () => observer.disconnect();
	});

	// Date formatting
	const formatDate = (d: string) => {
		const date = new Date(d);
		return date.toLocaleDateString('ko-KR', {
			month: 'long',
			day: 'numeric',
			weekday: 'short'
		});
	};

	// Handle delete
	function handleDelete(id: number) {
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			expenses = expenses.filter((e) => e.id !== id);
			await update({ reset: false });
		};
	}

	// Handle edit
	function openEdit(expense: (typeof expenses)[0]) {
		editingExpense = { ...expense };
	}

	function closeEdit() {
		editingExpense = null;
	}

	function handleEditSubmit() {
		return async ({
			result,
			update
		}: {
			result: any;
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success' && editingExpense) {
				// Update local state
				expenses = expenses.map((e) =>
					e.id === editingExpense!.id
						? {
								...e,
								amount: Number(editingExpense!.amount),
								description: editingExpense!.description,
								date: editingExpense!.date
							}
						: e
				);
				closeEdit();
			}
			await update({ reset: false });
		};
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-900">지출 내역</h2>
		<p class="text-sm text-gray-500">총 {expenses.length}건의 지출</p>
	</div>

	<div class="space-y-3">
		{#each expenses as expense, i (expense.id)}
			<div
				class="card-hover flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
				in:fly={{ y: 20, duration: 300, delay: Math.min(i * 50, 200) }}
			>
				<div class="flex-1">
					<div class="mb-1 text-xs text-gray-400">{formatDate(expense.date)}</div>
					<div class="font-medium text-gray-900">{expense.description || '(내용 없음)'}</div>
					<div class="text-xs text-gray-500">
						{expense.category?.name || '미분류'} • {expense.paymentMethod?.name || '현금'}
					</div>
				</div>
				<div class="text-right">
					<div class="text-lg font-bold">
						₩{new Intl.NumberFormat('ko-KR').format(expense.amount)}
					</div>

					<div class="mt-2 flex gap-2">
						<button
							onclick={() => openEdit(expense)}
							class="text-xs text-blue-500 hover:text-blue-700"
						>
							수정
						</button>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() => handleDelete(expense.id)}
							class="inline"
						>
							<input type="hidden" name="id" value={expense.id} />
							<button type="submit" class="text-xs text-red-400 hover:text-red-600"> 삭제 </button>
						</form>
					</div>
				</div>
			</div>
		{/each}

		{#if expenses.length === 0}
			<div class="py-12 text-center" in:fade>
				<div class="mb-4 text-6xl">📝</div>
				<p class="text-gray-400">지출 내역이 없습니다.</p>
				<a href="/" class="mt-2 inline-block text-sm text-black underline">첫 지출 등록하기</a>
			</div>
		{/if}

		<!-- Loading Trigger -->
		{#if !allLoaded}
			<div bind:this={loadTrigger} class="flex h-16 items-center justify-center">
				{#if loading}
					<div class="flex items-center gap-2 text-sm text-gray-400">
						<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						불러오는 중...
					</div>
				{/if}
			</div>
		{/if}

		{#if allLoaded && expenses.length > 0}
			<div class="pb-4 text-center text-xs text-gray-300">모든 내역을 불러왔습니다</div>
		{/if}
	</div>
</div>

<!-- Edit Modal -->
{#if editingExpense}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		transition:fade={{ duration: 200 }}
	>
		<button class="absolute inset-0" onclick={closeEdit} aria-label="닫기"></button>
		<div
			class="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
			transition:slide={{ duration: 300 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold">지출 수정</h3>
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

			<form method="POST" action="?/update" use:enhance={handleEditSubmit} class="space-y-4">
				<input type="hidden" name="id" value={editingExpense.id} />
				<input type="hidden" name="categoryId" value={editingExpense.categoryId} />
				<input type="hidden" name="paymentMethodId" value={editingExpense.paymentMethodId} />

				<div>
					<label for="edit-amount" class="mb-1 block text-sm font-medium text-gray-700">금액</label>
					<input
						id="edit-amount"
						type="number"
						name="amount"
						bind:value={editingExpense.amount}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-desc" class="mb-1 block text-sm font-medium text-gray-700">내용</label>
					<input
						id="edit-desc"
						type="text"
						name="description"
						bind:value={editingExpense.description}
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-date" class="mb-1 block text-sm font-medium text-gray-700">날짜</label>
					<input
						id="edit-date"
						type="date"
						name="date"
						bind:value={editingExpense.date}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
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
