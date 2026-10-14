import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root or cwd
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'utility_assets',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [],
  migrations: [path.join(__dirname, '../database/migrations/*{.ts,.js}')],
});
