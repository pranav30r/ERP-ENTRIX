import { sequelize } from '../src/config/db';
import { initializeDatabase } from '../src/db/initDb';

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    // Check if the 'users' table exists
    const [results] = await sequelize.query(`
      SELECT to_regclass('public.users') as exists;
    `);
    const tableExists = results && (results[0] as any)?.exists !== null;

    if (!tableExists) {
      console.log('[Test Setup] Target tables missing. Bootstrapping PostgreSQL schema...');
      await initializeDatabase();
    }
  } catch (error) {
    console.warn('[Test Setup] Database bootstrap warning:', error);
  }
});
