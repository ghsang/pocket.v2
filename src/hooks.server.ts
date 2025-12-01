import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth/kakao', '/auth/kakao/callback', '/auth/dev-login'];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Check if the route is public
	const isPublicRoute = publicRoutes.some(
		(route) => pathname === route || pathname.startsWith(route + '/')
	);

	// Get session token from cookies
	const sessionToken = event.cookies.get('session');

	// Initialize user as null
	event.locals.user = null;

	if (sessionToken) {
		try {
			const decoded = verifyToken(sessionToken);
			if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
				// Fetch user from database
				const user = await db.query.users.findFirst({
					where: eq(users.id, decoded.userId as number)
				});

				if (user && user.isApproved) {
					event.locals.user = {
						id: user.id,
						kakaoId: user.kakaoId,
						username: user.username,
						email: user.email,
						role: user.role as 'admin' | 'user',
						isApproved: user.isApproved
					};
				}
			}
		} catch {
			// Invalid token - clear the cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	// Redirect to login if not authenticated and trying to access protected route
	if (!isPublicRoute && !event.locals.user) {
		throw redirect(302, '/login');
	}

	// Redirect to home if authenticated and trying to access login
	if (pathname === '/login' && event.locals.user) {
		throw redirect(302, '/');
	}

	const response = await resolve(event);

	return response;
};
