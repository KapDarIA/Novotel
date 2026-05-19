const exportMonth = document.getElementById('exportMonth');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const exportAlert = document.getElementById('exportAlert');

function initExportMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  exportMonth.value = `${y}-${m}`;
}

function showExportAlert(msg, isError = true) {
  exportAlert.textContent = msg;
  exportAlert.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
  exportAlert.classList.remove('hidden');
}

downloadExcelBtn.addEventListener('click', async () => {
  exportAlert.classList.add('hidden');
  const month = exportMonth.value;
  if (!month) {
    showExportAlert('Выберите месяц');
    return;
  }

  downloadExcelBtn.disabled = true;
  downloadExcelBtn.textContent = 'Формирование…';

  try {
    const res = await fetch('/api/admin/bookings/export?month=' + encodeURIComponent(month), {
      credentials: 'same-origin',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Не удалось сформировать файл');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novotel-bookings-' + month + '.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showExportAlert('Файл успешно загружен', false);
  } catch (e) {
    showExportAlert(e.message);
  } finally {
    downloadExcelBtn.disabled = false;
    downloadExcelBtn.textContent = 'Скачать Excel';
  }
});

initExportMonth();
