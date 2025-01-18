import Database from 'better-sqlite3';

// Create a database instance
const db = new Database('events.db', { verbose: console.log });

// Initialize database with tables
export function initializeDatabase() {
    try {
        // Create events table
        db.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                creator TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS event_dates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT,
                date TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id)
            );

            CREATE TABLE IF NOT EXISTS event_time_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT,
                time_slot TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id)
            );

            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT,
                participant_name TEXT NOT NULL,
                date TEXT NOT NULL,
                time_slot TEXT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(id)
            );
        `);

        console.log('Database tables created successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Initialize the database before preparing statements
initializeDatabase();

// Now prepare the statements
export const dbOperations = {
    // Create a new event
    createEvent: db.prepare(`
        INSERT INTO events (id, name, creator)
        VALUES (?, ?, ?)
    `),

    // Add event dates
    addEventDate: db.prepare(`
        INSERT INTO event_dates (event_id, date)
        VALUES (?, ?)
    `),

    // Add event time slots
    addEventTimeSlot: db.prepare(`
        INSERT INTO event_time_slots (event_id, time_slot)
        VALUES (?, ?)
    `),

    // Get event by ID
    getEvent: db.prepare(`
        SELECT * FROM events WHERE id = ?
    `),

    // Get event dates
    getEventDates: db.prepare(`
        SELECT date FROM event_dates WHERE event_id = ?
    `),

    // Get event time slots
    getEventTimeSlots: db.prepare(`
        SELECT time_slot FROM event_time_slots WHERE event_id = ?
    `),

    // Add response
    addResponse: db.prepare(`
        INSERT INTO responses (event_id, participant_name, date, time_slot)
        VALUES (?, ?, ?, ?)
    `),

    // Get responses for an event
    getEventResponses: db.prepare(`
        SELECT * FROM responses WHERE event_id = ?
    `)
};

export { db };