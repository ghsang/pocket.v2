import { redirect, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Development-only login bypass
export const GET: RequestHandler = async ({ cookies, url }) => {
	// Only allow in development mode
	if (!dev) {
		console.log('[Dev Login] Blocked - not in dev mode');
		throw redirect(303, '/login?error=not_allowed');
	}

	console.log('[Dev Login] Starting dev login...');

	const userId = url.searchParams.get('userId');

	try {
		let user;

		if (userId) {
			console.log('[Dev Login] Looking for user with ID:', userId);
			// Login as specific user
			user = await db.query.users.findFirst({
				where: eq(users.id, Number(userId))
			});
		} else {
			console.log('[Dev Login] Looking for any approved user...');
			// Get first approved user or create a dev user
			user = await db.query.users.findFirst({
				where: eq(users.isApproved, true)
			});

			if (!user) {
				console.log('[Dev Login] No approved user found, creating dev user...');
				// Create a dev user if none exists
				const [newUser] = await db
					.insert(users)
					.values({
						kakaoId: 'dev-user-001',
						username: '개발자',
						email: 'dev@example.com',
						role: 'admin',
						isApproved: true
					})
					.onConflictDoUpdate({
						target: users.kakaoId,
						set: { isApproved: true }
					})
					.returning();

				user = newUser;
				console.log('[Dev Login] Created dev user:', user);
			}
		}

		if (!user) {
			console.log('[Dev Login] No user found!');
			throw redirect(303, '/login?error=no_user');
		}

		console.log('[Dev Login] Logging in as user:', user.username, 'ID:', user.id);

		// Create JWT token
		const token = createToken({ userId: user.id, role: user.role });
		console.log('[Dev Login] Token created');

		// Set session cookie
		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false, // Dev mode
			maxAge: 60 * 60 * 24 * 7 // 1 week
		});
		console.log('[Dev Login] Cookie set, redirecting to /');

		throw redirect(303, '/');
	} catch (e: any) {
		// Check if it's a redirect (which is expected)
		if (e && typeof e === 'object' && 'status' in e && (e.status === 303 || e.status === 302)) {
			throw e; // Rethrow redirects
		}
		console.error('[Dev Login] Error:', e);
		throw redirect(303, '/login?error=dev_login_failed');
	}
};
