import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, schema } from './db';
import { now, WORKSPACE_ID, OWNER_ID } from './lib/helpers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function bootstrap() {
  await migrate(db, { migrationsFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations') });
  await db.insert(schema.workspaces).values({ id: WORKSPACE_ID, name: 'My workspace', slug: 'my-workspace', creditsRemaining: 1000, creditsTotal: 1000, createdAt: now() }).onConflictDoNothing();
  await db.insert(schema.users).values({ id: OWNER_ID, workspaceId: WORKSPACE_ID, email: 'owner@localhost', name: 'Workspace owner', initials: 'WO', color: 'from-slate-500 to-slate-700', role: 'owner', createdAt: now() }).onConflictDoNothing();
}
