import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
	test('redirects unauthenticated users to login page', async ({ page }) => {
		// Try to access protected route
		await page.goto('/');

		// Should redirect to login
		await expect(page).toHaveURL('/login');
	});

	test('login page displays correctly', async ({ page }) => {
		await page.goto('/login');

		// Check for Korean text elements
		await expect(page.locator('h1')).toContainText('포켓');
		await expect(page.getByText('똑똑한 가계부 앱')).toBeVisible();
		await expect(page.getByText('카카오로 로그인')).toBeVisible();
	});

	test('login page has Kakao login button', async ({ page }) => {
		await page.goto('/login');

		const kakaoButton = page.getByRole('link', { name: /카카오로 로그인/i });
		await expect(kakaoButton).toBeVisible();
		await expect(kakaoButton).toHaveAttribute('href', '/auth/kakao');
	});

	test('shows error message for pending approval', async ({ page }) => {
		await page.goto('/login?error=pending_approval');

		await expect(page.getByText('관리자 승인 대기 중입니다')).toBeVisible();
	});

	test('shows error message for auth failure', async ({ page }) => {
		await page.goto('/login?error=auth_failed');

		await expect(page.getByText('인증에 실패했습니다')).toBeVisible();
	});
});
