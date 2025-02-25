import jwt from 'jsonwebtoken';
import { sha256 } from 'js-sha256';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // In production, always use environment variable
const TOKEN_EXPIRY = '24h';

export interface JWTPayload {
	participantName: string;
	eventId: string;
}

export const generateToken = (payload: JWTPayload): string => {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

export const verifyToken = (token: string): JWTPayload | null => {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		return null;
	}
};

export const hashPassword = (password: string): string => {
	return sha256(password);
};
