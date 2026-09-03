import { expect, test } from '@playwright/test';

test.describe('PWA Features', () => {
	test('has valid manifest.json', async ({ page }) => {
		const response = await page.goto('/manifest.json');

		expect(response?.status()).toBe(200);

		const manifest = await response?.json();
		expect(manifest.name).toBe('포켓 - 스마트 가계부');
		expect(manifest.short_name).toBe('포켓');
		expect(manifest.lang).toBe('ko');
		expect(manifest.display).toBe('standalone');
	});

	test('has manifest link in HTML', async ({ page }) => {
		await page.goto('/login');

		const manifestLink = page.locator('link[rel="manifest"]');
		await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
	});

	test('has theme-color meta tag', async ({ page }) => {
		await page.goto('/login');

		const themeColor = page.locator('meta[name="theme-color"]');
		await expect(themeColor).toHaveAttribute('content', '#000000');
	});

	test('has apple-mobile-web-app-capable meta tag', async ({ page }) => {
		await page.goto('/login');

		const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
		await expect(appleMeta.first()).toHaveAttribute('content', 'yes');
	});

	test('has Korean description meta tag', async ({ page }) => {
		await page.goto('/login');

		const description = page.locator('meta[name="description"]');
		await expect(description).toHaveAttribute('content', '똑똑한 예산 관리와 지출 추적 앱');
	});

	test('service worker registration script exists', async ({ page }) => {
		await page.goto('/login');

		// Check that the service worker registration script exists
		const script = await page.evaluate(() => {
			return document.body.innerHTML.includes('serviceWorker');
		});

		expect(script).toBe(true);
	});

	test('service worker prefers the network for dynamic GET requests', async ({ page }) => {
		await page.goto('/login');
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});

		if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
			await page.reload();
		}
		await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

		const result = await page.evaluate(async () => {
			const requestPath = '/login?service-worker-network-first-probe=1';
			const cacheName = (await caches.keys()).find((name) => name.startsWith('cache-'));
			if (!cacheName) {
				throw new Error('App cache was not created');
			}
			const cache = await caches.open(cacheName);
			await cache.put(requestPath, new Response('stale cached response', { status: 200 }));

			try {
				const response = await fetch(requestPath);
				return { status: response.status, body: await response.text() };
			} finally {
				await cache.delete(requestPath);
			}
		});

		expect(result.status).toBe(200);
		expect(result.body).toContain('<!doctype html>');
		expect(result.body).not.toContain('stale cached response');
	});
});
