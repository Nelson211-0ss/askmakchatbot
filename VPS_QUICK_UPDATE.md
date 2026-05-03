# VPS: pull GitHub updates and restart (quick)

Routine update after pushing from your laptop. Production uses **`docker-compose.dockeruser.yml`** — always pass **`-f`**, never plain `docker compose` alone.

---

## 1. SSH in

```bash
ssh dockeruser@YOUR_VPS_HOST
```

(Use your real user and hostname or IP.)

## 2. Go to the project

```bash
cd ~/askmakchatbot
```

## 3. Pull latest code

```bash
git fetch origin
git pull origin main
```

Use your actual default branch instead of `main` if needed.

### If Git refuses due to stray local edits (discard them)

```bash
git fetch origin
git reset --hard origin/main
```

## 4. Refresh containers

```bash
cd ~/askmakchatbot
docker compose -f docker-compose.dockeruser.yml pull
docker compose -f docker-compose.dockeruser.yml up -d --build --remove-orphans
```

## 5. Verify

```bash
docker compose -f docker-compose.dockeruser.yml ps
```

Optional — follow logs (stop with `Ctrl+C`):

```bash
docker compose -f docker-compose.dockeruser.yml logs -f --tail=80
```

---

## One-liner (after you are SSH’d into the VPS)

```bash
cd ~/askmakchatbot && git pull origin main && docker compose -f docker-compose.dockeruser.yml pull && docker compose -f docker-compose.dockeruser.yml up -d --build --remove-orphans && docker compose -f docker-compose.dockeruser.yml ps
```

Swap `main` for your branch if different.

---

**Note:** Pulling Git does **not** change `.env` on the server — keep SMTP, JWT, DB URL, etc. updated there separately. Full first-time VPS setup lives in **`VPS_DEPLOY.md`**.
