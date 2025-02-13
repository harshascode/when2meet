import { json, type RequestHandler } from '@sveltejs/kit';
import { dbOperations } from '$lib/db/database';
import { generateToken, verifyToken, hashPassword } from '$lib/auth/jwt';

interface HasPasswordResult {
	count: number;
}

interface StoredPassword {
	password_hash: string;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { participantName, availability, timezone, password, action, loginPassword } =
			await request.json();

		// Authentication Logic
		if (action === 'login') {
			if (!participantName) {
				return json(
					{
						success: false,
						error: 'Participant name is required'
					},
					{ status: 400 }
				);
			}

			const hasPasswordResult = dbOperations.hasPassword.get(
				params.id,
				participantName
			) as HasPasswordResult;
			const participantHasPassword = hasPasswordResult.count > 0;

			// If participant has no password, create a new account
			if (!participantHasPassword) {
				if (password) {
					// New user with password
					const hashedPassword = hashPassword(password);
					dbOperations.setParticipantPassword.run(params.id, participantName, hashedPassword);

					const token = generateToken({
						participantName,
						eventId: params.id as string
					});

					return json({
						success: true,
						token,
						message: 'Account created successfully'
					});
				} else {
					// New user without password
					const token = generateToken({
						participantName,
						eventId: params.id as string
					});

					return json({
						success: true,
						token,
						message: 'Logged in successfully'
					});
				}
			}

			// Verify existing user's password
			const storedPassword = dbOperations.getParticipantPassword.get(
				params.id,
				participantName
			) as StoredPassword;

			if (!loginPassword) {
				return json(
					{
						success: false,
						error: 'Password required'
					},
					{ status: 401 }
				);
			}

			const hashedLoginPassword = hashPassword(loginPassword);
			if (hashedLoginPassword !== storedPassword.password_hash) {
				return json(
					{
						success: false,
						error: 'Incorrect password'
					},
					{ status: 401 }
				);
			}

			const token = generateToken({
				participantName,
				eventId: params.id as string
			});

			return json({
				success: true,
				token,
				message: 'Logged in successfully'
			});
		}

		// Availability saving logic
		const authHeader = request.headers.get('Authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const token = authHeader.split(' ')[1];
		const payload = verifyToken(token);

		if (!payload || payload.participantName !== participantName || payload.eventId !== params.id) {
			return json({ error: 'Invalid token' }, { status: 401 });
		}

		// Delete existing responses
		dbOperations.deleteParticipantResponses.run(params.id, participantName);

		// Add new responses
		for (const date in availability) {
			for (const timeSlot in availability[date]) {
				if (availability[date][timeSlot]) {
					dbOperations.addResponse.run(params.id, participantName, date, timeSlot);
				}
			}
		}

		return json({
			success: true,
			message: 'Availability saved successfully'
		});
	} catch (error) {
		console.error('Error processing request:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ params, request }) => {
	try {
		const event = dbOperations.getEvent.get(params.id);
		const eventDates = dbOperations.getEventDates.all(params.id);
		const eventTimeSlots = dbOperations.getEventTimeSlots.all(params.id);
		const responses = dbOperations.getEventResponsesWithPassword.all(params.id);

		return json({
			...(typeof event === 'object' && event !== null ? event : {}),
			dates: eventDates.map((d: any) => d.date as string),
			timeSlots: eventTimeSlots.map((t: any) => t.time_slot as string),
			responses: responses
		});
	} catch (error) {
		console.error('Error fetching event:', error);
		return json({ error: 'Failed to fetch event' }, { status: 500 });
	}
};
