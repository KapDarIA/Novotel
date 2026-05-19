function dateOnly(value) {
  return String(value).slice(0, 10);
}

function isDateWithinRoomStay(serviceDate, checkIn, checkOut) {
  const d = dateOnly(serviceDate);
  const start = dateOnly(checkIn);
  const end = dateOnly(checkOut);
  return d >= start && d < end;
}

async function getUserRoomBooking(db, userId, bookingId) {
  return db.get(
    `SELECT b.*, r.name AS room_name
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId]
  );
}

async function validateServiceBooking(db, userId, bookingId, serviceDate) {
  const booking = await getUserRoomBooking(db, userId, bookingId);
  if (!booking) {
    return { ok: false, error: 'Бронирование номера не найдено или не принадлежит вам' };
  }
  if (!isDateWithinRoomStay(serviceDate, booking.check_in, booking.check_out)) {
    return {
      ok: false,
      error: 'Услугу можно заказать только на даты проживания (с заезда до выезда, не включая день выезда)',
      booking,
    };
  }
  return { ok: true, booking };
}

module.exports = {
  dateOnly,
  isDateWithinRoomStay,
  getUserRoomBooking,
  validateServiceBooking,
};
