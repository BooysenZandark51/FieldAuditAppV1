# Audit Capture App

A lightweight, offline-friendly field audit web app that queues submissions locally and uploads them to your n8n webhook. Authentication is handled via admin bypass or a GET auth webhook. New users are created via a POST webhook.

## Features
- Offline queue (Outbox) with background retry
- Required fields: Stand Nr, Area, Street Address, Minisub / Bulk, Supply Cable, Breaker State
- Optional fields (Electrical, Water, Stand note)
- Admin-only Settings 
- Configurable webhooks:
  - Capture Webhook (POST)
  - Auth Webhook (GET)
  - Create-User Webhook (POST)

## Configure
Open Settings (⚙️) as the admin and set:
- n8n Webhook URL (capture, POST)
- Auth Webhook (GET)
- Create-User Webhook (POST)

Settings persist in localStorage.

## Data format
### Submit record (POST to Capture Webhook)
See `record` payload in the app source (index.html).

### Auth check (GET to Auth Webhook)
- Querystring: `?username=foo&password=bar`
- Expected: 200 if valid, otherwise non-200.

### Create user (POST to Create-User Webhook)
```json
{ "username": "foo", "password": "bar" }
```

## Run locally
Open `index.html` in a browser, or use a simple static server:
```bash
python -m http.server 8080
```

## Deploy to GitHub Pages (Actions)
This repo includes a workflow at `.github/workflows/pages.yml`. It uploads a single artifact and deploys via `actions/deploy-pages`.

1. Push to `main`.
2. In Settings → Pages, set **Source: GitHub Actions** (or Deploy from branch).
