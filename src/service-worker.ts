/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets to cache immediately on install
const ASSETS = [
	...build, // the app itself
	...files // everything in `static`
];

// Install event - cache all static assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Cache assets individually to avoid failing on single asset
			await Promise.allSettled(
				ASSETS.map(async (asset) => {
					try {
						const response = await fetch(asset);
						if (response.ok) {
							await cache.put(asset, response);
						}
					} catch {
						// Skip failed assets
						console.warn('Failed to cache:', asset);
					}
				})
			);
			sw.skipWaiting();
		})()
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}
			sw.clients.claim();
		})
	);
});

// Fetch event - precached assets are cache-first; dynamic data is network-first.
// SvelteKit client navigations and invalidateAll() use __data.json GET requests,
// so serving every non-navigation GET from cache can keep page data stale forever.
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip external requests
	if (url.origin !== location.origin) {
		return;
	}

	// Skip API requests (they need fresh data)
	if (url.pathname.startsWith('/api/')) {
		// For expense API, handle offline
		if (url.pathname.startsWith('/api/expenses')) {
			event.respondWith(handleExpenseRequest(event.request));
			return;
		}
		return;
	}

	event.respondWith(handleGetRequest(event.request, url));
});

async function handleGetRequest(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// Build output and static files are immutable for this deployment.
	if (ASSETS.includes(url.pathname)) {
		const cachedAsset = await cache.match(url.pathname);
		if (cachedAsset) {
			return cachedAsset;
		}
	}

	// Page HTML, SvelteKit data requests and other dynamic GETs must prefer
	// the network so month changes and form-action updates are visible at once.
	try {
		const response = await fetch(request);
		if (!(response instanceof Response)) {
			throw new Error('Invalid network response');
		}

		const cacheControl = response.headers.get('cache-control')?.toLowerCase() || '';
		if (response.status === 200 && !cacheControl.includes('no-store')) {
			try {
				await cache.put(request, response.clone());
			} catch {
				// A cache write failure must not hide a valid network response.
				console.warn('Failed to cache:', request.url);
			}
		}

		return response;
	} catch (error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}

		if (request.mode === 'navigate') {
			const fallback = await cache.match('/');
			return fallback || new Response('Offline', { status: 503 });
		}

		throw error;
	}
}

// Handle expense requests with offline support
async function handleExpenseRequest(request: Request): Promise<Response> {
	try {
		const response = await fetch(request);
		return response;
	} catch {
		// Offline - return cached expenses or empty array
		const cached = await caches.match(request);
		if (cached) {
			return cached;
		}
		// Return empty array if no cache
		return new Response(JSON.stringify([]), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// Listen for messages from the main thread
sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}

	// Handle offline expense sync
	if (event.data && event.data.type === 'SYNC_EXPENSES') {
		event.waitUntil(syncPendingExpenses(event.data.expenses));
	}
});

// Sync pending expenses when back online
async function syncPendingExpenses(expenses: unknown[]) {
	for (const expense of expenses) {
		try {
			await fetch('/api/expenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(expense)
			});
		} catch {
			// Will retry later
			console.error('Failed to sync expense:', expense);
		}
	}
}

// Background sync for pending expenses
sw.addEventListener('sync', (event) => {
	const syncEvent = event as Event & { tag: string; waitUntil(promise: Promise<unknown>): void };
	if (syncEvent.tag === 'sync-expenses') {
		syncEvent.waitUntil(
			// Get pending expenses from IndexedDB and sync
			sw.clients.matchAll().then((clients) => {
				clients.forEach((client) => {
					client.postMessage({ type: 'SYNC_COMPLETE' });
				});
			})
		);
	}
});
