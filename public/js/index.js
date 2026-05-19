const searchInput = document.getElementById('search');
const typeFilter = document.getElementById('typeFilter');
const sortSelect = document.getElementById('sort');
const roomsGrid = document.getElementById('roomsGrid');

let debounceTimer;

async function loadRoomTypes() {
  const types = await api('/api/rooms/types');
  typeFilter.innerHTML = '<option value="all">Все типы</option>';
  types.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = roomTypeLabel(t);
    typeFilter.appendChild(opt);
  });
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

async function loadRooms() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (typeFilter.value !== 'all') params.set('type', typeFilter.value);
  if (sortSelect.value) params.set('sort', sortSelect.value);

  roomsGrid.innerHTML = '<p class="empty-state">Загрузка...</p>';

  try {
    const rooms = await api('/api/rooms?' + params.toString());
    if (rooms.length === 0) {
      roomsGrid.innerHTML = '<p class="empty-state">Номера не найдены</p>';
      return;
    }
    roomsGrid.innerHTML = rooms
      .map((room) => {
        const name = escapeHtml(room.name);
        const desc = escapeHtml(room.description || '');
        const img = room.image_url || '';
        return (
          '<article class="room-card">' +
          '<img class="room-card__image" src="' +
          img +
          '" alt="' +
          name +
          '" onerror="onImageError(this)">' +
          '<div class="room-card__body">' +
          '<span class="room-card__type">' +
          roomTypeLabel(room.type) +
          '</span>' +
          '<h2 class="room-card__name">' +
          name +
          '</h2>' +
          '<p class="room-card__desc">' +
          desc +
          '</p>' +
          '<p class="room-card__price">' +
          formatPrice(room.price) +
          ' <span>/ ночь</span></p>' +
          '<a href="/booking.html?room=' +
          room.id +
          '" class="btn btn-primary btn-block">Забронировать</a>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');
  } catch (e) {
    roomsGrid.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + '</p>';
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadRooms, 300);
});
typeFilter.addEventListener('change', loadRooms);
sortSelect.addEventListener('change', loadRooms);

async function loadHomeRating() {
  const el = document.getElementById('homeRating');
  if (!el) return;
  try {
    const s = await api('/api/reviews/summary');
    if (s.count === 0) return;
    el.classList.remove('hidden');
    el.innerHTML =
      '<div><strong>Рейтинг Novotel:</strong> ' +
      s.average +
      ' ' +
      renderStars(Math.round(s.average)) +
      ' <span style="color:var(--muted)">(' +
      s.count +
      ' отз.)</span></div>' +
      '<a href="/reviews.html" class="btn btn-outline btn-sm">Читать отзывы</a>';
  } catch (_) {}
}

loadRoomTypes().then(loadRooms);
loadHomeRating();
setupUserIcon();
