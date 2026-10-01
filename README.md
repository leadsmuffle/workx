# WorkX — Coworking Booking Platform (Backend)

A production-ready Node.js + Express + MongoDB backend for the WorkX coworking
booking platform, built with MVC architecture.

## Tech Stack

- **Runtime:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + bcrypt, role-based access (`user` / `admin`)
- **Email:** Nodemailer (Gmail SMTP)
- **Payments:** Stripe (live integration) + JazzCash / EasyPaisa (structured, ready for merchant credentials)
- **PDF Invoices:** PDFKit + QR codes
- **Security:** Helmet, rate limiting, Mongo sanitize, XSS-clean, HPP, CORS

## Folder Structure

```
workx-backend/
├── config/           # DB connection
├── controllers/      # Business logic (MVC "C")
├── models/           # Mongoose schemas (MVC "M")
├── routes/           # Express routers, mapped to controllers
├── middleware/       # auth, error handling, upload, validation
├── utils/            # JWT, email, PDF invoice generator, helpers
├── public/           # Frontend (index.html + js/api.js bridge)
├── uploads/          # User-uploaded images + generated invoices
├── views/emails/     # (reserved for future email template files)
├── .env.example
├── package.json
└── server.js         # App entry point
```

## 1. Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env

# 3. Seed the database with an admin user + sample workspaces
npm run seed

# 4. Start in development (auto-restart on changes)
npm run dev

# ...or start in production
npm start
```

The API will be running at `http://localhost:5000`. The `public/index.html`
frontend is served automatically at the same URL (Express static).

## 2. Environment Variables

All variables are documented in `.env.example`. Key ones:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string (Atlas or local) |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `SMTP_EMAIL` / `SMTP_PASSWORD` | Gmail address + **App Password** (not your normal password — generate one at myaccount.google.com/apppasswords) |
| `ADMIN_EMAIL` | Where contact-form messages are sent (set to `shahzadamjad999@gmail.com`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | From your Stripe dashboard |
| `JAZZCASH_*` / `EASYPAISA_*` | From your JazzCash/EasyPaisa merchant sandbox/production accounts |
| `SEAT_HOLD_MINUTES` | How long a seat stays "locked" for a user during checkout before releasing (default 10) |

## 3. MongoDB Setup

**Option A — MongoDB Atlas (recommended, free tier available)**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access → add a user with a password
3. Network Access → allow your IP (or `0.0.0.0/0` for development)
4. Copy the connection string into `MONGO_URI` in `.env`

**Option B — Local MongoDB**
```bash
# macOS
brew install mongodb-community && brew services start mongodb-community
# Ubuntu
sudo apt install mongodb && sudo systemctl start mongodb
```
Then use `MONGO_URI=mongodb://127.0.0.1:27017/workx`

## 4. Default Admin Login (after `npm run seed`)

```
Email: admin@workx.pk
Password: Admin@12345
```
**Change this password immediately after first login in production.**

## 5. Connecting Your Existing Frontend

Your uploaded `index.html` is already in `/public`. A bridge file
`public/js/api.js` (`WorkXAPI`) wraps every backend endpoint in a simple
`fetch` call, e.g.:

```html
<script src="/js/api.js"></script>
<script>
  async function doLogin(email, password) {
    const { user } = await WorkXAPI.login(email, password, true);
    console.log('Logged in as', user.fullName);
  }
</script>
```

Replace the simulated in-memory logic in your existing `<script>` block
(`DB.bookings.push(...)`, the fake booking-ID generator, the contact-form
`showToast` stub, etc.) with the matching `WorkXAPI.*` calls so the site
talks to this real backend instead of simulating everything in memory.

## 6. Key API Endpoints

| Module | Example routes |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password/:token`, `GET /verify-email/:token` |
| Users | `GET/PATCH /api/users/profile`, `GET /api/users/bookings` |
| Workspaces | `GET /api/workspaces`, `GET /api/workspaces/:id`, admin `POST/PATCH/DELETE` |
| Seats | `GET /api/seats/:workspaceId?date=&timeSlot=`, `POST /api/seats/lock` |
| Bookings | `POST /api/bookings`, `PATCH /api/bookings/:id/cancel` |
| Payments | `POST /api/payments/stripe/create-intent`, `/jazzcash/initiate`, `/easypaisa/initiate` |
| Invoices | `GET /api/invoices/:id/download` |
| Reviews | `GET /api/reviews/workspace/:id`, `POST /api/reviews` |
| Contact | `POST /api/contact` |
| Admin | `GET /api/admin/stats`, `/users`, `/export/bookings` (CSV) |

## 7. How Seat Locking / Double-Booking Prevention Works

1. User selects seats on the live seat map → frontend calls `POST /api/seats/lock`.
2. That seat+date+timeSlot combination is marked `locked` with an expiry
   (`SEAT_HOLD_MINUTES`, default 10 min) — like a cinema ticket hold.
3. `POST /api/bookings` converts a valid lock into a `pending` booking.
4. On successful payment (Stripe webhook / JazzCash / EasyPaisa callback),
   the booking becomes `confirmed` and the seat status becomes permanently `booked`.
5. A background job (`setInterval` in `server.js`, runs every minute) expires
   any `pending` booking whose hold window passed without payment, freeing
   the seat automatically. In production, swap this for a proper job queue
   (BullMQ + Redis) if you scale beyond a single server instance.

## 8. Deployment Guides

### Render
1. Push this repo to GitHub.
2. New → Web Service → connect the repo.
3. Build command: `npm install` — Start command: `npm start`
4. Add all variables from `.env.example` under Environment.
5. Use MongoDB Atlas for the database (Render doesn't host MongoDB directly).

### Railway
1. `railway login` → `railway init` in this folder.
2. `railway up` to deploy.
3. Add environment variables via `railway variables set KEY=value` or the dashboard.
4. Railway auto-detects Node and runs `npm start`.

### VPS (Ubuntu, e.g. DigitalOcean/AWS EC2)
```bash
# On the server
sudo apt update && sudo apt install nodejs npm nginx -y
git clone <your-repo-url> && cd workx-backend
npm install --production
cp .env.example .env   # then edit with production values
npm install -g pm2
pm2 start server.js --name workx-api
pm2 startup && pm2 save
```
Then configure Nginx as a reverse proxy to `localhost:5000` and set up
SSL with Certbot (`sudo certbot --nginx`).

## 9. Security Checklist Before Going Live

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong, random `JWT_SECRET` (32+ characters)
- [ ] Restrict MongoDB Atlas network access to your server's IP
- [ ] Use Stripe **live** keys + verify the webhook signature
- [ ] Set real JazzCash/EasyPaisa merchant credentials from their merchant portals
- [ ] Change the seeded admin password
- [ ] Put the app behind HTTPS (Certbot on VPS, or automatic on Render/Railway)
- [ ] Review CORS `origin` in `server.js` to your real frontend domain

## 10. What's Scaffolded vs. What Needs Your Input

Fully implemented and working: Auth (register/login/JWT/bcrypt/forgot-reset/verify
email/role-based access), User dashboard, Workspace CRUD + image upload, live
Seat map with locking, Booking lifecycle (create/cancel/reschedule/auto-expire),
Stripe payments (real), JazzCash/EasyPaisa (correct hash/payload structure —
plug in your merchant credentials), PDF invoice generation + email, Reviews,
Contact form, Admin dashboard (stats/users/reports/CSV export), Notifications,
security middleware.

Needs your input to go fully live: real Stripe/JazzCash/EasyPaisa merchant
credentials, a Gmail App Password, a MongoDB Atlas cluster, and wiring the
remaining frontend UI interactions to `WorkXAPI` calls (the bridge file is
ready — the visual frontend itself doesn't need to change).
