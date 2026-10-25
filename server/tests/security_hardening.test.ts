import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { validateEnv, ENV } from '../src/config/env';
import { validateDatabaseConfig } from '../src/config/db';
import { User, RefreshToken } from '../src/models';

describe('Phase 1: Commercial SaaS Security Hardening Tests', () => {
  const testEmail = 'sec_harden_test@entrix.local';
  const testPassword = 'SecurePass@2026';

  beforeAll(async () => {
    await sequelize.authenticate();
    const hash = await bcrypt.hash(testPassword, 10);
    const existing = await User.findOne({ where: { email: testEmail } });
    if (!existing) {
      await User.create({
        email: testEmail,
        password_hash: hash,
        first_name: 'Security',
        last_name: 'Hardening',
        role_id: 5,
        is_active: true,
        failed_attempts: 0,
        locked_until: null
      });
    } else {
      await existing.update({
        password_hash: hash,
        failed_attempts: 0,
        locked_until: null
      });
    }
  });

  afterAll(async () => {
    const user = await User.findOne({ where: { email: testEmail } });
    if (user) {
      await RefreshToken.destroy({ where: { user_id: user.id } });
      await user.destroy();
    }
    await sequelize.close();
    server.close();
  });

  describe('1. Startup Configuration & Secrets Fail-Fast Validation', () => {
    it('rejects missing JWT_SECRET at startup with fatal error', () => {
      expect(() => {
        validateEnv({
          NODE_ENV: 'development',
          JWT_SECRET: '',
          JWT_REFRESH_SECRET: 'some_valid_refresh_token_secret_for_tests'
        });
      }).toThrow(/JWT_SECRET must be explicitly set/);
    });

    it('rejects weak JWT_SECRET (< 32 chars) in production', () => {
      expect(() => {
        validateEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'short_key',
          JWT_REFRESH_SECRET: 'valid_refresh_key_with_sufficient_length_32_chars'
        });
      }).toThrow(/at least 32 characters in production/);
    });

    it('rejects default placeholder JWT_SECRET in production', () => {
      expect(() => {
        validateEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'super_secret_jwt_key_entrix_2026_change_in_production',
          JWT_REFRESH_SECRET: 'valid_refresh_key_with_sufficient_length_32_chars'
        });
      }).toThrow(/Insecure default placeholder JWT_SECRET detected in production/);
    });

    it('rejects malformed JWT_EXPIRES_IN format', () => {
      expect(() => {
        validateEnv({
          NODE_ENV: 'development',
          JWT_SECRET: 'valid_secret_for_dev_at_least_12345',
          JWT_REFRESH_SECRET: 'valid_refresh_secret_at_least_12345',
          JWT_EXPIRES_IN: 'invalid_format'
        });
      }).toThrow(/Invalid JWT_EXPIRES_IN format/);
    });

    it('rejects wildcard (*) CORS origin in production', () => {
      expect(() => {
        validateEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'valid_random_production_secret_key_32chars!',
          JWT_REFRESH_SECRET: 'valid_random_production_refresh_secret_32chars!',
          ALLOWED_ORIGINS: '*'
        });
      }).toThrow(/Wildcard origins \(\*\) are strictly forbidden in production/);
    });
  });

  describe('2. Database Configuration Hardening', () => {
    it('rejects missing database environment variables in production', () => {
      expect(() => {
        validateDatabaseConfig({
          NODE_ENV: 'production',
          DB_HOST: '',
          DB_USER: 'prod_user',
          DB_PASSWORD: 'prod_password'
        });
      }).toThrow(/Missing required production database variables/);
    });

    it('rejects insecure default credentials (postgres/postgres) in production', () => {
      expect(() => {
        validateDatabaseConfig({
          NODE_ENV: 'production',
          DB_HOST: 'db.prod.internal',
          DB_PORT: '5432',
          DB_USER: 'postgres',
          DB_PASSWORD: 'postgres',
          DB_NAME: 'entrix_erp'
        });
      }).toThrow(/Insecure default database credentials \(postgres\/postgres\) are not permitted in production/);
    });

    it('allows safe local development defaults', () => {
      const config = validateDatabaseConfig({
        NODE_ENV: 'development'
      });
      expect(config.dbHost).toBe('localhost');
      expect(config.dbPort).toBe(5434);
      expect(config.dbName).toBe('entrix_erp');
    });
  });

  describe('3. CORS Allowlist Enforcement', () => {
    it('allows whitelisted browser origin and sets Access-Control-Allow-Origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects unauthorized browser origin with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://malicious-evil-site.com');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('CORS blocked');
    });

    it('allows requests with missing Origin header (non-browser clients, cURL, server-to-server)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ONLINE');
    });
  });

  describe('4. Login Rate Limiting Middleware Wiring', () => {
    it('verifies rate limiter is wired to POST /api/v1/auth/login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@entrix.local', password: 'AnyPassword' });

      expect(res.status).toBe(401);
      // express-rate-limit standardHeaders emits ratelimit-* headers
      expect(
        res.headers['ratelimit-limit'] !== undefined || res.headers['x-ratelimit-limit'] !== undefined
      ).toBe(true);
    });
  });

  describe('5. Per-Account Lockout, Expiry, and Nonexistent Account Protection', () => {
    it('nonexistent account returns 401 without leaking user existence', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'definitely_does_not_exist_at_all@entrix.local',
          password: 'RandomPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    it('locks account after 5 consecutive failed attempts and handles lockout expiry', async () => {
      // Reset state for test user
      await User.update(
        { failed_attempts: 0, locked_until: null },
        { where: { email: testEmail } }
      );

      // Attempts 1 to 4 return 401
      for (let i = 1; i <= 4; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: testEmail, password: 'WrongPassword' });
        expect(res.status).toBe(401);
      }

      // 5th attempt locks the account with HTTP 423
      const fifthRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });
      expect(fifthRes.status).toBe(423);
      expect(fifthRes.body.error).toContain('temporarily locked');

      // Subsequent attempt with correct password remains blocked while locked
      const blockedRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(blockedRes.status).toBe(423);

      // Simulate lockout expiration: set locked_until to the past
      await User.update(
        { locked_until: new Date(Date.now() - 60000) },
        { where: { email: testEmail } }
      );

      // Now valid login succeeds and resets failure state
      const validLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(validLoginRes.status).toBe(200);
      expect(validLoginRes.body.success).toBe(true);

      const updatedUser = await User.findOne({ where: { email: testEmail } });
      expect(updatedUser?.failed_attempts).toBe(0);
      expect(updatedUser?.locked_until).toBeNull();
    });

    it('handles atomic concurrent failed logins without bypassing lockout threshold', async () => {
      await User.update(
        { failed_attempts: 0, locked_until: null },
        { where: { email: testEmail } }
      );

      // Fire 6 concurrent requests simultaneously
      const promises = Array.from({ length: 6 }).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: testEmail, password: 'IncorrectConcurrentPassword' })
      );

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      // At least one request must have hit HTTP 423
      expect(statuses).toContain(423);

      const user = await User.findOne({ where: { email: testEmail } });
      expect(user?.failed_attempts).toBeGreaterThanOrEqual(5);
      expect(user?.locked_until).not.toBeNull();
    });

    it('super admin can unlock a locked user via /api/v1/auth/unlock', async () => {
      // Lock user first
      await User.update(
        { failed_attempts: 5, locked_until: new Date(Date.now() + 900000) },
        { where: { email: testEmail } }
      );

      // Login as super admin to get token
      const adminLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@entrix.local', password: 'Admin@123' });
      const adminToken = adminLogin.body.access_token;

      // Unlock user
      const unlockRes = await request(app)
        .post('/api/v1/auth/unlock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: testEmail });

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.success).toBe(true);

      const unlockedUser = await User.findOne({ where: { email: testEmail } });
      expect(unlockedUser?.failed_attempts).toBe(0);
      expect(unlockedUser?.locked_until).toBeNull();
    });
  });

  describe('6. JWT Cryptographic Verification & Expiry Enforcement', () => {
    it('rejects access when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No token provided');
    });

    it('rejects expired JWT token with 401', async () => {
      const expiredToken = jwt.sign(
        { id: '11111111-1111-1111-1111-111111111111', email: 'test@entrix.local', role_id: 1, role_name: 'STAFF_USER' },
        ENV.JWT_SECRET,
        { expiresIn: '-1s', algorithm: 'HS256' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('expired');
    });

    it('rejects token signed with an invalid / forged secret', async () => {
      const forgedToken = jwt.sign(
        { id: '11111111-1111-1111-1111-111111111111', email: 'test@entrix.local', role_id: 1, role_name: 'SUPER_ADMIN' },
        'wrong_attacker_secret_key_1234567890',
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or expired token');
    });

    it('rejects token with algorithm none (algorithm confusion attack)', async () => {
      const unsignedPayload = Buffer.from(
        JSON.stringify({ id: '11111111-1111-1111-1111-111111111111', role_name: 'SUPER_ADMIN' })
      ).toString('base64');
      const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
      const noneToken = `${noneHeader}.${unsignedPayload}.`;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
    });
  });
});
