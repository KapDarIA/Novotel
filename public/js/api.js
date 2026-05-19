async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
    body:
      options.body instanceof FormData || typeof options.body === 'string'
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

async function getCurrentUser() {
  return api('/api/auth/me');
}

function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function roomTypeLabel(type) {
  const labels = {
    standard: 'Стандарт',
    deluxe: 'Делюкс',
    family: 'Семейный',
    suite: 'Люкс',
    business: 'Бизнес',
  };
  return labels[type] || type;
}

function roleLabel(role) {
  const labels = { guest: 'Гость', user: 'Пользователь', admin: 'Администратор' };
  return labels[role] || role;
}

function serviceCategoryLabel(category) {
  const labels = {
    fitness: 'Фитнес',
    spa: 'SPA',
    bar: 'Бар',
    restaurant: 'Ресторан',
    housekeeping: 'Уборка номера',
    room_service: 'Еда в номер',
  };
  return labels[category] || category;
}

function serviceIcon(category) {
  const icons = {
    fitness: '🏋️',
    spa: '💆',
    bar: '🍸',
    restaurant: '🍽️',
    housekeeping: '🧹',
    room_service: '🍽️',
  };
  return icons[category] || '✨';
}

function dayBefore(dateStr) {
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}

function renderStars(rating, max = 5) {
  const r = Math.round(Number(rating)) || 0;
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += i <= r ? '★' : '☆';
  }
  return html;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return formatDate(String(dateStr).slice(0, 10));
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function setupUserIcon() {
  const link = document.getElementById('userIconLink');
  if (!link) return;
  getCurrentUser().then(({ user }) => {
    link.href = user ? '/profile.html' : '/login.html';
    link.title = user ? 'Профиль' : 'Войти';
  });
}

function onImageError(img) {
  img.onerror = null;
  img.src =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="#8fafd4" width="400" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#003580" font-family="sans-serif" font-size="18">Novotel</text></svg>'
    );
}
