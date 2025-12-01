<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fly, fade } from 'svelte/transition';

	let isOpen = $state(false);

	const toggleMenu = () => {
		isOpen = !isOpen;
	};

	const navigate = (path: string) => {
		isOpen = false;
		goto(path);
	};

	// Menu items with Korean labels and icons
	const menuItems = [
		{ path: '/', label: '홈', icon: '🏠' },
		{ path: '/history', label: '지출 내역', icon: '📝' },
		{ path: '/budget', label: '예산 관리', icon: '📊' },
		{ path: '/deposit', label: '월간 정산', icon: '💵' },
		{ path: '/payments', label: '결제 수단', icon: '💳' },
		{ path: '/accounts', label: '계좌 관리', icon: '🏦' },
		{ path: '/settings', label: '설정', icon: '⚙️' }
	];

	// Check if current path
	let isActive = (path: string) => $page.url.pathname === path;
</script>

<!-- Menu Tab Button (Fixed - Right Middle) -->
<button
	onclick={toggleMenu}
	class="fixed top-1/2 right-0 z-50 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-l-2xl bg-gray-900 shadow-xl transition-all duration-200 hover:w-9 hover:bg-gray-800 active:scale-95"
	aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
	aria-expanded={isOpen}
>
	<svg
		class="h-4 w-4 text-white transition-transform duration-300 {isOpen ? 'rotate-180' : ''}"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2.5"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
	</svg>
</button>

<!-- Overlay -->
{#if isOpen}
	<button
		class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
		onclick={() => (isOpen = false)}
		aria-label="메뉴 닫기"
		transition:fade={{ duration: 200 }}
	></button>
{/if}

<!-- Side Drawer (Right) -->
<div
	class="fixed top-0 right-0 z-50 h-full w-72 transform bg-white shadow-2xl transition-transform duration-300 ease-out {isOpen
		? 'translate-x-0'
		: 'translate-x-full'}"
>
	<!-- Header -->
	<div class="flex h-20 items-center justify-between border-b border-gray-100 px-5">
		<div>
			<h2 class="text-lg font-bold text-gray-900">Pocket</h2>
			<p class="text-xs text-gray-400">가계부</p>
		</div>
		<button
			onclick={() => (isOpen = false)}
			class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
			aria-label="메뉴 닫기"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>

	<!-- Menu Items -->
	<nav class="p-3">
		{#each menuItems as item, i}
			<button
				onclick={() => navigate(item.path)}
				class="mb-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150
					{isActive(item.path) ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
			>
				<span class="text-xl">{item.icon}</span>
				<span class="font-medium">{item.label}</span>
				{#if isActive(item.path)}
					<span class="ml-auto h-2 w-2 rounded-full bg-white"></span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Footer -->
	<div class="absolute right-0 bottom-0 left-0 border-t border-gray-100 p-4">
		<p class="text-center text-xs text-gray-400">v2.0</p>
	</div>
</div>
