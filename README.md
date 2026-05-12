# Liquibase Migration Dashboard

A DevOps and database admin console for Liquibase-managed MySQL schema migrations across DEV, QA, and PROD. The web dashboard shows environment status, migration history, and pending changesets. GitHub Actions can deploy to Railway MySQL. Docker images cover the dashboard and a portable Liquibase CLI runner.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Run the dashboard](#run-the-dashboard)
- [Liquibase migration container](#liquibase-migration-container)
- [CI/CD on Railway](#cicd-on-railway)
- [Using the dashboard](#using-the-dashboard)
- [Troubleshooting](#troubleshooting)
- [API endpoints](#api-endpoints)

## Overview

The dashboard lets you:

- View connection status and latest schema version per environment
- Read migration history from `DATABASECHANGELOG`
- Compare pending work against `master-changelog.json`
- Run migrations and rollbacks through the backend API (Liquibase CLI)
- Compare schemas between environments

Changelog XML files live under `backend/changelogs/`. The Liquibase root file used by CI and the migration container is `master-changelog.xml`.

## Architecture

```mermaid
flowchart LR
  subgraph local [Your machine]
    UI[Frontend :3000]
    API[Backend :4000]
    LBIMG[Liquibase image]
    DASHIMG[Dashboard images]
  end
  subgraph cloud [Cloud]
    GHA[GitHub Actions]
    RAIL[(Railway MySQL)]
  end
  UI --> API
  API --> RAIL
  GHA --> RAIL
  LBIMG --> RAIL
  DASHIMG --> UI
  DASHIMG --> API
```

| Component | Purpose |
|-----------|---------|
| `backend/` + `frontend/` | Node.js API and React UI |
| `docker-compose.yml` | Runs pre-built dashboard images on ports 4000 and 3000 |
| `prism-liquibase:build` | Portable Java 17 + Liquibase 4.33.0 + MySQL JDBC for manual `validate` / `update` |
| `.github/workflows/liquibase-pipeline.yml` | Push to `main` deploys DEV, then QA and PROD with GitHub environment approvals |
| Railway MySQL | Hosted databases referenced by `backend/.env` and GitHub secrets |

The Liquibase migration image does not run the dashboard. The dashboard backend image includes its own Liquibase install for API-triggered migrations.

## Prerequisites

- **Node.js** 18+ and npm (local development)
- **Docker Desktop** (optional, for containerized dashboard or Liquibase runner)
- **MySQL** reachable from your machine (Railway proxy URLs or local MySQL)
- **GitHub** repository with environment secrets for CI (see below)

On Windows, local Liquibase is optional if you use Docker for CLI migrations or only use the dashboard and CI.

## Project structure

```
CICDforLiquibaseMigration/
├── .github/workflows/
│   └── liquibase-pipeline.yml
├── backend/
│   ├── changelogs/
│   │   ├── master-changelog.xml
│   │   ├── master-changelog.json
│   │   └── *.xml
│   ├── controllers/migrations.js
│   ├── db/pool.js
│   ├── Dockerfile
│   ├── env.template
│   ├── .env                    # create locally; not committed
│   └── server.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   └── src/
├── scripts/
│   ├── build-dashboard-docker.ps1
│   └── start-dashboard-docker.ps1
├── docker-compose.yml
└── README.md
```

## Configuration

### Backend environment file

Copy `backend/env.template` to `backend/.env` and set JDBC URLs for each environment.

```env
DEV_DATABASE_URL=jdbc:mysql://HOST:PORT/DATABASE?user=USER&password=PASS
QA_DATABASE_URL=jdbc:mysql://HOST:PORT/DATABASE?user=USER&password=PASS
PROD_DATABASE_URL=jdbc:mysql://HOST:PORT/DATABASE?user=USER&password=PASS

# Windows host only
LIQUIBASE_PATH=C:/Program Files/liquibase/liquibase.bat

PORT=4000
```

Notes:

- Save `backend/.env` as UTF-8 without BOM.
- Use forward slashes in `LIQUIBASE_PATH` on Windows.
- Railway public URLs often work as `jdbc:mysql://user:pass@host:port/database`. If SSL errors appear, add `?sslMode=REQUIRED&allowPublicKeyRetrieval=true` (or append with `&` if `?` already exists).
- Use separate Railway MySQL services per environment in production. Using one URL for DEV, QA, and PROD is only suitable for demos.

### GitHub Actions secrets

In GitHub, configure environments `dev`, `qa`, and `prod` with secrets:

| Secret | Description |
|--------|-------------|
| `DEV_DB_URL` | JDBC URL for DEV Railway MySQL |
| `QA_DB_URL` | JDBC URL for QA Railway MySQL |
| `PROD_DB_URL` | JDBC URL for PROD Railway MySQL |

The workflow installs Liquibase 4.33.0 and MySQL connector 9.1.0 on the runner, then runs `validate` and `update` against `backend/changelogs/master-changelog.xml`.

## Run the dashboard

### Option A: Node.js on the host

```powershell
cd backend
npm install
npm start
```

In a second terminal:

```powershell
cd frontend
npm install
npm start
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health: http://localhost:4000/health

The backend reads `backend/.env` and shells out to `LIQUIBASE_PATH` when you run migrations from the UI.

### Option B: Docker Compose

Build images once (prefer the script on Windows; avoid `docker compose build` if Buildx Bake hangs):

```powershell
.\scripts\build-dashboard-docker.ps1
```

Start the stack:

```powershell
docker compose up -d
docker compose ps
```

Stop:

```powershell
docker compose down
```

`docker-compose.yml` maps the backend to port **4000** and the frontend to **3000** (nginx inside the frontend container listens on 80). The backend container sets `LIQUIBASE_PATH=/opt/liquibase/liquibase` and loads database URLs from `backend/.env`.

If Compose is slow or stuck, restart Docker Desktop, then use:

```powershell
.\scripts\start-dashboard-docker.ps1
```

That script runs the same images with `docker run`. Free ports **4000** and **3000** before starting (stop host `npm start` or other listeners).

Rebuild dashboard images after changing application code or dependencies:

```powershell
.\scripts\build-dashboard-docker.ps1
```

## Liquibase migration container

Use a dedicated image when you want a reproducible Liquibase CLI environment (manual migrations, coursework, or sharing a saved image). This is separate from the dashboard containers.

### Build the image (one-time)

```powershell
docker pull ubuntu:22.04
docker run -it --name prism-lb-build -v D:\PRISM\CICDforLiquibaseMigration:/workspace/CICDforLiquibaseMigration ubuntu:22.04 /bin/bash
```

Inside the container:

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y openjdk-17-jdk curl unzip ca-certificates

export LB_VERSION=4.33.0
export MYSQL_VERSION=9.1.0
curl -sLo /tmp/lb.zip "https://github.com/liquibase/liquibase/releases/download/v${LB_VERSION}/liquibase-${LB_VERSION}.zip"
unzip -q /tmp/lb.zip -d /opt/liquibase
chmod +x /opt/liquibase/liquibase
mkdir -p /opt/liquibase/lib
curl -sLo /opt/liquibase/lib/mysql.jar \
  "https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/${MYSQL_VERSION}/mysql-connector-j-${MYSQL_VERSION}.jar"
echo 'export PATH="/opt/liquibase:$PATH"' >> /root/.bashrc
/opt/liquibase/liquibase --version
exit
```

On the host:

```powershell
docker commit prism-lb-build prism-liquibase:build
docker save -o prism-liquibase-build.tar prism-liquibase:build
```

### Run migrations against Railway (or any JDBC URL)

```powershell
docker run -it --rm -v D:\PRISM\CICDforLiquibaseMigration:/workspace/CICDforLiquibaseMigration prism-liquibase:build /bin/bash
```

```bash
cd /workspace/CICDforLiquibaseMigration
export JDBC_URL="$(grep '^DEV_DATABASE_URL=' backend/.env | cut -d= -f2-)"

liquibase \
  --url="$JDBC_URL" \
  --changeLogFile=master-changelog.xml \
  --searchPath="$PWD/backend/changelogs" \
  --classpath="/opt/liquibase/lib/mysql.jar" \
  validate

liquibase \
  --url="$JDBC_URL" \
  --changeLogFile=master-changelog.xml \
  --searchPath="$PWD/backend/changelogs" \
  --classpath="/opt/liquibase/lib/mysql.jar" \
  update
```

On another machine: `docker load -i prism-liquibase-build.tar`, mount the repo, and use the same commands with the correct JDBC URL.

If `update` prints `Waiting for changelog lock...`, stop other Liquibase processes, then run `releaseLocks` with the same flags, or clear a stale lock only when no migration is running.

For MySQL on the Windows host from inside a container, use `host.docker.internal` instead of `127.0.0.1` in the JDBC URL.

## CI/CD on Railway

Workflow file: `.github/workflows/liquibase-pipeline.yml`

| Trigger | Behavior |
|---------|----------|
| Push to `main` | Deploy DEV, then QA (approval), then PROD (approval) |
| `workflow_dispatch` | Rollback on chosen environment (`rollback-count`) |

Each deploy job checks out the repo, installs Java 17 and Liquibase, validates changelogs, and runs `update` against the environment secret URL.

CI does not use your local `prism-liquibase-build.tar`. The runner installs tools on each job.

## Using the dashboard

1. Open http://localhost:3000
2. Review DEV, QA, and PROD cards for connectivity and latest migration
3. Select an environment to see pending migrations and history
4. Use **Run** on a pending item to execute via Liquibase (confirm in the dialog)
5. Inspect stdout and stderr in the result modal

Pending migrations are derived from `master-changelog.json` compared to `DATABASECHANGELOG`.

## Troubleshooting

### Docker Compose `build` appears stuck after “load local bake definitions”

Docker Desktop on Windows can hang on Buildx Bake. Use `.\scripts\build-dashboard-docker.ps1` instead of `docker compose build`, then `docker compose up -d` or `.\scripts\start-dashboard-docker.ps1`.

### `docker compose up` or `docker run` hangs with no output

Restart Docker Desktop. Confirm the engine with `docker run --rm hello-world`, then start the dashboard again.

### Liquibase `NumberFormatException: For input string: "PORT"`

The JDBC URL still contains placeholders. Copy the full value from `backend/.env`, not a template like `HOST:PORT`.

### `Waiting for changelog lock...`

Another migration is running, or a previous run left a lock. Stop other Liquibase clients, run `releaseLocks`, then retry `update`.

### Duplicate MySQL JAR warnings in the migration container

Usually harmless when `mysql.jar` is on the classpath and under `/opt/liquibase/lib`.

### Backend cannot find Liquibase on Windows

Install Liquibase locally or use the Docker backend (`LIQUIBASE_PATH` is set in the container). Verify with `liquibase --version` or the path in `backend/.env`.

### Database connection errors from the API

Check JDBC URLs in `backend/.env`, Railway service status, and firewall rules. Test with `GET http://localhost:4000/api/database/status`.

### Port already in use

```powershell
netstat -ano | findstr ":4000 :3000"
```

Stop conflicting processes before starting Docker or `npm start`.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Backend health check |
| GET | `/api/environments` | Latest migration per environment |
| GET | `/api/database/status` | Connection status for DEV, QA, PROD |
| GET | `/api/migrations/history?env=dev` | Applied changesets |
| GET | `/api/migrations/pending?env=dev` | Pending changesets |
| POST | `/api/migrations/execute` | Run a migration (`env`, `changelogFile`) |
| POST | `/api/migrations/rollback` | Rollback to a tag |
| POST | `/api/migrations/rollback-one` | Roll back one changeset |
| GET | `/api/migrations/diff?source=dev&target=qa` | Schema diff |
| GET | `/api/migrations/rollback-history` | Rollback audit history |
| GET | `/api/migrations/recent-deployments` | Recent deployment activity |
| GET | `/api/migrations/version-map` | Version map across environments |
| GET | `/api/migrations/metrics` | Migration metrics |
| GET | `/api/approvers` | Configured QA/PROD approvers |

## License

Part of the PRISM monitoring dashboard workstream.
