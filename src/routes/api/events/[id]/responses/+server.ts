import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbOperations } from '$lib/db/database';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { participantName, availability } = await request.json();

		if (!participantName) {
			return json(
				{
					success: false,
					error: 'Participant name is required'
				},
				{ status: 400 }
			);
		}

		// Use a regular function instead of transaction
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
