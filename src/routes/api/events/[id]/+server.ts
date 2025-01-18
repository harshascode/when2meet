import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbOperations } from '$lib/db/database';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const event = dbOperations.getEvent.get(params.id);

		if (!event) {
			return json(
				{
					error: 'Event not found'
				},
				{ status: 404 }
			);
		}

		// Get associated data
		const dates = dbOperations.getEventDates.all(params.id);
		const timeSlots = dbOperations.getEventTimeSlots.all(params.id);
		const responses = dbOperations.getEventResponses.all(params.id);

		return json({
			...event,
			dates: (dates as { date: string }[]).map((d) => d.date),
			timeSlots: (timeSlots as { time_slot: string }[]).map((t) => t.time_slot),
			responses
		});
	} catch (error) {
		console.error('Database error:', error);
		return json(
			{
				error: 'Failed to retrieve event'
			},
			{ status: 500 }
		);
	}
};
