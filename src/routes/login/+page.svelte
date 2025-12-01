<script lang="ts">
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { dev } from '$app/environment';

	// Get error from URL params
	let error = $derived($page.url.searchParams.get('error'));

	// Error messages in Korean
	const errorMessages: Record<string, string> = {
		pending_approval: '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.',
		auth_failed: '인증에 실패했습니다. 다시 시도해주세요.',
		config_missing: '카카오 로그인 설정이 올바르지 않습니다.',
		server_config: '서버 설정 오류가 발생했습니다.',
		dev_login_failed: '개발 로그인에 실패했습니다.',
		no_user: '사용자를 찾을 수 없습니다.'
	};
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4"
>
	<div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" in:fly={{ y: 20, duration: 400 }}>
		<!-- Logo & Branding -->
		<div class="mb-8 text-center">
			<div class="mb-4 text-5xl">💰</div>
			<h1 class="text-3xl font-bold text-gray-900">포켓</h1>
			<p class="mt-2 text-gray-500">똑똑한 가계부 앱</p>
		</div>

		<!-- Error Message -->
		{#if error && errorMessages[error]}
			<div
				class="mb-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-600"
				in:fade={{ duration: 200 }}
			>
				{errorMessages[error]}
			</div>
		{/if}

		<!-- Login Button -->
		<div class="space-y-4">
			<a
				href="/auth/kakao"
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-4 font-bold text-[#000000] transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
			>
				<!-- Kakao Icon -->
				<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 3C6.5 3 2 6.6 2 11.1C2 13.5 3.6 15.6 6.1 17L5.3 20C5.2 20.2 5.3 20.5 5.5 20.6C5.6 20.7 5.8 20.7 5.9 20.6L9.6 17.9C10.4 18.1 11.2 18.2 12 18.2C17.5 18.2 22 14.6 22 10.1C22 5.6 17.5 3 12 3Z"
					/>
				</svg>
				카카오로 로그인
			</a>

			<!-- Dev Login (only in development) -->
			{#if dev}
				<div class="space-y-2">
					<p class="text-center text-xs text-gray-400">개발 모드 - 사용자 선택</p>
					<div class="grid grid-cols-2 gap-2">
						<a
							href="/auth/dev-login?userId=2"
							class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-3 py-3 font-medium text-blue-700 transition-all hover:border-blue-400 hover:bg-blue-100"
						>
							👨 권혁상
						</a>
						<a
							href="/auth/dev-login?userId=3"
							class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-pink-300 bg-pink-50 px-3 py-3 font-medium text-pink-700 transition-all hover:border-pink-400 hover:bg-pink-100"
						>
							👩 이현경
						</a>
					</div>
				</div>
			{/if}
		</div>

		<!-- Notice -->
		<div class="mt-8 space-y-3 text-center text-sm text-gray-400">
			<p>승인된 사용자만 이용할 수 있습니다.</p>
			<div class="flex items-center justify-center gap-4 text-xs">
				<span>🔒 안전한 로그인</span>
				<span>📱 모바일 최적화</span>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<p class="mt-8 text-xs text-gray-400">© 2024 포켓. All rights reserved.</p>
</div>
