const { initSqlite } = require('./sqlite');
const { initMysql } = require('./mysql');

let db = null;

function datesOverlap(checkIn, checkOut, existingIn, existingOut) {
  const a = String(checkIn).slice(0, 10);
  const b = String(checkOut).slice(0, 10);
  const c = String(existingIn).slice(0, 10);
  const d = String(existingOut).slice(0, 10);
  return a < d && c < b;
}

async function hasBookingConflict(roomId, checkIn, checkOut, excludeBookingId = null) {
  let sql = 'SELECT id, check_in, check_out FROM bookings WHERE room_id = ?';
  const params = [roomId];
  if (excludeBookingId) {
    sql += ' AND id != ?';
    params.push(excludeBookingId);
  }
  const bookings = await db.all(sql, params);
  return bookings.some((b) =>
    datesOverlap(checkIn, checkOut, b.check_in, b.check_out)
  );
}

async function initDb() {
  const type = (process.env.DB_TYPE || 'sqlite').toLowerCase();
  if (type === 'mysql') {
    db = await initMysql();
    console.log(`База данных: MySQL (${process.env.MYSQL_DATABASE || 'novotel_db'})`);
  } else {
    db = await initSqlite();
    console.log('База данных: SQLite (файл novotel.db)');
  }
  return db;
}

function getDb() {
  if (!db) throw new Error('База данных не инициализирована. Вызовите initDb() перед стартом сервера.');
  return db;
}

module.exports = { initDb, getDb, hasBookingConflict };
