import fs from 'fs';
import path from 'path';
import { sequelize } from '../config/db';

export interface MigrationResult {
  appliedCount: number;
  appliedMigrations: string[];
}

export const runMigrations = async (): Promise<MigrationResult> => {
  // 1. Create schema_migrations tracker if it does not exist
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Locate migrations directory across ts/js environments
  const candidateDirs = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'server/src/db/migrations')
  ];

  const migrationsDir = candidateDirs.find((d) => fs.existsSync(d));
  if (!migrationsDir) {
    throw new Error(`Migrations directory not found in candidate paths: ${candidateDirs.join(', ')}`);
  }

  // 3. Find already applied migrations
  const [rows]: [any[], unknown] = await sequelize.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedSet = new Set<string>(rows.map((r: any) => r.version));

  // 4. Read and sort migration files
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedMigrations: string[] = [];

  for (const file of files) {
    const version = file.split('_')[0];
    if (appliedSet.has(version)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Run each migration within an atomic transaction
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(sql, { transaction });
      await sequelize.query(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (:version, :name, NOW());',
        {
          replacements: { version, name: file },
          transaction
        }
      );
    });

    console.log(`[MIGRATION] Applied: ${file}`);
    appliedMigrations.push(file);
  }

  if (appliedMigrations.length === 0) {
    console.log(`[MIGRATION] Database schema is up to date (${rows.length} migration(s) applied).`);
  } else {
    console.log(`[MIGRATION] Successfully executed ${appliedMigrations.length} migration(s).`);
  }

  return {
    appliedCount: appliedMigrations.length,
    appliedMigrations
  };
};

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATION] Migration run failed:', err);
      process.exit(1);
    });
}
