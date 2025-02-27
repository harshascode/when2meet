import { json } from '@sveltejs/kit';
import { dbOperations } from '$lib/db/database';

export async function POST({ request }) {
	try {
		const eventData = await request.json();
		const { id, name, dates, timeSlots } = eventData;

		// Start a transaction
		const transaction = dbOperations.db.transaction(() => {
			// Create event
			dbOperations.createEvent.run(id, name, null);

			// Add dates
			for (const date of dates) {
				dbOperations.addEventDate.run(id, date);
			}

			// Add time slots
			for (const timeSlot of timeSlots) {
				dbOperations.addEventTimeSlot.run(id, timeSlot);
			}
		});

		// Execute transaction
		transaction();

		return json({ success: true, id });
	} catch (error) {
		console.error('Error creating event:', error);
		return json({ success: false, error: 'Failed to create event' }, { status: 500 });
	}
}
