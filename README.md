# FACEIT Leaderboard (with Admin + Database)

This project shows a FACEIT CS2 ELO leaderboard and includes an admin panel where you can add/remove players.
Player IDs are stored in MongoDB, so anything you add in Admin stays saved.

## Requirements
- Node.js 18+ (recommended)
- A MongoDB database (local MongoDB or MongoDB Atlas)
- A FACEIT Open API key

## Setup
1) Install dependencies:
```bash
npm install
```

2) Create your env file:
```bash
cp .env.example .env
```
Fill in:
- `FACEIT_API_KEY`
- `MONGODB_URI`
- (recommended) `ADMIN_PASSWORD`, `SESSION_SECRET`

3) Start the server:
```bash
npm start

(Loads .env automatically via dotenv)
```

4) Open:
- Leaderboard: http://localhost:3000
- Admin: http://localhost:3000/admin (or /admin.html)

## Notes
- The server caches FACEIT player profiles in-memory for a short time to reduce API calls.
- The admin session is stored in MongoDB (connect-mongo).
- Default admin password is `123` if you don't set `ADMIN_PASSWORD` (change it!).
