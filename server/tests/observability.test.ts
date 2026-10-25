import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';

describe('Observability, Health Probes & Correlation Tracking', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('GET /health returns liveness payload with uptime and timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ONLINE');
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(res.body.timestamp).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /ready evaluates database readiness without exposing topology or credentials', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBe('UP');
    expect(res.body.uptime_seconds).toBeDefined();
    // Verify no sensitive keys leaked in payload
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('postgres:');
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('JWT_SECRET');
  });

  it('propagates incoming X-Request-ID and echoes on response headers', async () => {
    const customId = 'client-trace-uuid-12345';
    const res = await request(app)
      .get('/health')
      .set('X-Request-ID', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.headers['x-correlation-id']).toBe(customId);
  });
});
