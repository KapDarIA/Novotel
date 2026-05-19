const params = new URLSearchParams(window.location.search);
const serviceId = params.get('service');
const serviceInfo = document.getElementById('serviceInfo');
const form = document.getElementById('serviceBookingForm');
const alertBox = document.getElementById('alert');
const noBookingMsg = document.getElementById('noBookingMsg');
const bookingSelect = document.getElementById('booking_id');
const dateInput = document.getElementById('service_date');

let eligibleBookings = [];

if (!serviceId) {
  window.location.href = '/services.html';
}

function updateDateLimits() {
  const id = Number(bookingSelect.value);
  const booking = eligibleBookings.find((b) => b.id === id);
  if (!booking) return;
  const min = String(booking.check_in).slice(0, 10);
  const max = dayBefore(booking.check_out);
  dateInput.min = min;
  dateInput.max = max;
  if (!dateInput.value || dateInput.value < min || dateInput.value > max) {
    dateInput.value = min;
  }
}

async function init() {
  const { user } = await getCurrentUser();
  if (!user) {
    window.location.href =
      '/login.html?redirect=' +
      encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }

  try {
    const service = await api('/api/services/' + serviceId);
    const priceText =
      Number(service.price) > 0 ? formatPrice(service.price) : 'Бесплатно для гостей';

    serviceInfo.innerHTML =
      '<div class="booking-page-room">' +
      '<div class="service-card__icon" style="width:120px;border-radius:12px">' +
      serviceIcon(service.category) +
      '</div>' +
      '<div>' +
      '<h1 class="page-title">' +
      service.name +
      '</h1>' +
      '<p><strong>Категория:</strong> ' +
      serviceCategoryLabel(service.category) +
      '</p>' +
      '<p class="room-card__price">' +
      priceText +
      '</p>' +
      '<p>' +
      (service.description || '') +
      '</p>' +
      '</div></div>';

    eligibleBookings = await api('/api/bookings/eligible');

    if (eligibleBookings.length === 0) {
      noBookingMsg.classList.remove('hidden');
      noBookingMsg.innerHTML =
        'Сначала <a href="/">забронируйте номер</a>. Услуги доступны только при активном бронировании.';
      return;
    }

    bookingSelect.innerHTML = eligibleBookings
      .map((b) => {
        const label =
          b.room_name +
          ' — ' +
          formatDate(b.check_in) +
          ' … ' +
          formatDate(b.check_out);
        return '<option value="' + b.id + '">' + label + '</option>';
      })
      .join('');

    form.classList.remove('hidden');
    bookingSelect.addEventListener('change', updateDateLimits);
    updateDateLimits();
  } catch (e) {
    serviceInfo.innerHTML = '<p class="alert alert-error">' + e.message + '</p>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');

  try {
    await api('/api/service-bookings', {
      method: 'POST',
      body: {
        booking_id: Number(bookingSelect.value),
        service_id: Number(serviceId),
        service_date: dateInput.value,
        service_time: document.getElementById('service_time').value || null,
        notes: document.getElementById('notes').value.trim() || null,
      },
    });
    alertBox.textContent = 'Услуга успешно забронирована!';
    alertBox.className = 'alert alert-success';
    alertBox.classList.remove('hidden');
    setTimeout(() => {
      window.location.href = '/profile.html';
    }, 1500);
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.className = 'alert alert-error';
    alertBox.classList.remove('hidden');
  }
});

init();
setupUserIcon();
