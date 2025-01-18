import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbOperations } from '$lib/db/database';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const eventData = await request.json();
        
        // Start database operations
        dbOperations.createEvent.run(
            eventData.id,
            eventData.name,
            eventData.creator
        );

        // Add dates
        for (const date of eventData.dates) {
            dbOperations.addEventDate.run(eventData.id, date);
        }

        // Add time slots
        for (const timeSlot of eventData.timeSlots) {
            dbOperations.addEventTimeSlot.run(eventData.id, timeSlot);
        }

        return json({
            success: true,
            eventId: eventData.id
        });
    } catch (error) {
        console.error('Database error:', error);
        return json({
            success: false,
            error: 'Failed to create event'
        }, { status: 500 });
    }
};