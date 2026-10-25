import fs from 'fs';
import path from 'path';
import { sequelize } from '../config/db';

export const initializeDatabase = async (): Promise<void> => {
  const candidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql')
  ];

  const schemaPath = candidates.find((p) => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error(`schema.sql not found in candidate paths: ${candidates.join(', ')}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  await sequelize.query(sql);
  console.log(`[DB] Database schema and initial seeds applied successfully from ${schemaPath}`);
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
