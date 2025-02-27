import { json } from '@sveltejs/kit';
import { verifyToken } from '$lib/auth/jwt';

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization');

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return json({ error: 'No token provided' }, { status: 401 });
	}

	const token = authHeader.split(' ')[1];
	const payload = verifyToken(token);

	if (!payload) {
		return json({ error: 'Invalid token' }, { status: 401 });
	}

	return json({
		success: true,
		participantName: payload.participantName
	});
}
