const reviewsSummary = document.getElementById('reviewsSummary');
const reviewsList = document.getElementById('reviewsList');
const sortReviews = document.getElementById('sortReviews');
const reviewForm = document.getElementById('reviewForm');
const formHint = document.getElementById('formHint');
const formAlert = document.getElementById('formAlert');
const formTitle = document.getElementById('formTitle');
const starPicker = document.getElementById('starPicker');
const ratingInput = document.getElementById('rating');
const commentInput = document.getElementById('comment');

let myReviewId = null;

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function pluralReviews(n) {
  const m = n % 10;
  const m2 = n % 100;
  if (m2 >= 11 && m2 <= 14) return 'отзывов';
  if (m === 1) return 'отзыв';
  if (m >= 2 && m <= 4) return 'отзыва';
  return 'отзывов';
}

function setupStarPicker(value) {
  ratingInput.value = value;
  starPicker.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = i <= value ? '★' : '☆';
    btn.className = i <= value ? 'active' : '';
    btn.setAttribute('aria-label', i + ' звёзд');
    btn.addEventListener('click', () => setupStarPicker(i));
    starPicker.appendChild(btn);
  }
}

async function loadSummary() {
  const summary = await api('/api/reviews/summary');
  if (summary.count === 0) {
    reviewsSummary.innerHTML =
      '<div><p class="reviews-summary__score">—</p><p>Пока нет отзывов. Станьте первым!</p></div>';
    return;
  }
  reviewsSummary.innerHTML =
    '<div>' +
    '<p class="reviews-summary__score">' +
    summary.average +
    '</p>' +
    '<p class="reviews-summary__stars">' +
    renderStars(Math.round(summary.average)) +
    '</p>' +
    '<p style="color:var(--muted)">на основе ' +
    summary.count +
    ' ' +
    pluralReviews(summary.count) +
    '</p></div>';
}
async function loadReviews() {
  reviewsList.innerHTML = '<p class="empty-state">Загрузка...</p>';
  try {
    const reviews = await api('/api/reviews?sort=' + sortReviews.value);
    if (reviews.length === 0) {
      reviewsList.innerHTML = '<p class="empty-state">Отзывов пока нет</p>';
      return;
    }

    reviewsList.innerHTML = reviews
      .map((r) => {
        let actions = '';
        if (r.is_own) {
          actions =
            '<button type="button" class="btn btn-danger btn-sm delete-my-review" data-id="' +
            r.id +
            '" style="margin-top:0.75rem">Удалить мой отзыв</button>';
        }
        return (
          '<article class="review-card">' +
          '<div class="review-card__head">' +
          '<div><span class="review-card__author">' +
          escapeHtml(r.author) +
          '</span><br><span class="review-card__stars">' +
          renderStars(r.rating) +
          '</span></div>' +
          '<span class="review-card__date">' +
          formatDateTime(r.created_at) +
          '</span></div>' +
          '<p>' +
          escapeHtml(r.comment) +
          '</p>' +
          actions +
          '</article>'
        );
      })
      .join('');

    reviewsList.querySelectorAll('.delete-my-review').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить ваш отзыв?')) return;
        try {
          await api('/api/reviews/' + btn.dataset.id, { method: 'DELETE' });
          myReviewId = null;
          await loadSummary();
          await loadReviews();
          await setupForm();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (e) {
    reviewsList.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + '</p>';
  }
}

async function setupForm() {
  const { user } = await getCurrentUser();
  if (!user) {
    formHint.innerHTML = '<a href="/login.html">Войдите</a>, чтобы оставить отзыв.';
    reviewForm.classList.add('hidden');
    myReviewId = null;
    return;
  }

  try {
    const { review, canReview } = await api('/api/reviews/my');
    myReviewId = review ? review.id : null;

    if (!canReview) {
      formHint.textContent =
        'Отзыв могут оставить только гости с бронированием номера. Сначала забронируйте номер.';
      reviewForm.classList.add('hidden');
      return;
    }

    reviewForm.classList.remove('hidden');
    formHint.textContent = review
      ? 'Вы уже оставляли отзыв. Новая публикация обновит его.'
      : 'Поделитесь впечатлениями о проживании в Novotel.';
    formTitle.textContent = review ? 'Изменить отзыв' : 'Оставить отзыв';
    setupStarPicker(review ? review.rating : 5);
    commentInput.value = review ? review.comment : '';
  } catch (e) {
    formHint.textContent = e.message;
    reviewForm.classList.add('hidden');
  }
}

reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formAlert.classList.add('hidden');
  try {
    const saved = await api('/api/reviews', {
      method: 'POST',
      body: { rating: Number(ratingInput.value), comment: commentInput.value.trim() },
    });
    myReviewId = saved.id;
    formAlert.textContent = 'Спасибо! Ваш отзыв опубликован.';
    formAlert.className = 'alert alert-success';
    formAlert.classList.remove('hidden');
    await loadSummary();
    await loadReviews();
    await setupForm();
  } catch (err) {
    formAlert.textContent = err.message;
    formAlert.className = 'alert alert-error';
    formAlert.classList.remove('hidden');
  }
});

sortReviews.addEventListener('change', loadReviews);

(async () => {
  setupStarPicker(5);
  await loadSummary();
  await setupForm();
  await loadReviews();
  setupUserIcon();
})();
