import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbOperations } from '$lib/db/database';
import bcrypt from 'bcrypt';

// Add these type definitions
interface HasPasswordResult {
    count: number;
}

interface StoredPassword {
    password_hash: string;
}

export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const { participantName, availability, timezone, password, editingPassword } = await request.json();

        if (!participantName) {
            return json(
                {
                    success: false,
                    error: 'Participant name is required'
                },
                { status: 400 }
            );
        }

        // Fix type assertion for hasPasswordResult
        const hasPasswordResult = dbOperations.hasPassword.get(params.id, participantName) as HasPasswordResult;
        const participantHasPassword = hasPasswordResult.count > 0;

        if (participantHasPassword) {
            // Fix type assertion for storedPassword
            const storedPassword = dbOperations.getParticipantPassword.get(params.id, participantName) as StoredPassword;
            
            if (!editingPassword) {
                return json(
                    {
                        success: false,
                        error: 'Password required',
                        type: 'password_required'
                    },
                    { status: 401 }
                );
            }

            const passwordValid = await bcrypt.compare(editingPassword, storedPassword.password_hash);
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
        }

        // Handle new participant with password
        if (!participantHasPassword && password) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            dbOperations.setParticipantPassword.run(params.id, participantName, passwordHash);
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
        const responses = dbOperations.getEventResponsesWithPassword.all(params.id);
        return json(responses);
    } catch (error) {
        console.error('Error fetching responses:', error);
        return json(
            {
                success: false,
                error: 'Failed to fetch responses'
            },
            { status: 500 }
        );
    }
};