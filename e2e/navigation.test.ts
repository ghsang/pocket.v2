import { expect, test } from '@playwright/test';

// Mock authenticated user for these tests
test.describe('Navigation (Authenticated)', () => {
	test.beforeEach(async ({ page, context }) => {
		// Set a mock session cookie for testing
		// Note: In a real scenario, you'd need to set up proper test authentication
		await context.addCookies([
			{
				name: 'session',
				value: 'test-session-token',
				domain: 'localhost',
				path: '/'
			}
		]);
	});

	test.skip('magic button opens navigation menu', async ({ page }) => {
		await page.goto('/');

		// Click the magic button
		const magicButton = page.getByRole('button', { name: /메뉴/i });
		await magicButton.click();

		// Check menu items are visible
		await expect(page.getByText('홈')).toBeVisible();
		await expect(page.getByText('지출 내역')).toBeVisible();
		await expect(page.getByText('결제 수단')).toBeVisible();
		await expect(page.getByText('예산 관리')).toBeVisible();
	});

	test.skip('can navigate to history page', async ({ page }) => {
		await page.goto('/');

		// Open menu and click history
		const magicButton = page.getByRole('button', { name: /메뉴/i });
		await magicButton.click();
		await page.getByText('지출 내역').click();

		await expect(page).toHaveURL('/history');
	});

	test.skip('can navigate to payments page', async ({ page }) => {
		await page.goto('/');

		// Open menu and click payments
		const magicButton = page.getByRole('button', { name: /메뉴/i });
		await magicButton.click();
		await page.getByText('결제 수단').click();

		await expect(page).toHaveURL('/payments');
	});

	test.skip('can navigate to budget page', async ({ page }) => {
		await page.goto('/');

		// Open menu and click budget
		const magicButton = page.getByRole('button', { name: /메뉴/i });
		await magicButton.click();
		await page.getByText('예산 관리').click();

		await expect(page).toHaveURL('/budget');
	});
});
