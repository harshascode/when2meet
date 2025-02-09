import { json, type RequestHandler } from '@sveltejs/kit';
import { dbOperations } from '$lib/db/database';
import { sha256 } from 'js-sha256';

interface HasPasswordResult {
	count: number;
}

interface StoredPassword {
	password_hash: string;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { participantName, availability, timezone, password, verifyPassword, loginPassword } =
			await request.json();

		if (verifyPassword) {
			// Password verification logic
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

			if (!participantHasPassword) {
				return json({
					success: false,
					error: 'Participant does not have a password set',
					type: 'password_required'
				});
			}

			const storedPassword = dbOperations.getParticipantPassword.get(
				params.id,
				participantName
			) as StoredPassword;

			if (!loginPassword) {
				return json(
					{
						success: false,
						error: 'Password required',
						type: 'password_required'
					},
					{ status: 401 }
				);
			}

			// Compare SHA256 hashes directly
			const passwordValid = loginPassword === storedPassword.password_hash;

			if (!passwordValid) {
				return json(
					{
						success: false,
						error: 'Incorrect password',
						type: 'password_required'
					},
					{ status: 401 }
				);
			}

			return json({ success: true, message: 'Password verified' });
		} else {
			// Availability saving logic
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

			// Handle new participant with password OR password change
			if (!participantHasPassword && password) {
				// Store SHA256 hash directly
				dbOperations.setParticipantPassword.run(params.id, participantName, password);
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
		}
	} catch (error) {
		console.error('Error saving responses:', error);
		return json(
			{
				success: false,
				error: 'Failed to save availability'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ params }) => {
	try {
		const event = dbOperations.getEvent.get(params.id);
		const eventDates = dbOperations.getEventDates.all(params.id);
		const eventTimeSlots = dbOperations.getEventTimeSlots.all(params.id);
		// const responses = dbOperations.getEventResponses.all(params.id); // Original

		// Fetch responses with password status
		const responses = dbOperations.getEventResponsesWithPassword.all(params.id);

		return json({
			...(typeof event === 'object' && event !== null ? event : {}), // Ensure event is an object
			dates: eventDates.map((d: any) => d.date as string), // Explicit type annotation
			timeSlots: eventTimeSlots.map((t: any) => t.time_slot as string), // Explicit type annotation
			responses: responses
		});
	} catch (error) {
		console.error('Error fetching event:', error);
		return json({ error: 'Failed to fetch event' }, { status: 500 });
	}
};
