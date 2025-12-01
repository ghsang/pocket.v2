import { redirect, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
    const code = url.searchParams.get('code');
    if (!code) throw redirect(303, '/login');

    const KAKAO_CLIENT_ID = env.KAKAO_CLIENT_ID;
    const KAKAO_REDIRECT_URI = env.KAKAO_REDIRECT_URI || 'http://localhost:5173/auth/kakao/callback';
    const KAKAO_CLIENT_SECRET = env.KAKAO_CLIENT_SECRET || '';

    if (!KAKAO_CLIENT_ID) {
        console.error('Missing KAKAO_CLIENT_ID');
        // If testing without keys, we might want to bypass or error out
        throw redirect(303, '/login?error=server_config');
    }

    try {
        // 1. Get Access Token
        const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: KAKAO_CLIENT_ID,
                redirect_uri: KAKAO_REDIRECT_URI,
                code,
                client_secret: KAKAO_CLIENT_SECRET
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('Token Error:', tokenData);
            throw error(400, 'Failed to fetch access token');
        }

        // 2. Get User Info
        const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userResponse.json();
        
        // 3. Find or Create User
        const kakaoId = String(userData.id);
        const nickname = userData.properties?.nickname || 'User';
        const email = userData.kakao_account?.email;

        // Note: db.query depends on schema export in db/index.ts. 
        // We use query builder style for better readability if available, 
        // but 'db.select().from().where()' is safer if query API isn't enabled.
        // Assuming query API is enabled in db/index.ts (Pass { schema } to drizzle)
        
        let user = await db.query.users.findFirst({
            where: eq(users.kakaoId, kakaoId)
        });

        if (!user) {
            const inserted = await db.insert(users).values({
                kakaoId,
                username: nickname,
                email,
                isApproved: false // Requires manual approval per requirements
            }).returning();
            user = inserted[0];
        }

        if (!user.isApproved) {
            throw redirect(303, '/login?error=pending_approval');
        }

        // 4. Issue JWT
        const jwt = createToken({ userId: user.id, role: user.role });
        
        cookies.set('session', jwt, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });

        throw redirect(303, '/');

    } catch (e) {
        if (e && typeof e === 'object' && 'status' in e && (e.status === 303 || e.status === 302)) {
             throw e; // Rethrow redirects
        }
        console.error('Auth Error:', e);
        throw redirect(303, '/login?error=auth_failed');
    }
};
