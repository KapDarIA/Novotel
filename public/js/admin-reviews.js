const adminReviewsBody = document.getElementById('adminReviewsBody');

async function loadAdminReviews() {
  const rows = await api('/api/admin/reviews');
  if (rows.length === 0) {
    adminReviewsBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center">Отзывов нет</td></tr>';
    return;
  }
  adminReviewsBody.innerHTML = rows
    .map((r) => {
      const login = r.login || '';
      const masked = login.length > 2 ? login.slice(0, 2) + '***' : login;
      const text =
        r.comment.length > 80 ? escapeHtml(r.comment.slice(0, 80)) + '…' : escapeHtml(r.comment);
      return (
        '<tr>' +
        '<td>' +
        r.id +
        '</td>' +
        '<td>' +
        escapeHtml(masked) +
        '</td>' +
        '<td>' +
        renderStars(r.rating) +
        '</td>' +
        '<td>' +
        text +
        '</td>' +
        '<td>' +
        formatDateTime(r.created_at) +
        '</td>' +
        '<td><button type="button" class="btn btn-danger btn-sm" data-del-review="' +
        r.id +
        '">Удалить</button></td>' +
        '</tr>'
      );
    })
    .join('');

  adminReviewsBody.querySelectorAll('[data-del-review]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить этот отзыв?')) return;
      try {
        await api('/api/reviews/' + btn.dataset.delReview, { method: 'DELETE' });
        loadAdminReviews();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

window.loadAdminReviews = loadAdminReviews;
