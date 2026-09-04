import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/* ---------------------------------------------------------------------------
 * Migration calistirici. `npm run db:migrate`.
 *
 * Uygulama kodundan ayri durur: burasi kendi baglantisini acar, cunku
 * src/db/index.ts "server-only" isaretlidir ve Node betiginden yuklenemez.
 * ------------------------------------------------------------------------ */

const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "sima.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

migrate(drizzle(sqlite), {
  migrationsFolder: path.join(process.cwd(), "src", "db", "migrations"),
});

sqlite.close();
console.log(`[db] migration tamam -> ${file}`);
