import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from workspace root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const rawJwtSecret = process.env.JWT_SECRET;

// Enforce strict production requirements
if (isProduction) {
  if (!rawJwtSecret) {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET must be explicitly set in production.');
  }
  if (rawJwtSecret.length < 32) {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET must be at least 32 characters in production.');
  }
  if (rawJwtSecret.includes('change_in_production') || rawJwtSecret.includes('super_secret')) {
    throw new Error('[FATAL SECURITY ERROR] Insecure default placeholder JWT_SECRET detected in production.');
  }
} else if (!rawJwtSecret) {
  console.warn('[SECURITY WARNING] JWT_SECRET is unset in development. Falling back to development key.');
}

export const ENV = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '5000', 10),
  JWT_SECRET: rawJwtSecret || 'super_secret_jwt_key_entrix_2026_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000']
};
