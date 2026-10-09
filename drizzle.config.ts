import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/schema.ts',
  out: './server/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: 'file:./data/traceback.db',
  },
});
