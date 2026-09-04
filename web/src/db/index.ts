import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

/* ---------------------------------------------------------------------------
 * Tek veritabani baglantisi.
 *
 * better-sqlite3 senkron calisir; Node surecinde tek bir baglanti yeterlidir.
 * Gelistirmede HMR her modul yenilemesinde yeni baglanti acmasin diye
 * globalThis uzerinde onbelleklenir.
 * ------------------------------------------------------------------------ */

const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "sima.db");

function open() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  // WAL: okuma yazmayi bloklamaz. Panelde uzun listeler donerken yazma devam eder.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as { __simaDb?: ReturnType<typeof open> };

export const db = globalForDb.__simaDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__simaDb = db;

export { schema };
export const DB_FILE = file;
