<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedCategoryId = $state<number | null>(null);
	let amount = $state('');
	let description = $state('');
	// 한국 시간 기준 오늘 날짜
	const getToday = () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};
	let date = $state(getToday());
	let showSuccess = $state(false);

	// Derived selected category to show progress
	let selectedCategory = $derived(
		selectedCategoryId ? data.categories.find((c) => c.id === selectedCategoryId) : null
	);

	// Handle form submission animation
	function handleSubmit() {
		return async ({ result }: { result: any }) => {
			if (result.type === 'success') {
				showSuccess = true;
				setTimeout(() => {
					showSuccess = false;
				}, 2000);
				// Reset form
				amount = '';
				description = '';
				selectedCategoryId = null;
				date = getToday();
				// Reload data to update category balances
				await invalidateAll();
			}
		};
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-8">
		<h2 class="text-2xl font-bold text-gray-900">지출 등록</h2>
		<p class="text-gray-500">새로운 지출을 기록하세요</p>
	</div>

	<form method="POST" use:enhance={handleSubmit} class="space-y-6">
		<!-- Amount Input -->
		<div class="relative">
			<span class="absolute top-1/2 left-0 -translate-y-1/2 text-2xl font-bold text-gray-400"
				>₩</span
			>
			<input
				type="number"
				name="amount"
				bind:value={amount}
				placeholder="0"
				required
				inputmode="numeric"
				class="w-full border-b-2 border-gray-200 bg-transparent py-4 pl-8 text-4xl font-bold text-gray-900 placeholder:text-gray-300 focus:border-black focus:outline-none"
			/>
		</div>

		<!-- Description -->
		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700" for="desc">내용</label>
			<input
				id="desc"
				type="text"
				name="description"
				bind:value={description}
				placeholder="점심, 택시비 등"
				class="w-full rounded-xl border border-gray-200 bg-white p-3 focus:ring-2 focus:ring-black focus:outline-none"
			/>
		</div>

		<!-- Category -->
		<div>
			<span class="mb-2 block text-sm font-medium text-gray-700">예산 카테고리</span>
			<div class="grid grid-cols-2 gap-3">
				{#each data.categories as category (category.id)}
					<label class="relative cursor-pointer">
						<input
							type="radio"
							name="categoryId"
							value={category.id}
							bind:group={selectedCategoryId}
							class="peer sr-only"
							required
						/>
						<div
							class="flex h-full flex-col justify-between rounded-xl border border-gray-200 bg-white p-3 transition-all peer-checked:border-black peer-checked:bg-black peer-checked:text-white"
						>
							<span class="text-sm font-medium">{category.name}</span>
							<span class="mt-1 text-xs opacity-70">
								{new Intl.NumberFormat('ko-KR').format(category.allocatedAmount - category.used)}원
								남음
							</span>
						</div>
					</label>
				{/each}
				{#if data.categories.length === 0}
					<div
						class="col-span-2 rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400"
					>
						예산이 없습니다. <a href="/budget" class="underline">예산 추가하기</a>
					</div>
				{/if}
			</div>

			<!-- Progress Bar Preview -->
			{#if selectedCategory}
				<div
					class="animate-fade-in mt-4 rounded-xl bg-gray-50 p-4"
					transition:fade={{ duration: 200 }}
				>
					<div class="mb-1 flex justify-between text-sm">
						<span class="font-medium">예산 현황: {selectedCategory.name}</span>
					</div>
					<ProgressBar
						current={selectedCategory.used + Number(amount || 0)}
						max={selectedCategory.allocatedAmount}
					/>
				</div>
			{/if}
		</div>

		<!-- Payment Method -->
		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700" for="method">결제 수단</label>
			<select
				id="method"
				name="paymentMethodId"
				required
				class="w-full appearance-none rounded-xl border border-gray-200 bg-white p-3 focus:ring-2 focus:ring-black focus:outline-none"
			>
				<option value="" disabled selected>결제 수단 선택</option>
				{#each data.paymentMethods as method (method.id)}
					<option value={method.id}>{method.name} ({method.linkedAccount})</option>
				{/each}
			</select>
			{#if data.paymentMethods.length === 0}
				<p class="mt-2 text-xs text-gray-400">
					결제 수단이 없습니다. <a href="/payments" class="underline">추가하기</a>
				</p>
			{/if}
		</div>

		<!-- Date -->
		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700" for="date">날짜</label>
			<input
				id="date"
				type="date"
				name="date"
				bind:value={date}
				required
				class="w-full rounded-xl border border-gray-200 bg-white p-3 focus:ring-2 focus:ring-black focus:outline-none"
			/>
		</div>

		<!-- Submit -->
		<button
			type="submit"
			class="btn-press mt-4 w-full rounded-xl bg-black py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
		>
			지출 등록
		</button>

		<!-- Success Message -->
		{#if showSuccess || form?.success}
			<div
				class="animate-bounce-in text-center font-medium text-green-600"
				transition:fly={{ y: 10, duration: 300 }}
			>
				지출이 등록되었습니다!
			</div>
		{/if}

		<!-- Error Message -->
		{#if form?.error}
			<div class="text-center font-medium text-red-500" transition:fade>
				{form.error}
			</div>
		{/if}
	</form>
</div>
