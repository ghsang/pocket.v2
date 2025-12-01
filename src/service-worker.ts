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
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => {
				sw.skipWaiting();
			})
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

// Fetch event - serve from cache, fall back to network
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

	// For navigation requests, try network first
	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const response = await fetch(event.request);
					// Cache the response for offline use
					if (response.status === 200) {
						const cache = await caches.open(CACHE);
						cache.put(event.request, response.clone());
					}
					return response;
				} catch {
					// Offline - return cached version
					const cachedResponse = await caches.match(event.request);
					if (cachedResponse) {
						return cachedResponse;
					}
					const fallback = await caches.match('/');
					return fallback || new Response('Offline', { status: 503 });
				}
			})()
		);
		return;
	}

	// For other requests, try cache first
	event.respondWith(
		(async () => {
			const cachedResponse = await caches.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}

			const response = await fetch(event.request);
			// Cache successful responses
			if (response.status === 200) {
				const cache = await caches.open(CACHE);
				cache.put(event.request, response.clone());
			}
			return response;
		})()
	);
});

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
async function syncPendingExpenses(expenses: any[]) {
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
sw.addEventListener('sync', (event: any) => {
	if (event.tag === 'sync-expenses') {
		event.waitUntil(
			// Get pending expenses from IndexedDB and sync
			sw.clients.matchAll().then((clients) => {
				clients.forEach((client) => {
					client.postMessage({ type: 'SYNC_COMPLETE' });
				});
			})
		);
	}
});
