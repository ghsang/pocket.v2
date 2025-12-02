<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let showAddForm = $state(false);
	let editingMethod = $state<(typeof data.methods)[0] | null>(null);
	let newName = $state('');
	let newLinkedAccount = $state('');
	let newIsDefault = $state(false);
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

	// Predefined payment methods
	const presetMethods = ['현금', '카드', '체크카드', '계좌이체'];

	function resetForm() {
		newName = '';
		newLinkedAccount = '';
		newIsDefault = false;
		showAddForm = false;
	}

	function openEdit(method: (typeof data.methods)[0]) {
		editingMethod = { ...method };
	}

	function closeEdit() {
		editingMethod = null;
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

	function selectPreset(preset: string) {
		newName = preset;
	}
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">결제 수단</h2>
			<p class="text-sm text-gray-500">{data.methods.length}개의 결제 수단</p>
		</div>
		<button
			onclick={() => (showAddForm = !showAddForm)}
			class="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform active:scale-95"
			aria-label={showAddForm ? '추가 취소' : '결제 수단 추가'}
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
			<h3 class="mb-4 font-bold">새 결제 수단 추가</h3>

			<!-- Preset buttons -->
			<div class="mb-4 flex flex-wrap gap-2">
				{#each presetMethods as preset}
					<button
						type="button"
						onclick={() => selectPreset(preset)}
						class="rounded-full border px-3 py-1 text-sm transition-colors {newName === preset
							? 'border-black bg-black text-white'
							: 'border-gray-200 bg-gray-50 hover:border-gray-300'}"
					>
						{preset}
					</button>
				{/each}
			</div>

			<form method="POST" action="?/create" use:enhance={handleCreate} class="space-y-4">
				<div>
					<label for="new-name" class="mb-1 block text-sm font-medium text-gray-700"
						>결제 수단 이름</label
					>
					<input
						id="new-name"
						type="text"
						name="name"
						bind:value={newName}
						required
						placeholder="예: 신한카드, 현금"
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<div>
					<label for="new-account" class="mb-1 block text-sm font-medium text-gray-700"
						>연결 계좌</label
					>
					<select
						id="new-account"
						name="linkedAccount"
						bind:value={newLinkedAccount}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						<option value="">계좌 선택</option>
						{#each data.accounts as account}
							<option value="{account.bankName} {account.accountNumber}">
								{account.bankName}
								{account.accountNumber}
								{account.alias ? `(${account.alias})` : ''}
							</option>
						{/each}
					</select>
					{#if data.accounts.length === 0}
						<p class="mt-1 text-xs text-gray-400">
							등록된 계좌가 없습니다. <a href="/accounts" class="underline">계좌 추가하기</a>
						</p>
					{/if}
				</div>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="isDefault"
						value="true"
						bind:checked={newIsDefault}
						class="h-4 w-4 rounded"
					/>
					<span class="text-sm text-gray-600">기본 결제 수단으로 설정</span>
				</label>

				<div class="flex gap-3">
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

	<!-- Methods List -->
	<div class="space-y-3">
		{#each data.methods as method, i (method.id)}
			<div
				class="card-hover rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
				in:fly={{ y: 20, duration: 300, delay: i * 50 }}
			>
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<span class="font-bold text-gray-900">{method.name}</span>
							{#if method.isDefault}
								<span class="rounded-full bg-black px-2 py-0.5 text-xs text-white">기본</span>
							{/if}
						</div>
						<p class="mt-1 text-sm text-gray-500">{method.linkedAccount}</p>
					</div>

					<div class="flex gap-2">
						<button
							onclick={() => openEdit(method)}
							class="text-sm text-blue-500 hover:text-blue-700"
						>
							수정
						</button>
						<form method="POST" action="?/delete" use:enhance={handleDelete} class="inline">
							<input type="hidden" name="id" value={method.id} />
							<button type="submit" class="text-sm text-red-400 hover:text-red-600"> 삭제 </button>
						</form>
					</div>
				</div>
			</div>
		{/each}

		{#if data.methods.length === 0 && !showAddForm}
			<div class="py-12 text-center" in:fade>
				<div class="mb-4 text-6xl">💳</div>
				<p class="text-gray-400">등록된 결제 수단이 없습니다.</p>
				<button onclick={() => (showAddForm = true)} class="mt-2 text-sm text-black underline">
					첫 결제 수단 추가하기
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
{#if editingMethod}
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
				<h3 class="text-lg font-bold">결제 수단 수정</h3>
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
				<input type="hidden" name="id" value={editingMethod.id} />

				<div>
					<label for="edit-name" class="mb-1 block text-sm font-medium text-gray-700"
						>결제 수단 이름</label
					>
					<input
						id="edit-name"
						type="text"
						name="name"
						bind:value={editingMethod.name}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-account" class="mb-1 block text-sm font-medium text-gray-700"
						>연결 계좌</label
					>
					<select
						id="edit-account"
						name="linkedAccount"
						bind:value={editingMethod.linkedAccount}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						<option value="">계좌 선택</option>
						{#each data.accounts as account}
							<option value="{account.bankName} {account.accountNumber}">
								{account.bankName}
								{account.accountNumber}
								{account.alias ? `(${account.alias})` : ''}
							</option>
						{/each}
					</select>
				</div>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="isDefault"
						value="true"
						bind:checked={editingMethod.isDefault}
						class="h-4 w-4 rounded"
					/>
					<span class="text-sm text-gray-600">기본 결제 수단으로 설정</span>
				</label>

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
