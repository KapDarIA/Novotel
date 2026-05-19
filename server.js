require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDb, getDb, hasBookingConflict } = require('./db');
const { validateServiceBooking } = require('./db/validators');
const { userHasBooking, formatReviewRow } = require('./db/reviews');
const XLSX = require('xlsx');

function parseMonthParam(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const monthStart = `${month}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const monthEndExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { month, monthStart, monthEndExclusive, label: month };
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(String(checkIn).slice(0, 10) + 'T12:00:00');
  const b = new Date(String(checkOut).slice(0, 10) + 'T12:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpe?g|png|webp|gif)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Допустимы только изображения'));
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'novotel-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function getSessionUser(req) {
  if (!req.session.userId) return null;
  const db = getDb();
  return db.get('SELECT id, login, role FROM users WHERE id = ?', [req.session.userId]);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getSessionUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администратора' });
  }
  next();
}

app.get(
  '/api/auth/me',
  asyncRoute(async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) {
      return res.json({ user: null, role: 'guest' });
    }
    res.json({ user: { id: user.id, login: user.login, role: user.role }, role: user.role });
  })
);

app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }
    if (login.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Логин от 3 символов, пароль от 6' });
    }
    const exists = await db.get('SELECT id FROM users WHERE login = ?', [login]);
    if (exists) {
      return res.status(409).json({ error: 'Такой логин уже занят' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      'INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)',
      [login, hash, 'user']
    );
    req.session.userId = result.lastInsertRowid;
    res.status(201).json({
      user: { id: result.lastInsertRowid, login, role: 'user' },
      role: 'user',
    });
  })
);

app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }
    const user = await db.get('SELECT * FROM users WHERE login = ?', [login]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    req.session.userId = user.id;
    res.json({
      user: { id: user.id, login: user.login, role: user.role },
      role: user.role,
    });
  })
);

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get(
  '/api/rooms',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { search, type, sort } = req.query;
    let sql = 'SELECT * FROM rooms WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR type LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY price DESC';
    } else {
      sql += ' ORDER BY id ASC';
    }

    const rooms = await db.all(sql, params);
    res.json(rooms);
  })
);

app.get(
  '/api/rooms/types',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const types = await db.all('SELECT DISTINCT type FROM rooms ORDER BY type');
    res.json(types.map((t) => t.type));
  })
);

app.get(
  '/api/rooms/:id',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    res.json(room);
  })
);

app.post(
  '/api/rooms',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { name, type, price, description } = req.body;
    if (!name || !type || price === undefined || price === '') {
      return res.status(400).json({ error: 'Заполните название, тип и цену' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url || null;
    const result = await db.run(
      'INSERT INTO rooms (name, type, price, image_url, description) VALUES (?, ?, ?, ?, ?)',
      [name, type, Number(price), imageUrl, description || null]
    );
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(room);
  })
);

app.put(
  '/api/rooms/:id',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  asyncRoute(async (req, res) => {
    const db = getDb();
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });

    const { name, type, price, description, image_url } = req.body;
    let imageUrl = room.image_url;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;
    else if (image_url !== undefined) imageUrl = image_url || null;

    await db.run(
      'UPDATE rooms SET name = ?, type = ?, price = ?, image_url = ?, description = ? WHERE id = ?',
      [
        name ?? room.name,
        type ?? room.type,
        price !== undefined ? Number(price) : room.price,
        imageUrl,
        description !== undefined ? description : room.description,
        req.params.id,
      ]
    );
    const updated = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json(updated);
  })
);

app.delete(
  '/api/rooms/:id',
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    await db.run('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  '/api/bookings/my',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const bookings = await db.all(
      `SELECT b.*, r.name AS room_name, r.type AS room_type, r.price, r.image_url
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       WHERE b.user_id = ?
       ORDER BY b.check_in DESC`,
      [req.session.userId]
    );
    res.json(bookings);
  })
);

app.get(
  '/api/bookings/room/:roomId',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const bookings = await db.all(
      'SELECT check_in, check_out FROM bookings WHERE room_id = ?',
      [req.params.roomId]
    );
    res.json(bookings);
  })
);

app.post(
  '/api/bookings',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { room_id, check_in, check_out } = req.body;
    if (!room_id || !check_in || !check_out) {
      return res.status(400).json({ error: 'Укажите комнату и даты' });
    }
    if (check_in >= check_out) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже заезда' });
    }

    const room = await db.get('SELECT id FROM rooms WHERE id = ?', [room_id]);
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });

    if (await hasBookingConflict(room_id, check_in, check_out)) {
      return res.status(409).json({
        error: 'На выбранные даты номер уже забронирован. Выберите другие даты.',
      });
    }

    const result = await db.run(
      'INSERT INTO bookings (user_id, room_id, check_in, check_out) VALUES (?, ?, ?, ?)',
      [req.session.userId, room_id, check_in, check_out]
    );

    const booking = await db.get(
      `SELECT b.*, r.name AS room_name, r.type AS room_type, r.price, r.image_url
       FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(booking);
  })
);

app.delete(
  '/api/bookings/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });
    const user = await getSessionUser(req);
    if (booking.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на отмену' });
    }
    await db.run('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/bookings',
  requireAuth,
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const bookings = await db.all(
      `SELECT b.*, u.login, r.name AS room_name, r.type AS room_type
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN rooms r ON r.id = b.room_id
       ORDER BY b.check_in DESC`
    );
    res.json(bookings);
  })
);

app.get(
  '/api/admin/bookings/export',
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = parseMonthParam(req.query.month);
    if (!parsed) {
      return res.status(400).json({ error: 'Укажите месяц в формате YYYY-MM (например, 2025-05)' });
    }

    const db = getDb();
    const bookings = await db.all(
      `SELECT b.id, b.check_in, b.check_out, b.created_at,
              u.login, r.name AS room_name, r.type AS room_type, r.price
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN rooms r ON r.id = b.room_id
       WHERE b.check_in < ? AND b.check_out > ?
       ORDER BY b.check_in ASC`,
      [parsed.monthEndExclusive, parsed.monthStart]
    );

    const rows = bookings.map((b) => {
      const nights = nightsBetween(b.check_in, b.check_out);
      const price = Number(b.price) || 0;
      return {
        ID: b.id,
        Логин: b.login,
        Номер: b.room_name,
        'Тип номера': b.room_type,
        Заезд: String(b.check_in).slice(0, 10),
        Выезд: String(b.check_out).slice(0, 10),
        Ночей: nights,
        'Цена за ночь': price,
        'Сумма (₽)': nights * price,
        'Дата бронирования': String(b.created_at || '').slice(0, 19).replace('T', ' '),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Брони ${parsed.month}`);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `novotel-bookings-${parsed.month}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

// ——— Services ———

app.get(
  '/api/services',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { category, search } = req.query;
    let sql = 'SELECT * FROM services WHERE 1=1';
    const params = [];
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    sql += ' ORDER BY category, name';
    res.json(await db.all(sql, params));
  })
);

app.get(
  '/api/services/categories',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db.all('SELECT DISTINCT category FROM services ORDER BY category');
    res.json(rows.map((r) => r.category));
  })
);

app.get(
  '/api/services/:id',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const service = await db.get('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!service) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json(service);
  })
);

app.get(
  '/api/bookings/eligible',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const bookings = await db.all(
      `SELECT b.id, b.check_in, b.check_out, r.name AS room_name
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       WHERE b.user_id = ? AND b.check_out > ?
       ORDER BY b.check_in ASC`,
      [req.session.userId, today]
    );
    res.json(bookings);
  })
);

app.get(
  '/api/service-bookings/my',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const rows = await db.all(
      `SELECT sb.*, s.name AS service_name, s.category, s.price,
              b.check_in, b.check_out, r.name AS room_name
       FROM service_bookings sb
       JOIN services s ON s.id = sb.service_id
       JOIN bookings b ON b.id = sb.booking_id
       JOIN rooms r ON r.id = b.room_id
       WHERE sb.user_id = ?
       ORDER BY sb.service_date DESC, sb.service_time DESC`,
      [req.session.userId]
    );
    res.json(rows);
  })
);

app.post(
  '/api/service-bookings',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { booking_id, service_id, service_date, service_time, notes } = req.body;
    if (!booking_id || !service_id || !service_date) {
      return res.status(400).json({ error: 'Укажите бронь номера, услугу и дату' });
    }

    const service = await db.get('SELECT id FROM services WHERE id = ?', [service_id]);
    if (!service) return res.status(404).json({ error: 'Услуга не найдена' });

    const check = await validateServiceBooking(db, req.session.userId, booking_id, service_date);
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }

    const result = await db.run(
      `INSERT INTO service_bookings (user_id, booking_id, service_id, service_date, service_time, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        booking_id,
        service_id,
        service_date,
        service_time || null,
        notes || null,
      ]
    );

    const row = await db.get(
      `SELECT sb.*, s.name AS service_name, s.category, s.price,
              b.check_in, b.check_out, r.name AS room_name
       FROM service_bookings sb
       JOIN services s ON s.id = sb.service_id
       JOIN bookings b ON b.id = sb.booking_id
       JOIN rooms r ON r.id = b.room_id
       WHERE sb.id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json(row);
  })
);

app.delete(
  '/api/service-bookings/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const row = await db.get('SELECT * FROM service_bookings WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Бронирование услуги не найдено' });
    const user = await getSessionUser(req);
    if (row.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на отмену' });
    }
    await db.run('DELETE FROM service_bookings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

app.post(
  '/api/services',
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { name, category, price, description, image_url } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Укажите название и категорию' });
    }
    const result = await db.run(
      'INSERT INTO services (name, category, price, description, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, category, Number(price) || 0, description || null, image_url || null]
    );
    const service = await db.get('SELECT * FROM services WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(service);
  })
);

app.put(
  '/api/services/:id',
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const service = await db.get('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!service) return res.status(404).json({ error: 'Услуга не найдена' });
    const { name, category, price, description, image_url } = req.body;
    await db.run(
      'UPDATE services SET name = ?, category = ?, price = ?, description = ?, image_url = ? WHERE id = ?',
      [
        name ?? service.name,
        category ?? service.category,
        price !== undefined ? Number(price) : service.price,
        description !== undefined ? description : service.description,
        image_url !== undefined ? image_url : service.image_url,
        req.params.id,
      ]
    );
    res.json(await db.get('SELECT * FROM services WHERE id = ?', [req.params.id]));
  })
);

app.delete(
  '/api/services/:id',
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const service = await db.get('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!service) return res.status(404).json({ error: 'Услуга не найдена' });
    await db.run('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

// ——— Hotel reviews ———

app.get(
  '/api/reviews/summary',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const stats = await db.get(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average
       FROM hotel_reviews`
    );
    const count = Number(stats.count) || 0;
    const average = count ? Number(stats.average) : 0;
    const dist = await db.all(
      `SELECT rating, COUNT(*) AS c FROM hotel_reviews GROUP BY rating ORDER BY rating DESC`
    );
    res.json({ count, average, distribution: dist });
  })
);

app.get(
  '/api/reviews',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { sort } = req.query;
    let order = 'hr.created_at DESC';
    if (sort === 'highest') order = 'hr.rating DESC, hr.created_at DESC';
    if (sort === 'lowest') order = 'hr.rating ASC, hr.created_at DESC';

    const rows = await db.all(
      `SELECT hr.*, u.login
       FROM hotel_reviews hr
       JOIN users u ON u.id = hr.user_id
       ORDER BY ${order}`
    );
    const userId = req.session.userId;
    res.json(
      rows.map((r) => formatReviewRow({ ...r, is_own: userId ? r.user_id === userId : false }))
    );
  })
);

app.get(
  '/api/reviews/my',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const row = await db.get(
      `SELECT hr.*, u.login FROM hotel_reviews hr
       JOIN users u ON u.id = hr.user_id
       WHERE hr.user_id = ?`,
      [req.session.userId]
    );
    if (!row) return res.json({ review: null, canReview: await userHasBooking(db, req.session.userId) });
    const review = formatReviewRow({ ...row, is_own: true });
    res.json({ review, canReview: true });
  })
);

app.post(
  '/api/reviews',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const { rating, comment } = req.body;
    const r = Number(rating);

    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ error: 'Оценка от 1 до 5 звёзд' });
    }
    const text = (comment || '').trim();
    if (text.length < 10) {
      return res.status(400).json({ error: 'Отзыв должен содержать не менее 10 символов' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: 'Отзыв слишком длинный (максимум 2000 символов)' });
    }

    if (!(await userHasBooking(db, req.session.userId))) {
      return res.status(403).json({
        error: 'Оставить отзыв могут только гости, у которых было бронирование номера',
      });
    }

    const existing = await db.get('SELECT id FROM hotel_reviews WHERE user_id = ?', [
      req.session.userId,
    ]);

    if (existing) {
      await db.run(
        'UPDATE hotel_reviews SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [r, text, req.session.userId]
      );
    } else {
      await db.run('INSERT INTO hotel_reviews (user_id, rating, comment) VALUES (?, ?, ?)', [
        req.session.userId,
        r,
        text,
      ]);
    }

    const row = await db.get(
      `SELECT hr.*, u.login FROM hotel_reviews hr
       JOIN users u ON u.id = hr.user_id WHERE hr.user_id = ?`,
      [req.session.userId]
    );
    res.status(existing ? 200 : 201).json(formatReviewRow({ ...row, is_own: true }));
  })
);

app.delete(
  '/api/reviews/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const db = getDb();
    const review = await db.get('SELECT * FROM hotel_reviews WHERE id = ?', [req.params.id]);
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    const user = await getSessionUser(req);
    if (review.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }
    await db.run('DELETE FROM hotel_reviews WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/reviews',
  requireAuth,
  requireAdmin,
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db.all(
      `SELECT hr.*, u.login FROM hotel_reviews hr
       JOIN users u ON u.id = hr.user_id
       ORDER BY hr.created_at DESC`
    );
    res.json(rows);
  })
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Novotel: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Не удалось подключить базу данных:', err.message);
    process.exit(1);
  });
