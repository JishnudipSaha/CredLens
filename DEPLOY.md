# Deploying CredLens

You have four deployment options, ordered from quickest to most production-grade. Pick the one that matches your budget, scale, and operational appetite.

| Option | Frontend | Backend | DB | Time to live | Cost |
|---|---|---|---|---|---|
| 1. Vercel + Render | Vercel free | Render starter | Render Postgres (free 90d) | 15 min | $0 (then ~$7/mo) |
| 2. Single VM | nginx | uvicorn + systemd | SQLite or Postgres | 45 min | $5-10/mo |
| 3. Docker on a VM | nginx (container) | FastAPI (container) | Postgres (container) | 30 min | $5-10/mo |
| 4. AWS / GCP managed | S3+CloudFront or Amplify | ECS Fargate or Cloud Run | RDS Postgres | 2-3 hrs | $30+/mo |

The codebase ships with config for all four:
- `vercel.json` (Vercel routing)
- `render.yaml` (Render Blueprint)
- `Dockerfile` x2 + `docker-compose.yml` (Docker route)
- The backend reads `CREDLENS_DATABASE_URL`, `CREDLENS_SECRET_KEY`, and `CREDLENS_CORS_ORIGINS` env vars for any provider.

---

## Option 1: Vercel + Render (recommended for demos)

This is the fastest path to a public URL.

### 1.1 Push to GitHub

```bash
cd E:\Credlens
git init
git add .
git commit -m "CredLens MVP"
gh repo create credlens --public --source=. --remote=origin --push
```

If you don't have `gh`, create the repo on github.com and:
```bash
git remote add origin https://github.com/<you>/credlens.git
git push -u origin main
```

### 1.2 Deploy the backend on Render

1. Go to https://render.com, sign up with GitHub.
2. Click **New +** -> **Blueprint** -> select your `credlens` repo.
3. Render reads `render.yaml` and provisions:
   - A web service `credlens-backend` (Python)
   - A Postgres database `credlens-db`
   - A `CREDLENS_SECRET_KEY` env var (auto-generated)
4. Click **Apply**. Wait ~5 min for the first build.
5. The backend will be live at `https://credlens-backend.onrender.com`. Health check: `/health`.
6. The seed runs automatically on first launch (creates the 4 demo users, 50 MSMEs, default policy).

### 1.3 Deploy the frontend on Vercel

1. Go to https://vercel.com, sign up with GitHub.
2. Click **Add New** -> **Project** -> import `credlens`.
3. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Environment Variable:** `VITE_API_BASE` = `https://credlens-backend.onrender.com/api/v1`
4. Click **Deploy**. Wait ~1 min.
5. The frontend will be live at `https://credlens.vercel.app`.

### 1.4 Connect the two

Go back to Render -> `credlens-backend` -> Environment, and set:
- `CREDLENS_CORS_ORIGINS` = `https://credlens.vercel.app`

(The default in code only allows localhost, so the Vercel frontend will be blocked by CORS until you set this. Restart the Render service after editing.)

### 1.5 Verify

Open `https://credlens.vercel.app`, sign in with `lender@credlens.in` / `lender123`, and run an assessment.

### Gotchas

- **Render free tier sleeps after 15 min idle.** First request after sleep takes ~30s. Upgrade to "Standard" ($7/mo) for always-on.
- **Render Postgres free tier expires after 90 days.** Migrate to a paid instance or point `CREDLENS_DATABASE_URL` at another provider.
- **Custom domains:** Both Vercel and Render support them. In Render, also update `CREDLENS_CORS_ORIGINS` to the new origin.

---

## Option 2: Single-VM deployment (no Docker)

Use a Linux VM (Hetzner, DigitalOcean, AWS Lightsail, your own server). One box, nginx in front, uvicorn behind it.

### 2.1 Provision

Spin up Ubuntu 22.04, SSH in. Install dependencies:

```bash
sudo apt update && sudo apt install -y python3.13 python3-pip python3-venv nodejs npm nginx certbot python3-certbot-nginx git
```

### 2.2 Clone and install

```bash
git clone https://github.com/<you>/credlens.git /opt/credlens
cd /opt/credlens/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.ml.train_synthetic   # one-time, ~12s
deactivate

cd /opt/credlens/frontend
npm install
npm run build
```

### 2.3 systemd unit for the backend

Create `/etc/systemd/system/credlens-backend.service`:

```ini
[Unit]
Description=CredLens FastAPI backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/credlens/backend
Environment="PATH=/opt/credlens/backend/.venv/bin"
Environment="CREDLENS_SECRET_KEY=replace-with-32-random-bytes"
Environment="CREDLENS_CORS_ORIGINS=https://credlens.example.com"
ExecStart=/opt/credlens/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now credlens-backend
sudo systemctl status credlens-backend
```

### 2.4 nginx

Create `/etc/nginx/sites-available/credlens`:

```nginx
server {
  listen 80;
  server_name credlens.example.com;

  root /opt/credlens/frontend/dist;
  index index.html;

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/credlens /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# TLS
sudo certbot --nginx -d credlens.example.com
```

### 2.5 Backups

The backend uses SQLite by default at `/opt/credlens/backend/data/credlens.db`. For a real deployment switch to Postgres:

```bash
sudo apt install -y postgresql
sudo -u postgres createuser credlens
sudo -u postgres createdb credlens -O credlens
sudo -u postgres psql -c "ALTER USER credlens WITH PASSWORD '<your-password>';"
```

Then add to the systemd unit:
```
Environment="CREDLENS_DATABASE_URL=postgresql+psycopg2://credlens:<your-password>@127.0.0.1:5432/credlens"
```

And set up a daily backup:
```bash
# /etc/cron.daily/credlens-backup
pg_dump -U credlens credlens | gzip > /var/backups/credlens-$(date +\%F).sql.gz
find /var/backups -name 'credlens-*.sql.gz' -mtime +30 -delete
```

---

## Option 3: Docker on a single VM

Same VM as Option 2, but everything in containers. Easier to replicate, easier to move hosts.

### 3.1 Provision the VM

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 3.2 Clone and run

```bash
git clone https://github.com/<you>/credlens.git /opt/credlens
cd /opt/credlens
cp .env.example .env             # then edit .env (see below)
docker compose up -d --build
```

`.env`:
```
CREDLENS_SECRET_KEY=<32 random bytes>
```

That's it. The stack is up. Ports:
- Frontend (nginx): `http://your-vm-ip:8080`
- Backend (FastAPI): `http://your-vm-ip:8000` (only if you need to hit it directly)
- Postgres: `localhost:5432` (only from inside the VM)

### 3.3 TLS with nginx + certbot on the host

In production you don't expose port 8080 to the internet. Instead, run nginx on the host as a reverse proxy with Let's Encrypt. `docker-compose.yml` already binds the frontend container to `127.0.0.1:8080` internally.

```bash
# /etc/nginx/sites-available/credlens
server {
  listen 80;
  server_name credlens.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

```bash
sudo certbot --nginx -d credlens.example.com
```

### 3.4 Backups

The Postgres volume is `credlens_pgdata`. Back it up with:

```bash
docker compose exec db pg_dump -U credlens credlens | gzip > credlens-$(date +%F).sql.gz
```

Or schedule a daily containerised cron:
```bash
# /etc/cron.d/credlens-backup
0 3 * * *  cd /opt/credlens && /usr/local/bin/docker compose exec -T db pg_dump -U credlens credlens | gzip > /var/backups/credlens-$(date +\%F).sql.gz
```

### 3.5 Updating

```bash
cd /opt/credlens
git pull
docker compose up -d --build
```

---

## Option 4: AWS / GCP / Azure

Use this when you need auto-scaling, multi-region, managed DB backups, observability.

### AWS reference architecture

```
Route 53 -> CloudFront -> S3 (frontend static assets)
                            \
                             -> ALB -> ECS Fargate (FastAPI)
                                              \
                                               -> RDS Postgres (Multi-AZ)
                                               -> ElastiCache Redis (sessions)
                                               -> S3 (model artifacts, user uploads)
                                               -> CloudWatch Logs
                                               -> Secrets Manager (JWT secret, DB creds)
```

The Dockerfile already does the right thing for Fargate. For the frontend, build the bundle and `aws s3 sync dist/ s3://credlens-frontend/`, then put CloudFront in front with the standard SPA behavior (custom error response = 200 /index.html).

### GCP equivalent

```
Cloud DNS -> Cloud CDN -> Cloud Storage (frontend)
                          \
                           -> HTTPS Load Balancer -> Cloud Run (FastAPI)
                                                        \
                                                         -> Cloud SQL Postgres
                                                         -> Secret Manager
```

Cloud Run will scale to zero and back; budget $5-20/mo for low traffic.

---

## Pre-deployment checklist

- [ ] **Secret key generated** - `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Put it in `CREDLENS_SECRET_KEY`.
- [ ] **CORS origins set** - `CREDLENS_CORS_ORIGINS=https://your-frontend.example.com`
- [ ] **Database is reachable** - on Render, Vercel, your VM, or managed Postgres
- [ ] **Initial seed runs** - first request will create the 4 demo users; check by signing in with `lender@credlens.in` / `lender123`
- [ ] **HTTPS enabled** - never serve the API over plain HTTP in production
- [ ] **Backups scheduled** - daily `pg_dump` or filesystem snapshot
- [ ] **Health check monitored** - point your uptime monitor at `/health`
- [ ] **Logs forwarded** - Render/Cloud Run/CloudWatch already do this; on a VM, use journalctl or a sidecar like Promtail

## What the seed does on first boot

The backend's `lifespan` handler calls `seed_all()` on every startup. `seed_all` is idempotent: if any users exist, it skips. On a brand-new database it creates:

- 4 demo users (LENDER, MSME, GOVERNMENT, ADMIN) with the passwords from the README
- 1 default policy
- 50 synthetic MSMEs with full financial data
- 20 initial scoring runs

So the first request after deploy will already have a populated demo. For production you probably want to disable this and seed users manually - happy to add a `CREDLENS_AUTO_SEED=false` flag if you want.

## Monitoring in production

For each option, expose:
- `/health` - already returns `{"status":"ok"}` - point an uptime monitor here
- Structured JSON logs - already on stdout - your platform will pick them up
- Audit log table - `GET /api/v1/admin/audit-log` shows every authenticated API call

If you need metrics, the easiest add is to mount `prometheus-fastapi-instrumentator` and scrape `/metrics` from Prometheus. That is a 5-line change I can make if you want.
