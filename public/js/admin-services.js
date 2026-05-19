const serviceForm = document.getElementById('serviceForm');
const servicesTableBody = document.getElementById('servicesTableBody');
const serviceAlert = document.getElementById('serviceAlert');
const serviceFormTitle = document.getElementById('serviceFormTitle');
const cancelServiceEdit = document.getElementById('cancelServiceEdit');
let editingServiceId = null;

function showServiceAlert(msg, isError = true) {
  serviceAlert.textContent = msg;
  serviceAlert.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
  serviceAlert.classList.remove('hidden');
}

async function loadServicesAdmin() {
  const services = await api('/api/services');
  servicesTableBody.innerHTML = services
    .map(
      (s) =>
        '<tr>' +
        '<td>' +
        s.id +
        '</td>' +
        '<td>' +
        s.name +
        '</td>' +
        '<td>' +
        serviceCategoryLabel(s.category) +
        '</td>' +
        '<td>' +
        (Number(s.price) > 0 ? formatPrice(s.price) : '—') +
        '</td>' +
        '<td class="admin-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-edit-service="' +
        s.id +
        '">Изменить</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete-service="' +
        s.id +
        '">Удалить</button>' +
        '</td></tr>'
    )
    .join('');

  servicesTableBody.querySelectorAll('[data-edit-service]').forEach((btn) => {
    btn.addEventListener('click', () =>
      startServiceEdit(Number(btn.dataset.editService), services)
    );
  });
  servicesTableBody.querySelectorAll('[data-delete-service]').forEach((btn) => {
    btn.addEventListener('click', () => deleteService(Number(btn.dataset.deleteService)));
  });
}

function startServiceEdit(id, services) {
  const s = services.find((x) => x.id === id);
  if (!s) return;
  editingServiceId = id;
  serviceFormTitle.textContent = 'Редактировать услугу';
  cancelServiceEdit.classList.remove('hidden');
  serviceForm.name.value = s.name;
  serviceForm.category.value = s.category;
  serviceForm.price.value = s.price;
  serviceForm.description.value = s.description || '';
}

function resetServiceForm() {
  editingServiceId = null;
  serviceFormTitle.textContent = 'Добавить услугу';
  cancelServiceEdit.classList.add('hidden');
  serviceForm.reset();
}

cancelServiceEdit.addEventListener('click', resetServiceForm);

serviceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  serviceAlert.classList.add('hidden');
  const body = {
    name: serviceForm.name.value,
    category: serviceForm.category.value,
    price: Number(serviceForm.price.value) || 0,
    description: serviceForm.description.value,
  };
  try {
    if (editingServiceId) {
      await api('/api/services/' + editingServiceId, { method: 'PUT', body });
      showServiceAlert('Услуга обновлена', false);
    } else {
      await api('/api/services', { method: 'POST', body });
      showServiceAlert('Услуга добавлена', false);
    }
    resetServiceForm();
    loadServicesAdmin();
  } catch (err) {
    showServiceAlert(err.message);
  }
});

async function deleteService(id) {
  if (!confirm('Удалить эту услугу?')) return;
  try {
    await api('/api/services/' + id, { method: 'DELETE' });
    loadServicesAdmin();
  } catch (e) {
    showServiceAlert(e.message);
  }
}

window.loadServicesAdmin = loadServicesAdmin;
