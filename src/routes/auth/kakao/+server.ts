import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    const KAKAO_CLIENT_ID = env.KAKAO_CLIENT_ID;
    const REDIRECT_URI = env.KAKAO_REDIRECT_URI || 'http://localhost:5173/auth/kakao/callback';
    
    if (!KAKAO_CLIENT_ID) {
        console.error('KAKAO_CLIENT_ID is missing');
        // For development/demo purposes, we might want to handle this gracefully
        // or just Mock it.
        throw redirect(303, '/login?error=config_missing');
    }

    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;

    throw redirect(302, kakaoAuthUrl);
};
