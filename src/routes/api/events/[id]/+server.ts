import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This is a basic example. In a real app, you'd want to use a database
let events: any[] = [];

export const GET: RequestHandler = async ({ params }) => {
    const event = events.find(e => e.id === params.id);
    
    if (!event) {
        return json({
            error: 'Event not found'
        }, { status: 404 });
    }

    return json(event);
};