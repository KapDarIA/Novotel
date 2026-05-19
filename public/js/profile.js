const profileContent = document.getElementById('profileContent');
const bookingsList = document.getElementById('bookingsList');
const serviceBookingsList = document.getElementById('serviceBookingsList');
const logoutBtn = document.getElementById('logoutBtn');

async function init() {
  try {
    const { user, role } = await getCurrentUser();
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    profileContent.innerHTML =
      '<h1 class="page-title">Профиль</h1>' +
      '<div class="profile-header">' +
      '<p><strong>Логин:</strong> ' +
      user.login +
      '</p>' +
      '<span class="profile-role">' +
      roleLabel(role) +
      '</span>' +
      (role === 'admin'
        ? '<p style="margin-top:1rem"><a href="/admin.html" class="btn btn-primary">Панель администратора</a></p>'
        : '') +
      '</div>';

    const bookings = await api('/api/bookings/my');
    if (bookings.length === 0) {
      bookingsList.innerHTML =
        '<p class="empty-state">У вас пока нет бронирований. <a href="/">Выбрать номер</a></p>';
    } else {
      bookingsList.innerHTML = bookings
        .map((b) => {
          const img = b.image_url || '';
          return (
            '<div class="booking-item" data-id="' +
            b.id +
            '">' +
            '<img src="' +
            img +
            '" alt="" onerror="onImageError(this)">' +
            '<div class="booking-item__info">' +
            '<strong>' +
            b.room_name +
            '</strong> (' +
            roomTypeLabel(b.room_type) +
            ')<br>' +
            formatDate(b.check_in) +
            ' — ' +
            formatDate(b.check_out) +
            '<br>' +
            formatPrice(b.price) +
            ' / ночь' +
            '</div>' +
            '<button type="button" class="btn btn-danger btn-sm cancel-booking">Отменить</button>' +
            '</div>'
          );
        })
        .join('');

      bookingsList.querySelectorAll('.cancel-booking').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('.booking-item').dataset.id;
          if (!confirm('Отменить бронирование номера? Связанные услуги тоже будут отменены.')) return;
          try {
            await api('/api/bookings/' + id, { method: 'DELETE' });
            init();
          } catch (e) {
            alert(e.message);
          }
        });
      });
    }

    const serviceBookings = await api('/api/service-bookings/my');
    if (serviceBookings.length === 0) {
      serviceBookingsList.innerHTML =
        '<p class="empty-state">Услуг пока нет. <a href="/services.html">Выбрать услугу</a> (нужна бронь номера).</p>';
    } else {
      serviceBookingsList.innerHTML = serviceBookings
        .map((sb) => {
          const time = sb.service_time ? ' в ' + formatTime(sb.service_time) : '';
          return (
            '<div class="booking-item" data-sb-id="' +
            sb.id +
            '">' +
            '<div class="service-card__icon" style="width:80px;height:60px;font-size:1.5rem;border-radius:8px">' +
            serviceIcon(sb.category) +
            '</div>' +
            '<div class="booking-item__info">' +
            '<strong>' +
            sb.service_name +
            '</strong> (' +
            serviceCategoryLabel(sb.category) +
            ')<br>' +
            'Номер: ' +
            sb.room_name +
            '<br>' +
            formatDate(sb.service_date) +
            time +
            (sb.notes ? '<br><em>' + sb.notes + '</em>' : '') +
            '</div>' +
            '<button type="button" class="btn btn-danger btn-sm cancel-service">Отменить</button>' +
            '</div>'
          );
        })
        .join('');

      serviceBookingsList.querySelectorAll('.cancel-service').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('.booking-item').dataset.sbId;
          if (!confirm('Отменить бронирование услуги?')) return;
          try {
            await api('/api/service-bookings/' + id, { method: 'DELETE' });
            init();
          } catch (e) {
            alert(e.message);
          }
        });
      });
    }
  } catch (e) {
    profileContent.innerHTML = '<p class="alert alert-error">' + e.message + '</p>';
  }
}

logoutBtn.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

init();
setupUserIcon();
