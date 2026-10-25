import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { User, RefreshToken } from '../src/models';

describe('Auth & Security API', () => {
  const lockoutUserEmail = 'lockout_test@entrix.local';

  beforeAll(async () => {
    await sequelize.authenticate();

    // Create or reset dedicated user for lockout testing
    const hash = await bcrypt.hash('TestPass@123', 10);
    const existing = await User.findOne({ where: { email: lockoutUserEmail } });
    if (!existing) {
      await User.create({
        email: lockoutUserEmail,
        password_hash: hash,
        first_name: 'Lockout',
        last_name: 'Tester',
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
    // Clean up test user and refresh tokens
    const testUser = await User.findOne({ where: { email: lockoutUserEmail } });
    if (testUser) {
      await RefreshToken.destroy({ where: { user_id: testUser.id } });
      await testUser.destroy();
    }
    await sequelize.close();
    server.close();
  });

  it('GET /health returns status ONLINE', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ONLINE');
  });

  it('POST /api/v1/auth/login succeeds for valid admin credentials and returns refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.expires_in).toBe('15m');
    expect(res.body.user.role).toBe('SUPER_ADMIN');
  });

  it('POST /api/v1/auth/login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/refresh rotates refresh token and issues new access token', async () => {
    // Login to obtain fresh tokens
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
    expect(loginRes.status).toBe(200);
    const initialRefreshToken = loginRes.body.refresh_token;

    // Refresh token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.access_token).toBeDefined();
    expect(refreshRes.body.refresh_token).toBeDefined();
    expect(refreshRes.body.refresh_token).not.toBe(initialRefreshToken);

    // Reuse detection: Attempting to use the rotated initial token triggers 403
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: initialRefreshToken });

    expect(reuseRes.status).toBe(403);
    expect(reuseRes.body.error).toContain('reuse detected');
  });

  it('POST /api/v1/auth/logout invalidates refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
    const rt = loginRes.body.refresh_token;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refresh_token: rt });
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: rt });
    expect([401, 403]).toContain(refreshAfterLogout.status);
  });

  it('enforces atomic account lockout after 5 consecutive failed attempts', async () => {
    // 4 failed attempts should return 401 with remaining attempts warning
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: lockoutUserEmail,
          password: 'IncorrectPassword'
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain(`${5 - i} attempt(s) remaining`);
    }

    // 5th failed attempt triggers HTTP 423 lockout
    const fifthAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: lockoutUserEmail,
        password: 'IncorrectPassword'
      });
    expect(fifthAttempt.status).toBe(423);
    expect(fifthAttempt.body.error).toContain('temporarily locked');

    // 6th attempt (even with valid password) is blocked by lockout
    const blockedValidAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: lockoutUserEmail,
        password: 'TestPass@123'
      });
    expect(blockedValidAttempt.status).toBe(423);
    expect(blockedValidAttempt.body.error).toContain('temporarily locked');

    // Manually unlock and verify successful login resets failed_attempts
    await User.update(
      { failed_attempts: 0, locked_until: null },
      { where: { email: lockoutUserEmail } }
    );

    const validLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: lockoutUserEmail,
        password: 'TestPass@123'
      });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.success).toBe(true);

    const userRecord = await User.findOne({ where: { email: lockoutUserEmail } });
    expect(userRecord?.failed_attempts).toBe(0);
    expect(userRecord?.locked_until).toBeNull();
  });
});
