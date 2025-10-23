# Field Capture – Nama Khoi (Web App)

Single-file HTML app to capture site data and post to an n8n webhook. Supports per-user outboxes, offline queueing, and an admin-only settings dialog.

## Features
- Login screen; **Settings only for `Gerhard.B`**
- Capture form (general, electrical, water)
- Per-user outbox + “Upload Outbox” (sequential, 1 item at a time)
- Autosync every 3 minutes when items exist
- Geolocation badge with watch/refresh
- Manage users and meter types in Settings
- Success if webhook returns **HTTP 200**

## Files
- `index.html` – the entire app
- `LICENSE` – MIT license
- `README.md` – this file

## Run locally
Just open `index.html` in a browser. For a local server (recommended due to some browsers’ storage/security rules):

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages
1. Create a new GitHub repo, push these files.
2. In repo settings → **Pages**, set **Source: Deploy from a branch**, **Branch: main /root**.
3. Visit the Pages URL.

## Configure n8n
- Endpoint must accept POST JSON.
- Respond with **HTTP 200 OK** to mark as success.
- If you deploy n8n on a different domain than GitHub Pages, ensure **CORS** allows your Pages origin.

Example final node in n8n: **HTTP Response**
- Status: `200`
- Body: `OK` (not used; only status is checked)

## Default login
- Username: `Gerhard.B`
- Password: `Gt55115511`
