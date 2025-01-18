import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This is a basic example. In a real app, you'd want to use a database
let events: any[] = [];

export const POST: RequestHandler = async ({ request }) => {
    try {
        const eventData = await request.json();
        
        // In a real application, you would save this to a database
        events.push(eventData);

        return json({
            success: true,
            eventId: eventData.id
        });
    } catch (error) {
        return json({
            success: false,
            error: 'Failed to create event'
        }, { status: 500 });
    }
};