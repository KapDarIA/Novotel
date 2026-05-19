const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('categoryFilter');
const servicesGrid = document.getElementById('servicesGrid');

let debounceTimer;

async function loadCategories() {
  const categories = await api('/api/services/categories');
  categoryFilter.innerHTML = '<option value="all">Все категории</option>';
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = serviceCategoryLabel(c);
    categoryFilter.appendChild(opt);
  });
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

async function loadServices() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (categoryFilter.value !== 'all') params.set('category', categoryFilter.value);

  servicesGrid.innerHTML = '<p class="empty-state">Загрузка...</p>';

  try {
    const services = await api('/api/services?' + params.toString());
    if (services.length === 0) {
      servicesGrid.innerHTML = '<p class="empty-state">Услуги не найдены</p>';
      return;
    }

    servicesGrid.innerHTML = services
      .map((s) => {
        const priceText =
          Number(s.price) > 0 ? formatPrice(s.price) : 'Бесплатно для гостей';
        const name = escapeHtml(s.name);
        const desc = escapeHtml(s.description || '');
        return (
          '<article class="room-card">' +
          '<div class="service-card__icon">' +
          serviceIcon(s.category) +
          '</div>' +
          '<div class="room-card__body">' +
          '<span class="room-card__type">' +
          serviceCategoryLabel(s.category) +
          '</span>' +
          '<h2 class="room-card__name">' +
          name +
          '</h2>' +
          '<p class="room-card__desc">' +
          desc +
          '</p>' +
          '<p class="room-card__price">' +
          priceText +
          '</p>' +
          '<a href="/service-booking.html?service=' +
          s.id +
          '" class="btn btn-primary btn-block">Забронировать</a>' +
          '</div></article>'
        );
      })
      .join('');
  } catch (e) {
    servicesGrid.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + '</p>';
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadServices, 300);
});
categoryFilter.addEventListener('change', loadServices);

loadCategories().then(loadServices);
setupUserIcon();
