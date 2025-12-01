<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import MagicButton from '$lib/components/MagicButton.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import { page } from '$app/stores';
	import { dev } from '$app/environment';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	// Don't show navigation on login page
	let showNav = $derived($page.url.pathname !== '/login');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>포켓 - 스마트 가계부</title>
</svelte:head>

<!-- Offline Indicator -->
<OfflineIndicator />

<!-- User Header (when logged in) -->
{#if data.user && showNav}
	<header
		class="sticky top-0 z-30 flex items-center justify-between bg-white/80 px-4 py-3 backdrop-blur-sm"
	>
		<div class="flex items-center gap-2">
			<span class="text-lg">💰</span>
			<span class="font-bold">포켓</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-sm text-gray-600">{data.user.username}</span>
			{#if dev}
				<a
					href="/login"
					class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200"
					onclick={() => {
						document.cookie = 'session=; Max-Age=0; path=/';
					}}
				>
					전환
				</a>
			{/if}
		</div>
	</header>
{/if}

<main class="relative min-h-screen overflow-hidden pb-24">
	{@render children()}
</main>

{#if showNav}
	<MagicButton />
{/if}
