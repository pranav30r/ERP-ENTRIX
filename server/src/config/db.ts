import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env or server/.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface DatabaseEnvConfig {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
}

export const validateDatabaseConfig = (env: NodeJS.ProcessEnv = process.env): DatabaseEnvConfig => {
  const isProduction = (env.NODE_ENV || 'development') === 'production';

  if (isProduction) {
    const missing: string[] = [];
    if (!env.DB_HOST) missing.push('DB_HOST');
    if (!env.DB_PORT) missing.push('DB_PORT');
    if (!env.DB_USER) missing.push('DB_USER');
    if (env.DB_PASSWORD === undefined || env.DB_PASSWORD === '') missing.push('DB_PASSWORD');
    if (!env.DB_NAME) missing.push('DB_NAME');

    if (missing.length > 0) {
      throw new Error(`[FATAL SECURITY ERROR] Missing required production database variables: ${missing.join(', ')}.`);
    }

    if (env.DB_USER === 'postgres' && env.DB_PASSWORD === 'postgres') {
      throw new Error('[FATAL SECURITY ERROR] Insecure default database credentials (postgres/postgres) are not permitted in production.');
    }
  }

  return {
    dbHost: env.DB_HOST || 'localhost',
    dbPort: parseInt(env.DB_PORT || '5434', 10),
    dbUser: env.DB_USER || 'postgres',
    dbPassword: env.DB_PASSWORD !== undefined ? env.DB_PASSWORD : 'postgres',
    dbName: env.DB_NAME || 'entrix_erp'
  };
};

const dbConfig = validateDatabaseConfig();

export const sequelize = new Sequelize(dbConfig.dbName, dbConfig.dbUser, dbConfig.dbPassword, {
  host: dbConfig.dbHost,
  port: dbConfig.dbPort,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? false : false,
  pool: {
    max: 20,
    min: 2,
    acquire: 30000,
    idle: 10000
  }
});

export const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log(`[DB] PostgreSQL Connected successfully to ${dbConfig.dbHost}:${dbConfig.dbPort}/${dbConfig.dbName}`);
  } catch (error) {
    console.error('[DB] PostgreSQL Connection failed. Ensure PostgreSQL is running on the configured port.');
    process.exit(1);
  }
};
