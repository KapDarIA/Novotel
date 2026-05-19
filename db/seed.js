const bcrypt = require('bcryptjs');

const DEMO_ROOMS = [
  {
    name: 'Стандарт',
    type: 'standard',
    price: 4500,
    image_url: '/images/standard.jpg',
    description: 'Уютный номер с двуспальной кроватью и рабочей зоной.',
  },
  {
    name: 'Стандарт с видом',
    type: 'standard',
    price: 5200,
    image_url: '/images/standard-view.jpg',
    description: 'Стандартный номер с панорамным видом на город.',
  },
  {
    name: 'Делюкс',
    type: 'deluxe',
    price: 7800,
    image_url: '/images/deluxe.jpg',
    description: 'Просторный номер с зоной отдыха и мини-баром.',
  },
  {
    name: 'Семейный',
    type: 'family',
    price: 9500,
    image_url: '/images/family.jpg',
    description: 'Два спальных места, идеально для семьи с детьми.',
  },
  {
    name: 'Люкс',
    type: 'suite',
    price: 15000,
    image_url: '/images/suite.jpg',
    description: 'Премиальный люкс с гостиной и отдельной ванной.',
  },
  {
    name: 'Бизнес',
    type: 'business',
    price: 6200,
    image_url: '/images/business.jpg',
    description: 'Номер для деловых поездок с расширенным рабочим столом.',
  },
];

async function seedUsers(db) {
  const admin = await db.get('SELECT id FROM users WHERE login = ?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.run('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)', [
      'admin',
      hash,
      'admin',
    ]);
  }

  const user = await db.get('SELECT id FROM users WHERE login = ?', ['user']);
  if (!user) {
    const hash = bcrypt.hashSync('user123', 10);
    await db.run('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)', [
      'user',
      hash,
      'user',
    ]);
  }
}

async function seedRooms(db) {
  const row = await db.get('SELECT COUNT(*) AS c FROM rooms');
  if (Number(row.c) === 0) {
    for (const r of DEMO_ROOMS) {
      await db.run(
        'INSERT INTO rooms (name, type, price, image_url, description) VALUES (?, ?, ?, ?, ?)',
        [r.name, r.type, r.price, r.image_url, r.description]
      );
    }
  }
}

const DEMO_SERVICES = [
  {
    name: 'Фитнес-зал',
    category: 'fitness',
    price: 0,
    description: 'Тренажёрный зал с кардио- и силовыми зонами. Бесплатно для гостей с бронью номера.',
    image_url: null,
  },
  {
    name: 'SPA-центр',
    category: 'spa',
    price: 3500,
    description: 'Массаж, сауна и релакс-программы по записи.',
    image_url: null,
  },
  {
    name: 'Бар Novotel',
    category: 'bar',
    price: 0,
    description: 'Коктейли и лёгкие закуски. Бронирование столика на вечер.',
    image_url: null,
  },
  {
    name: 'Ресторан',
    category: 'restaurant',
    price: 0,
    description: 'Завтрак, обед и ужин. Бронь столика на выбранное время.',
    image_url: null,
  },
  {
    name: 'Уборка номера',
    category: 'housekeeping',
    price: 0,
    description: 'Дополнительная уборка и смена белья в удобное для вас время.',
    image_url: null,
  },
  {
    name: 'Еда в номер',
    category: 'room_service',
    price: 0,
    description: 'Заказ блюд и напитков с доставкой в номер. Укажите пожелания в комментарии.',
    image_url: null,
  },
];

async function seedServices(db) {
  const row = await db.get('SELECT COUNT(*) AS c FROM services');
  if (Number(row.c) === 0) {
    for (const s of DEMO_SERVICES) {
      await db.run(
        'INSERT INTO services (name, category, price, description, image_url) VALUES (?, ?, ?, ?, ?)',
        [s.name, s.category, s.price, s.description, s.image_url]
      );
    }
  }
}

function maskLogin(login) {
  if (!login || login.length <= 2) return 'Гость';
  return login.slice(0, 2) + '***';
}

async function seedReviews(db) {
  const row = await db.get('SELECT COUNT(*) AS c FROM hotel_reviews');
  if (Number(row.c) > 0) return;

  const user = await db.get('SELECT id, login FROM users WHERE login = ?', ['user']);
  if (!user) return;

  await db.run(
    'INSERT INTO hotel_reviews (user_id, rating, comment) VALUES (?, ?, ?)',
    [
      user.id,
      5,
      'Отличный отель: чистые номера, вежливый персонал, удобное расположение. Обязательно вернёмся!',
    ]
  );
}

module.exports = { seedUsers, seedRooms, seedServices, seedReviews, maskLogin, DEMO_SERVICES };
