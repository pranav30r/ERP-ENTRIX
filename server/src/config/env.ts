import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from workspace root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  LOCKOUT_MAX_ATTEMPTS: number;
  LOCKOUT_DURATION_MINUTES: number;
  ALLOWED_ORIGINS: string[];
}

export const validateEnv = (env: NodeJS.ProcessEnv = process.env): EnvironmentConfig => {
  const NODE_ENV = env.NODE_ENV || 'development';
  const isProduction = NODE_ENV === 'production';

  // 1. JWT_SECRET Validation - Never allow missing or fallback secrets in any environment
  const rawJwtSecret = env.JWT_SECRET;
  if (!rawJwtSecret || rawJwtSecret.trim().length === 0) {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET must be explicitly set.');
  }

  if (isProduction) {
    if (rawJwtSecret.length < 32) {
      throw new Error('[FATAL SECURITY ERROR] JWT_SECRET must be at least 32 characters in production.');
    }
    const lower = rawJwtSecret.toLowerCase();
    if (
      lower.includes('change_in_production') ||
      lower.includes('super_secret') ||
      lower.includes('placeholder') ||
      lower.includes('default')
    ) {
      throw new Error('[FATAL SECURITY ERROR] Insecure default placeholder JWT_SECRET detected in production.');
    }
  }

  // 2. JWT_REFRESH_SECRET Validation
  const rawRefreshSecret = env.JWT_REFRESH_SECRET;
  if (!rawRefreshSecret || rawRefreshSecret.trim().length === 0) {
    throw new Error('[FATAL SECURITY ERROR] JWT_REFRESH_SECRET must be explicitly set.');
  }

  if (isProduction) {
    if (rawRefreshSecret.length < 32) {
      throw new Error('[FATAL SECURITY ERROR] JWT_REFRESH_SECRET must be at least 32 characters in production.');
    }
    const lowerRefresh = rawRefreshSecret.toLowerCase();
    if (
      lowerRefresh.includes('change_in_production') ||
      lowerRefresh.includes('super_secret') ||
      lowerRefresh.includes('placeholder')
    ) {
      throw new Error('[FATAL SECURITY ERROR] Insecure default placeholder JWT_REFRESH_SECRET detected in production.');
    }
  }

  // 3. Expiry format validation (e.g., 15m, 1h, 7d, 3600s)
  const durationRegex = /^(\d+)([smhd])$/;
  const jwtExpiresIn = env.JWT_EXPIRES_IN || '15m';
  if (!durationRegex.test(jwtExpiresIn)) {
    throw new Error(`[FATAL SECURITY ERROR] Invalid JWT_EXPIRES_IN format: '${jwtExpiresIn}'. Must match format like 15m, 1h, 7d.`);
  }

  const jwtRefreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN || '7d';
  if (!durationRegex.test(jwtRefreshExpiresIn)) {
    throw new Error(`[FATAL SECURITY ERROR] Invalid JWT_REFRESH_EXPIRES_IN format: '${jwtRefreshExpiresIn}'. Must match format like 7d, 30d.`);
  }

  // 4. CORS Origins Validation
  const rawOrigins = env.ALLOWED_ORIGINS || env.CLIENT_ORIGIN;
  let allowedOrigins: string[];

  if (!rawOrigins || rawOrigins.trim().length === 0) {
    if (isProduction) {
      throw new Error('[FATAL SECURITY ERROR] CLIENT_ORIGIN or ALLOWED_ORIGINS must be explicitly configured in production.');
    }
    allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
  } else {
    allowedOrigins = rawOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  }

  if (isProduction) {
    for (const origin of allowedOrigins) {
      if (origin === '*' || origin.includes('*')) {
        throw new Error('[FATAL SECURITY ERROR] Wildcard origins (*) are strictly forbidden in production.');
      }
    }
  }

  return {
    NODE_ENV,
    PORT: parseInt(env.PORT || '5000', 10),
    JWT_SECRET: rawJwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    JWT_REFRESH_SECRET: rawRefreshSecret,
    JWT_REFRESH_EXPIRES_IN: jwtRefreshExpiresIn,
    LOCKOUT_MAX_ATTEMPTS: parseInt(env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
    LOCKOUT_DURATION_MINUTES: parseInt(env.LOCKOUT_DURATION_MINUTES || '15', 10),
    ALLOWED_ORIGINS: allowedOrigins
  };
};

export const ENV = validateEnv();
