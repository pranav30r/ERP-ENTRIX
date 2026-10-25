import { sequelize } from '../config/db';
import { runMigrations } from './migrate';

/**
 * Initializes database safely using versioned, non-destructive migrations.
 * Preserves all existing business data and records execution state in schema_migrations.
 */
export const initializeDatabase = async (): Promise<void> => {
  console.log('[DB] Running versioned database migrations...');
  const result = await runMigrations();
  console.log(`[DB] Database ready. Applied ${result.appliedCount} new migration(s).`);
};

if (require.main === module) {
  initializeDatabase()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB] Failed to initialize schema:', err);
      process.exit(1);
    });
}
