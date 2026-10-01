/**
 * WorkX API client — thin fetch wrapper around the backend.
 * Include this file in index.html (<script src="/js/api.js"></script>)
 * BEFORE your existing inline <script>, then replace the simulated
 * in-memory functions (DB.bookings.push(...), etc.) with calls to WorkXAPI.
 *
 * All requests automatically send the JWT cookie set by the backend
 * (credentials: 'include'), so no manual token handling is required
 * once the user is logged in.
 */
const WorkXAPI = (() => {
  const BASE = '/api';

  async function request(path, { method = 'GET', body, isForm = false } = {}) {
    const opts = {
      method,
      credentials: 'include',
      headers: isForm ? {} : { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  return {
    // ---- Auth ----
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    login: (email, password, rememberMe) =>
      request('/auth/login', { method: 'POST', body: { email, password, rememberMe } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getMe: () => request('/auth/me'),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: (token, password) =>
      request(`/auth/reset-password/${token}`, { method: 'PATCH', body: { password } }),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', { method: 'PATCH', body: { currentPassword, newPassword } }),

    // ---- Workspaces ----
    getWorkspaces: (query = '') => request(`/workspaces${query}`),
    getFeaturedWorkspaces: () => request('/workspaces/featured'),
    getWorkspace: (id) => request(`/workspaces/${id}`),
    getCities: () => request('/workspaces/meta/cities'),

    // ---- Seats (live availability) ----
    getSeatMap: (workspaceId, date, timeSlot) =>
      request(`/seats/${workspaceId}?date=${date}&timeSlot=${encodeURIComponent(timeSlot)}`),
    lockSeats: (workspaceId, seatIds, date, timeSlot) =>
      request('/seats/lock', { method: 'POST', body: { workspaceId, seatIds, date, timeSlot } }),
    unlockSeats: (workspaceId, seatIds, date, timeSlot) =>
      request('/seats/unlock', { method: 'POST', body: { workspaceId, seatIds, date, timeSlot } }),

    // ---- Bookings ----
    createBooking: (workspaceId, seatIds, date, timeSlot) =>
      request('/bookings', { method: 'POST', body: { workspaceId, seatIds, date, timeSlot } }),
    getBooking: (id) => request(`/bookings/${id}`),
    cancelBooking: (id, reason) => request(`/bookings/${id}/cancel`, { method: 'PATCH', body: { reason } }),
    getMyBookings: () => request('/users/bookings'),

    // ---- Payments ----
    createStripeIntent: (bookingId) =>
      request('/payments/stripe/create-intent', { method: 'POST', body: { bookingId } }),
    initiateJazzCash: (bookingId) => request('/payments/jazzcash/initiate', { method: 'POST', body: { bookingId } }),
    initiateEasyPaisa: (bookingId) => request('/payments/easypaisa/initiate', { method: 'POST', body: { bookingId } }),

    // ---- Invoices ----
    downloadInvoice: (id) => window.open(`${BASE}/invoices/${id}/download`, '_blank'),

    // ---- Reviews ----
    getReviews: (workspaceId) => request(`/reviews/workspace/${workspaceId}`),
    submitReview: (workspaceId, rating, comment) =>
      request('/reviews', { method: 'POST', body: { workspaceId, rating, comment } }),

    // ---- Contact ----
    submitContact: (payload) => request('/contact', { method: 'POST', body: payload }),

    // ---- Notifications ----
    getNotifications: () => request('/notifications'),
  };
})();
