const params = new URLSearchParams(window.location.search);
const roomId = params.get('room');
const roomInfo = document.getElementById('roomInfo');
const bookingForm = document.getElementById('bookingForm');
const alertBox = document.getElementById('alert');
const occupiedList = document.getElementById('occupiedList');

if (!roomId) {
  window.location.href = '/';
}

async function init() {
  try {
    const room = await api('/api/rooms/' + roomId);
    const occupied = await api('/api/bookings/room/' + roomId);

    roomInfo.innerHTML =
      '<div class="booking-page-room">' +
      '<img src="' +
      (room.image_url || '') +
      '" alt="' +
      room.name +
      '" onerror="onImageError(this)">' +
      '<div>' +
      '<h1 class="page-title">' +
      room.name +
      '</h1>' +
      '<p><strong>Тип:</strong> ' +
      roomTypeLabel(room.type) +
      '</p>' +
      '<p class="room-card__price">' +
      formatPrice(room.price) +
      ' <span>/ ночь</span></p>' +
      '<p>' +
      (room.description || '') +
      '</p>' +
      '</div></div>';

    if (occupied.length > 0) {
      occupiedList.innerHTML =
        '<p><strong>Занятые периоды:</strong></p><ul class="occupied-dates">' +
        occupied
          .map(
            (o) =>
              '<li>' + formatDate(o.check_in) + ' — ' + formatDate(o.check_out) + '</li>'
          )
          .join('') +
        '</ul>';
    } else {
      occupiedList.innerHTML = '<p class="occupied-dates">Номер свободен — выберите даты.</p>';
    }
  } catch (e) {
    roomInfo.innerHTML = '<p class="alert alert-error">' + e.message + '</p>';
    bookingForm.classList.add('hidden');
  }
}

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');

  const { user } = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }

  const check_in = bookingForm.check_in.value;
  const check_out = bookingForm.check_out.value;

  try {
    await api('/api/bookings', {
      method: 'POST',
      body: { room_id: Number(roomId), check_in, check_out },
    });
    alertBox.textContent = 'Бронирование успешно оформлено!';
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
