const { maskLogin } = require('./seed');

async function userHasBooking(db, userId) {
  const row = await db.get('SELECT id FROM bookings WHERE user_id = ? LIMIT 1', [userId]);
  return !!row;
}

function formatReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    author: maskLogin(row.login),
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_own: !!row.is_own,
  };
}

module.exports = { userHasBooking, formatReviewRow, maskLogin };
