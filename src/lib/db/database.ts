import Database from 'better-sqlite3';

// Create a database instance
const db = new Database('events.db', { verbose: console.log });

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
// Add these pragmas for better performance
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 30000000000');
db.pragma('page_size = 32768');

// Initialize database with tables
export function initializeDatabase() {
	try {
		// Create events table (remove duplicates)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id)
            );

            CREATE TABLE IF NOT EXISTS participant_passwords (
                event_id TEXT,
                participant_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (event_id, participant_name),
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
	db, // Export the db instance through dbOperations
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
    `),

	// Delete existing responses for a participant in an event
	deleteParticipantResponses: db.prepare(`
        DELETE FROM responses 
        WHERE event_id = ? AND participant_name = ?
    `),

	// Get participant password
	getParticipantPassword: db.prepare(`
        SELECT password_hash
        FROM participant_passwords
        WHERE event_id = ? AND participant_name = ?
    `),

	// Set participant password
	setParticipantPassword: db.prepare(`
        INSERT OR REPLACE INTO participant_passwords (event_id, participant_name, password_hash)
        VALUES (?, ?, ?)
    `),

	// Check if participant has password
	hasPassword: db.prepare(`
        SELECT COUNT(*) as count
        FROM participant_passwords
        WHERE event_id = ? AND participant_name = ?
    `),

	// Get participant responses with password status
	getEventResponsesWithPassword: db.prepare(`
        SELECT r.*, 
            CASE WHEN pp.password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password
        FROM responses r
        LEFT JOIN participant_passwords pp 
            ON r.event_id = pp.event_id 
            AND r.participant_name = pp.participant_name
        WHERE r.event_id = ?
    `)
};
