// server/src/mvpStore.js
export const acceptances = new Map(); // token -> { agreeTerms, ackDeposit, acceptedAt }
export const bookings = []; // { id, token, startAt, endAt, status, createdAt, expiresAt }
export const pixCharges = new Map(); // pixId -> pixCharge
export const pixByBooking = new Map(); // bookingId -> pixId
