# AskMak — how to run

Intelligent chatbot for Makerere University student support. This document lists the steps to run it locally.

**Layout:** API and jobs live under `backend/` (Express `server.js`, routes, services, `db/`, `scripts/`). Static HTML/CSS/JS are served from `frontend/public/`. The repo root keeps `package.json`, `.env`, and `docker-compose.yml`.

## Prerequisites

- **Node.js** and npm
- **Docker** and **Docker Compose** (for PostgreSQL with pgvector and MinIO)

## 1. Install dependencies

From the project root:

```bash
npm install
```

## 2. Configure environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | Notes |
|----------|--------|
| `OPENAI_API_KEY` | Required for the language model |
| `JWT_SECRET` | Use a long random string |
| `COOKIE_SECRET` | Use a different long random string |
| `ADMIN_PASSWORD` | Change if you use the admin UI |

The defaults in `.env.example` match the Docker services: Postgres on `localhost:5434`, MinIO on `localhost:9000`.

## 3. Start backing services (Postgres + MinIO)

**Option A — two commands**

```bash
docker compose up -d
npm run setup-minio
```

**Option B — one command** (starts Docker and creates MinIO buckets)

```bash
npm run setup
```

Service ports (from `docker-compose.yml`):

- PostgreSQL: **5434** (host) → 5432 (container)
- MinIO API: **9000**
- MinIO console: **9001**

### VPS stack (ports 4000–4999, `dockeruser_network`, `~/docker-volumes`)

Use this when your host policy requires **only** host ports in **4000–4999**, a shared external network, and data under **`~/docker-volumes/`** (no sudo or privileged containers needed).

Recommended — **one command** after `npm install` (creates network and volume dirs if missing, waits for Postgres and MinIO, then creates buckets):

```bash
npm run vps:bootstrap
```

Manual equivalent (as user `dockeruser`):

```bash
docker network create dockeruser_network
mkdir -p "${HOME}/docker-volumes/askmak/pgdata" "${HOME}/docker-volumes/askmak/minio"
docker compose -f docker-compose.dockeruser.yml up -d
npm run setup-minio
```

Mapped host ports (all on `127.0.0.1` only):

- PostgreSQL: **4520** → 5432
- MinIO API: **4900** → 9000
- MinIO console: **4901** → 9001

Align `.env`: `DATABASE_URL` with port **4520**, `MINIO_ENDPOINT` **http://127.0.0.1:4900**, optional `MINIO_CONSOLE_URL=http://127.0.0.1:4901`. Set **`NODE_ENV=production`**, **`PORT`** (and **`CORS_ORIGIN`**) to a free host port **4000–4999**, e.g. **4500**. Use **`HOST=0.0.0.0`** only when clients reach Node directly (no reverse proxy on localhost); otherwise keep **`HOST`** unset (`127.0.0.1`). With **`NODE_ENV=production`**, the server **retries** the DB on startup and **exits** if Postgres never becomes available — avoid starting Node before Docker has finished pulling images unless you raise **`DB_CONNECT_MAX_ATTEMPTS`**.

Consider deploying the app tree under **`~/apps/askmak`** if that matches your layout; Compose only needs repo paths for `./backend/db/...` init scripts relative to where you run it.

## 4. Run the application

**Normal start**

```bash
npm start
```

**Development** (auto-restart on file changes)

```bash
npm run dev
```

The server prints a URL such as `http://localhost:3000/` (or the port set by `PORT` in `.env`). By default it listens on **127.0.0.1** (same-machine or reverse-proxy access only); set **`HOST=0.0.0.0`** on a VPS when binding all interfaces.

## 5. Optional — ingest documents

If you use the document ingestion pipeline:

```bash
npm run ingest
```

## npm scripts reference

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `node backend/server.js` | Run the server |
| `dev` | `nodemon backend/server.js` | Run with file watching |
| `setup` | `docker compose up -d && node backend/scripts/setup-minio.js` | Infra + MinIO buckets |
| `setup-dockeruser` | `docker compose -f docker-compose.dockeruser.yml up -d && node backend/scripts/setup-minio.js` | Policy stack (`dockeruser_network`, ports **4000–4999**) + MinIO buckets |
| `vps:bootstrap` | `bash deploy/vps-bootstrap.sh` | VPS-first flow: network + volumes + compose up + wait for Postgres/MinIO + `setup-minio` |
| `setup-minio` | `node backend/scripts/setup-minio.js` | Create MinIO buckets only |
| `ingest` | `node backend/scripts/ingest.js` | Run ingestion |
| `eval` | `node backend/eval/run.js` | Check retrieval against `backend/eval/golden-questions.json` (run after `ingest`) |

## Troubleshooting

- Ensure Docker containers are healthy before starting the app (`docker compose ps`).
- If MinIO errors appear on upload, run `npm run setup-minio` again after MinIO is up.
- Database connection issues: confirm `DATABASE_URL` in `.env` matches your compose file (default **5434** with `docker-compose.yml`, or **4520** with `docker-compose.dockeruser.yml`) and credentials. Run **`npm run vps:bootstrap`** on the VPS so Postgres is up before **`npm start`**.
