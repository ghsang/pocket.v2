<script lang="ts">
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let isOnline = $state(true);
	let pendingCount = $state(0);
	let showSyncMessage = $state(false);

	onMount(() => {
		// Initial state
		isOnline = navigator.onLine;

		// Listen for online/offline events
		const handleOnline = () => {
			isOnline = true;
			showSyncMessage = true;
			setTimeout(() => {
				showSyncMessage = false;
			}, 3000);
		};

		const handleOffline = () => {
			isOnline = false;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

<!-- Offline Banner -->
{#if !isOnline}
	<div
		class="fixed top-0 right-0 left-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
		transition:fly={{ y: -50, duration: 200 }}
	>
		<div class="flex items-center justify-center gap-2">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
				/>
			</svg>
			<span>오프라인 모드 - 지출이 기기에 저장됩니다</span>
		</div>
	</div>
{/if}

<!-- Back Online Message -->
{#if showSyncMessage && isOnline}
	<div
		class="fixed top-0 right-0 left-0 z-50 bg-green-500 px-4 py-2 text-center text-sm font-medium text-white"
		transition:fly={{ y: -50, duration: 200 }}
	>
		<div class="flex items-center justify-center gap-2">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			<span>온라인으로 복귀했습니다!</span>
		</div>
	</div>
{/if}

<!-- Pending sync indicator (floating badge) -->
{#if pendingCount > 0}
	<div
		class="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm"
		transition:fly={{ x: 50, duration: 200 }}
	>
		<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24">
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
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			/>
		</svg>
		<span>{pendingCount}개 동기화 대기</span>
	</div>
{/if}
