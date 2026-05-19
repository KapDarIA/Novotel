const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { seedUsers, seedRooms, seedServices, seedReviews } = require('./seed');

function createSqliteDb() {
  const dbPath = path.join(__dirname, '..', 'novotel.db');
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA foreign_keys = ON');

  return {
    label: 'SQLite',
    async exec(sql) {
      raw.exec(sql);
    },
    async get(sql, params = []) {
      return raw.prepare(sql).get(...params);
    },
    async all(sql, params = []) {
      return raw.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const result = raw.prepare(sql).run(...params);
      return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
    },
  };
}

async function initSqlite() {
  const db = createSqliteDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')) DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      image_url TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      description TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS service_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      booking_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      service_time TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hotel_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await seedUsers(db);
  await seedRooms(db);
  await seedServices(db);
  await seedReviews(db);
  return db;
}

module.exports = { initSqlite };
