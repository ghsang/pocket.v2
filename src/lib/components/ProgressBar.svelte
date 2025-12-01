<script lang="ts">
	let { current, max }: { current: number; max: number } = $props();

	let percentage = $derived(Math.min(Math.max((current / max) * 100, 0), 100));

	// Smooth gradient color transition: Green -> Yellow -> Orange -> Red
	let gradientColor = $derived.by(() => {
		if (percentage < 25) {
			// Green
			return 'from-green-400 to-green-500';
		} else if (percentage < 50) {
			// Green to Yellow
			return 'from-green-400 to-yellow-400';
		} else if (percentage < 75) {
			// Yellow to Orange
			return 'from-yellow-400 to-orange-400';
		} else if (percentage < 90) {
			// Orange to Red
			return 'from-orange-400 to-red-400';
		} else {
			// Red
			return 'from-red-400 to-red-500';
		}
	});

	// Text color based on percentage
	let textColor = $derived.by(() => {
		if (percentage < 50) return 'text-green-600';
		if (percentage < 75) return 'text-yellow-600';
		if (percentage < 90) return 'text-orange-600';
		return 'text-red-600';
	});

	// Status text
	let statusText = $derived.by(() => {
		if (percentage >= 100) return '초과!';
		if (percentage >= 90) return '주의';
		if (percentage >= 75) return '75% 사용';
		return '';
	});
</script>

<div class="space-y-1">
	<!-- Progress bar -->
	<div class="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
		<div
			class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-500 ease-out {gradientColor}"
			style="width: {percentage}%"
		></div>
	</div>

	<!-- Labels -->
	<div class="flex items-center justify-between text-xs">
		<span class="text-gray-500">
			{new Intl.NumberFormat('ko-KR', {
				style: 'currency',
				currency: 'KRW',
				maximumFractionDigits: 0
			}).format(current)}
		</span>
		<div class="flex items-center gap-2">
			{#if statusText}
				<span class="font-medium {textColor}">{statusText}</span>
			{/if}
			<span class="text-gray-400">
				/ {new Intl.NumberFormat('ko-KR', {
					style: 'currency',
					currency: 'KRW',
					maximumFractionDigits: 0
				}).format(max)}
			</span>
		</div>
	</div>
</div>
