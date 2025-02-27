import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbOperations } from '$lib/db/database';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;

		// Get event details
		const event = dbOperations.getEvent.get(id);
		if (!event) {
			return json({ error: 'Event not found' }, { status: 404 });
		}

		// Get dates
		const dates = dbOperations.getEventDates.all(id).map((row: any) => row.date);

		// Get time slots
		const timeSlots = dbOperations.getEventTimeSlots.all(id).map((row: any) => row.time_slot);

		// Get responses with password status
		const responses = dbOperations.getEventResponsesWithPassword.all(id);

		return json({
			...event,
			dates,
			timeSlots,
			responses
		});
	} catch (error) {
		console.error('Error retrieving event:', error);
		return json({ error: 'Failed to retrieve event' }, { status: 500 });
	}
};
