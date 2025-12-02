<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let showAddForm = $state(false);
	let editingAccount = $state<(typeof data.accounts)[0] | null>(null);
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
	let newAccount = $state({
		bankName: '',
		accountNumber: '',
		accountHolder: '',
		alias: ''
	});

	// Common Korean banks
	const commonBanks = [
		'카카오뱅크',
		'토스뱅크',
		'신한은행',
		'국민은행',
		'우리은행',
		'하나은행',
		'농협은행',
		'기업은행',
		'케이뱅크'
	];

	function resetForm() {
		newAccount = {
			bankName: '',
			accountNumber: '',
			accountHolder: '',
			alias: ''
		};
		showAddForm = false;
	}

	function openEdit(account: (typeof data.accounts)[0]) {
		editingAccount = { ...account };
	}

	function closeEdit() {
		editingAccount = null;
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
</script>

<div class="page-enter px-4 pt-8 pb-24">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900">계좌 관리</h2>
			<p class="text-sm text-gray-500">예산에 연결할 계좌를 관리합니다</p>
		</div>
		<button
			onclick={() => (showAddForm = !showAddForm)}
			class="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform active:scale-95"
			aria-label={showAddForm ? '추가 취소' : '계좌 추가'}
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
			<h3 class="mb-4 font-bold">새 계좌 추가</h3>

			<form method="POST" action="?/create" use:enhance={handleCreate} class="space-y-4">
				<!-- Bank Name -->
				<div>
					<label for="new-bank" class="mb-1 block text-sm font-medium text-gray-700">은행</label>
					<input
						id="new-bank"
						type="text"
						name="bankName"
						bind:value={newAccount.bankName}
						required
						list="bank-suggestions"
						placeholder="은행명 입력"
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
					<datalist id="bank-suggestions">
						{#each commonBanks as bank}
							<option value={bank}></option>
						{/each}
					</datalist>
				</div>

				<!-- Account Number -->
				<div>
					<label for="new-number" class="mb-1 block text-sm font-medium text-gray-700"
						>계좌번호</label
					>
					<input
						id="new-number"
						type="text"
						name="accountNumber"
						bind:value={newAccount.accountNumber}
						required
						placeholder="예: 110-123-456789"
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<!-- Account Holder -->
				<div>
					<label for="new-holder" class="mb-1 block text-sm font-medium text-gray-700">예금주</label
					>
					<select
						id="new-holder"
						name="accountHolder"
						bind:value={newAccount.accountHolder}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						<option value="">선택</option>
						{#each data.holders as holder}
							<option value={holder}>{holder}</option>
						{/each}
					</select>
				</div>

				<!-- Alias -->
				<div>
					<label for="new-alias" class="mb-1 block text-sm font-medium text-gray-700"
						>별칭 (선택)</label
					>
					<input
						id="new-alias"
						type="text"
						name="alias"
						bind:value={newAccount.alias}
						placeholder="예: 생활비 통장, 저축 통장"
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

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

	<!-- Accounts List -->
	<div class="space-y-3">
		{#each data.accounts as account, i (account.id)}
			<div
				class="card-hover rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
				in:fly={{ y: 20, duration: 300, delay: i * 50 }}
			>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg"
						>
							🏦
						</div>
						<div>
							<div class="flex items-center gap-2">
								<span class="font-bold text-gray-900">{account.bankName}</span>
								{#if account.alias}
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										{account.alias}
									</span>
								{/if}
							</div>
							<p class="text-sm text-gray-500">{account.accountNumber}</p>
							<p class="text-xs text-gray-400">{account.accountHolder}</p>
						</div>
					</div>
				</div>

				<div class="mt-3 flex justify-end gap-2">
					<button
						onclick={() => openEdit(account)}
						class="text-sm text-blue-500 hover:text-blue-700"
					>
						수정
					</button>
					<form method="POST" action="?/delete" use:enhance={handleDelete} class="inline">
						<input type="hidden" name="id" value={account.id} />
						<button type="submit" class="text-sm text-red-400 hover:text-red-600"> 삭제 </button>
					</form>
				</div>
			</div>
		{/each}

		{#if data.accounts.length === 0 && !showAddForm}
			<div class="py-12 text-center" in:fade>
				<div class="mb-4 text-6xl">🏦</div>
				<p class="text-gray-400">등록된 계좌가 없습니다.</p>
				<button onclick={() => (showAddForm = true)} class="mt-2 text-sm text-black underline">
					첫 계좌 추가하기
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
{#if editingAccount}
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
				<h3 class="text-lg font-bold">계좌 수정</h3>
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
				<input type="hidden" name="id" value={editingAccount.id} />

				<div>
					<label for="edit-bank" class="mb-1 block text-sm font-medium text-gray-700">은행</label>
					<input
						id="edit-bank"
						type="text"
						name="bankName"
						bind:value={editingAccount.bankName}
						required
						list="bank-suggestions-edit"
						placeholder="은행명 입력"
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
					<datalist id="bank-suggestions-edit">
						{#each commonBanks as bank}
							<option value={bank}></option>
						{/each}
					</datalist>
				</div>

				<div>
					<label for="edit-number" class="mb-1 block text-sm font-medium text-gray-700"
						>계좌번호</label
					>
					<input
						id="edit-number"
						type="text"
						name="accountNumber"
						bind:value={editingAccount.accountNumber}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-holder" class="mb-1 block text-sm font-medium text-gray-700"
						>예금주</label
					>
					<select
						id="edit-holder"
						name="accountHolder"
						bind:value={editingAccount.accountHolder}
						required
						class="w-full rounded-lg border border-gray-200 p-3 focus:ring-2 focus:ring-black focus:outline-none"
					>
						{#each data.holders as holder}
							<option value={holder}>{holder}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="edit-alias" class="mb-1 block text-sm font-medium text-gray-700"
						>별칭 (선택)</label
					>
					<input
						id="edit-alias"
						type="text"
						name="alias"
						bind:value={editingAccount.alias}
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
