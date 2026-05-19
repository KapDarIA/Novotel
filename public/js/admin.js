const roomForm = document.getElementById('roomForm');
const roomsTableBody = document.getElementById('roomsTableBody');
const alertBox = document.getElementById('alert');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEdit');
let editingId = null;

async function guardAdmin() {
  const { user } = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function showAlert(msg, isError = true) {
  alertBox.textContent = msg;
  alertBox.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
  alertBox.classList.remove('hidden');
}

async function loadRooms() {
  const rooms = await api('/api/rooms');
  roomsTableBody.innerHTML = rooms
    .map(
      (r) =>
        '<tr>' +
        '<td>' +
        r.id +
        '</td>' +
        '<td><img src="' +
        (r.image_url || '') +
        '" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:4px" onerror="onImageError(this)"></td>' +
        '<td>' +
        r.name +
        '</td>' +
        '<td>' +
        roomTypeLabel(r.type) +
        '</td>' +
        '<td>' +
        formatPrice(r.price) +
        '</td>' +
        '<td class="admin-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-edit="' +
        r.id +
        '">Изменить</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete="' +
        r.id +
        '">Удалить</button>' +
        '</td></tr>'
    )
    .join('');

  roomsTableBody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(Number(btn.dataset.edit), rooms));
  });
  roomsTableBody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteRoom(Number(btn.dataset.delete)));
  });
}

function startEdit(id, rooms) {
  const room = rooms.find((r) => r.id === id);
  if (!room) return;
  editingId = id;
  formTitle.textContent = 'Редактировать номер';
  cancelEditBtn.classList.remove('hidden');
  roomForm.name.value = room.name;
  roomForm.type.value = room.type;
  roomForm.price.value = room.price;
  roomForm.description.value = room.description || '';
  roomForm.image_url.value = room.image_url || '';
}

function resetForm() {
  editingId = null;
  formTitle.textContent = 'Добавить номер';
  cancelEditBtn.classList.add('hidden');
  roomForm.reset();
}

cancelEditBtn.addEventListener('click', resetForm);

roomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');

  const fd = new FormData(roomForm);
  if (!fd.get('image')?.size && fd.get('image_url')) {
    fd.set('image_url', fd.get('image_url'));
  }

  try {
    if (editingId) {
      await fetch('/api/rooms/' + editingId, {
        method: 'PUT',
        credentials: 'same-origin',
        body: fd,
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка');
        return data;
      });
      showAlert('Номер обновлён', false);
    } else {
      await fetch('/api/rooms', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка');
        return data;
      });
      showAlert('Номер добавлен', false);
    }
    resetForm();
    loadRooms();
  } catch (err) {
    showAlert(err.message);
  }
});

async function deleteRoom(id) {
  if (!confirm('Удалить этот номер? Все связанные бронирования будут удалены.')) return;
  try {
    await api('/api/rooms/' + id, { method: 'DELETE' });
    loadRooms();
  } catch (e) {
    showAlert(e.message);
  }
}

document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('roomsPanel').classList.toggle('hidden', tab.dataset.panel !== 'roomsPanel');
    document.getElementById('servicesPanel').classList.toggle('hidden', tab.dataset.panel !== 'servicesPanel');
    document.getElementById('reviewsPanel').classList.toggle('hidden', tab.dataset.panel !== 'reviewsPanel');
    document.getElementById('exportPanel').classList.toggle('hidden', tab.dataset.panel !== 'exportPanel');
    if (tab.dataset.panel === 'servicesPanel' && window.loadServicesAdmin) {
      window.loadServicesAdmin();
    }
    if (tab.dataset.panel === 'reviewsPanel' && window.loadAdminReviews) {
      window.loadAdminReviews();
    }
  });
});

(async () => {
  if (await guardAdmin()) {
    loadRooms();
    setupUserIcon();
  }
})();
