import { sequelize } from '../src/config/db';
import { runMigrations } from '../src/db/migrate';

describe('Versioned Database Migrations', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('runs migrations idempotently and tracks execution in schema_migrations', async () => {
    const result = await runMigrations();
    expect(result).toBeDefined();
    expect(typeof result.appliedCount).toBe('number');

    const [rows]: any = await sequelize.query(
      'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((r: any) => r.version)).toContain('001');
    expect(rows.map((r: any) => r.version)).toContain('002');
  });

  it('preserves existing table data across migration runs', async () => {
    const [userRows]: any = await sequelize.query('SELECT count(*) as count FROM users;');
    const userCount = parseInt(userRows[0].count, 10);
    expect(userCount).toBeGreaterThan(0);

    // Re-running migrations must not drop tables or delete data
    const secondRun = await runMigrations();
    expect(secondRun.appliedCount).toBe(0);

    const [afterRows]: any = await sequelize.query('SELECT count(*) as count FROM users;');
    const afterCount = parseInt(afterRows[0].count, 10);
    expect(afterCount).toBe(userCount);
  });
});
