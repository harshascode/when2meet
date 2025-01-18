import type { Handle } from '@sveltejs/kit';

// The database initialization is now handled in the database.ts file
// No need to initialize it here as it's done when the module is imported

export const handle: Handle = async ({ event, resolve }) => {
    return resolve(event);
};