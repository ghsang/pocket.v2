// Offline expense store using IndexedDB for PWA support
import { browser } from '$app/environment';

interface PendingExpense {
	localId: string;
	description: string;
	amount: number;
	date: string;
	categoryId: number | null;
	paymentMethodId: number | null;
	createdAt: string;
}

const DB_NAME = 'pocket-offline';
const STORE_NAME = 'pending-expenses';
const DB_VERSION = 1;

// Reactive state for pending expenses count
let pendingCount = $state(0);
let isOnline = $state(browser ? navigator.onLine : true);

// Initialize database
async function initDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!browser) {
			reject(new Error('IndexedDB not available on server'));
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
			}
		};
	});
}

// Add expense to offline store
async function addPendingExpense(
	expense: Omit<PendingExpense, 'localId' | 'createdAt'>
): Promise<string> {
	const db = await initDB();
	const localId = crypto.randomUUID();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const pendingExpense: PendingExpense = {
			...expense,
			localId,
			createdAt: new Date().toISOString()
		};

		const request = store.add(pendingExpense);

		request.onsuccess = () => {
			updatePendingCount();
			resolve(localId);
		};
		request.onerror = () => reject(request.error);
	});
}

// Get all pending expenses
async function getPendingExpenses(): Promise<PendingExpense[]> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.getAll();

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

// Remove expense from offline store
async function removePendingExpense(localId: string): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(localId);

		request.onsuccess = () => {
			updatePendingCount();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

// Clear all pending expenses
async function clearPendingExpenses(): Promise<void> {
	const db = await initDB();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();

		request.onsuccess = () => {
			pendingCount = 0;
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

// Update pending count
async function updatePendingCount(): Promise<void> {
	try {
		const expenses = await getPendingExpenses();
		pendingCount = expenses.length;
	} catch {
		pendingCount = 0;
	}
}

// Sync pending expenses to server
async function syncPendingExpenses(): Promise<{ success: number; failed: number }> {
	const expenses = await getPendingExpenses();
	let success = 0;
	let failed = 0;

	for (const expense of expenses) {
		try {
			const response = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					localId: expense.localId,
					description: expense.description,
					amount: expense.amount,
					date: expense.date,
					categoryId: expense.categoryId,
					paymentMethodId: expense.paymentMethodId
				})
			});

			if (response.ok) {
				await removePendingExpense(expense.localId);
				success++;
			} else {
				failed++;
			}
		} catch {
			failed++;
		}
	}

	return { success, failed };
}

// Initialize online/offline listeners
function initNetworkListeners() {
	if (!browser) return;

	window.addEventListener('online', async () => {
		isOnline = true;
		// Auto-sync when back online
		if (pendingCount > 0) {
			await syncPendingExpenses();
		}
	});

	window.addEventListener('offline', () => {
		isOnline = false;
	});

	// Initial count update
	updatePendingCount();
}

// Export reactive getters and functions
export const offlineStore = {
	get pendingCount() {
		return pendingCount;
	},
	get isOnline() {
		return isOnline;
	},
	addPendingExpense,
	getPendingExpenses,
	removePendingExpense,
	clearPendingExpenses,
	syncPendingExpenses,
	initNetworkListeners
};
