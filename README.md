# Monitoring Dashboard — Phase 6

A DevOps/DB admin console for managing Liquibase-managed MySQL schema migrations across three environments: DEV, QA, and PROD.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [Detailed Setup Instructions](#detailed-setup-instructions)
- [Running the Application](#running-the-application)
- [Using the Dashboard](#using-the-dashboard)
- [Troubleshooting](#troubleshooting)
- [API Endpoints](#api-endpoints)
- [Acceptance Criteria](#acceptance-criteria)

## Overview

This dashboard provides a web-based interface to:
- View environment status (DEV/QA/PROD) and current schema versions
- View migration history from `DATABASECHANGELOG` table
- View pending migrations (compares `master-changelog.json` vs database)
- Execute migrations via Liquibase CLI
- Perform rollbacks to specific tags
- Compare schemas between environments

## Prerequisites

- **Windows 10/11** (tested on Windows 10.0.26100)
- **Node.js** (v14 or higher) and npm
- **Docker Desktop** for Windows (for MySQL containers)
- **Liquibase CLI** installed at `C:\Program Files\liquibase\`
- **MySQL JDBC Driver** (mysql-connector-j-*.jar) in Liquibase lib folder

## Quick Start Guide

### 1. Clone and Install Dependencies

```powershell
cd D:\PRISM\phase6_dashboard
cd backend
npm install
cd ..\frontend
npm install
```

### 2. Set Up MySQL Containers

```powershell
# From project root
docker-compose up -d

# Wait for containers to be healthy (about 30 seconds)
docker-compose ps
```

### 3. Install Liquibase and JDBC Driver

1. Download Liquibase from https://www.liquibase.org/download
2. Extract to `C:\Program Files\liquibase\`
3. Download MySQL JDBC driver (e.g., `mysql-connector-j-9.5.0.jar`)
4. Copy the JAR file to `C:\Program Files\liquibase\lib\`

**Verify Liquibase installation:**
```powershell
& "C:\Program Files\liquibase\liquibase.bat" --version
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database Connection URLs
# Format: jdbc:mysql://host:port/database?user=username&password=password
DEV_DATABASE_URL=jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin
QA_DATABASE_URL=jdbc:mysql://127.0.0.1:3308/testdb_qa?user=root&password=admin
PROD_DATABASE_URL=jdbc:mysql://127.0.0.1:3309/testdb_prod?user=root&password=admin

# Liquibase Configuration
LIQUIBASE_PATH=C:/Program Files/liquibase/liquibase.bat

# Backend Server Port
PORT=4000
```

**Important:** 
- Save the `.env` file with **UTF-8 encoding (no BOM)**
- Use forward slashes in `LIQUIBASE_PATH` even on Windows
- Ensure no trailing spaces or hidden characters

### 5. Bootstrap Databases (Optional)

Before using the dashboard, you can manually bootstrap the databases:

```powershell
# For DEV environment
& "C:\Program Files\liquibase\liquibase.bat" `
  --url="jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin" `
  --changeLogFile="D:/PRISM/phase6_dashboard/backend/changelogs/001-create-users.xml" `
  update

# Verify status
& "C:\Program Files\liquibase\liquibase.bat" `
  --url="jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin" `
  --changeLogFile="D:/PRISM/phase6_dashboard/backend/changelogs/001-create-users.xml" `
  status
```

### 6. Start the Application

**Terminal 1 - Backend:**
```powershell
cd backend
npm start
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm start
```

The frontend will open at `http://localhost:3000` and the backend API at `http://localhost:4000`.

## Detailed Setup Instructions

### MySQL Containers Setup

The `docker-compose.yml` file defines three MySQL 8 containers:

- **DEV**: `testdb_dev` on port `3307`
- **QA**: `testdb_qa` on port `3308`
- **PROD**: `testdb_prod` on port `3309`

All databases are created automatically with:
- Root password: `admin`
- Database names: `testdb_dev`, `testdb_qa`, `testdb_prod`

**Start containers:**
```powershell
docker-compose up -d
```

**Check container status:**
```powershell
docker-compose ps
docker-compose logs devdb
```

**Stop containers:**
```powershell
docker-compose down
```

**Remove volumes (clean slate):**
```powershell
docker-compose down -v
```

### Liquibase Installation

1. **Download Liquibase:**
   - Visit https://www.liquibase.org/download
   - Download the ZIP file for Windows
   - Extract to `C:\Program Files\liquibase\`

2. **Verify Installation:**
   ```powershell
   & "C:\Program Files\liquibase\liquibase.bat" --version
   ```
   Should output something like: `Liquibase Version: 4.x.x`

3. **Install MySQL JDBC Driver:**
   - Download `mysql-connector-j-9.5.0.jar` (or latest version)
   - Copy to `C:\Program Files\liquibase\lib\`
   - Verify the file exists:
     ```powershell
     Test-Path "C:\Program Files\liquibase\lib\mysql-connector-j-9.5.0.jar"
     ```

### Environment Variables (.env)

Create `backend/.env` with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DEV_DATABASE_URL` | JDBC URL for DEV database | `jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin` |
| `QA_DATABASE_URL` | JDBC URL for QA database | `jdbc:mysql://127.0.0.1:3308/testdb_qa?user=root&password=admin` |
| `PROD_DATABASE_URL` | JDBC URL for PROD database | `jdbc:mysql://127.0.0.1:3309/testdb_prod?user=root&password=admin` |
| `LIQUIBASE_PATH` | Path to Liquibase executable (forward slashes) | `C:/Program Files/liquibase/liquibase.bat` |
| `PORT` | Backend server port | `4000` |

**URL Format Options:**
- `jdbc:mysql://host:port/database?user=xxx&password=yyy`
- `mysql://user:password@host:port/database`

**Important Notes:**
- Save `.env` as **UTF-8 without BOM** (use Notepad++ or VS Code)
- Use forward slashes in `LIQUIBASE_PATH` even on Windows
- No quotes needed around values in `.env` file
- No trailing spaces

### Changelog Files

Changelog files are located in `backend/changelogs/`:

- `001-create-users.xml` - Creates `app_users` table
- `002-add-email.xml` - Adds `email` column to `app_users`
- `master-changelog.json` - Manifest listing all changesets

The `master-changelog.json` format:
```json
{
  "changesets": [
    {
      "id": "001-create-users",
      "author": "lalu",
      "filename": "changelogs/001-create-users.xml",
      "description": "create users table"
    },
    {
      "id": "002-add-email",
      "author": "lalu",
      "filename": "changelogs/002-add-email.xml",
      "description": "add email column"
    }
  ]
}
```

## Running the Application

### Start Backend

```powershell
cd backend
npm start
```

Expected output:
```
Server running on 4000
```

### Start Frontend

```powershell
cd frontend
npm start
```

The React app will open in your browser at `http://localhost:3000`.

### Verify Backend Health

```powershell
# In PowerShell
Invoke-WebRequest -Uri http://localhost:4000/health
```

Or visit `http://localhost:4000/health` in a browser.

## Using the Dashboard

### Viewing Environment Status

The dashboard displays three environment cards (DEV, QA, PROD) showing:
- Database connection status (✅ Connected / 🔴 Down)
- Latest migration applied
- Click on an environment card to select it

### Viewing Pending Migrations

1. Select an environment (click the card)
2. The "Pending Migrations" panel shows migrations not yet applied
3. Click "Run" to execute a migration
4. Confirm the action in the dialog
5. View the output in a modal (scrollable, shows stdout/stderr)

### Viewing Migration History

The "Migration History" panel shows all applied migrations from `DATABASECHANGELOG`, ordered by execution time.

### Executing Migrations

1. Click "Run" on a pending migration
2. Confirm in the dialog
3. Wait for execution (button shows "Running...")
4. View output in modal (success or error)
5. Dashboard auto-refreshes after successful execution

### Manual Liquibase Commands

You can also run Liquibase manually from PowerShell:

```powershell
# Update (apply pending migrations)
& "C:\Program Files\liquibase\liquibase.bat" `
  --url="jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin" `
  --changeLogFile="D:/PRISM/phase6_dashboard/backend/changelogs/001-create-users.xml" `
  update

# Check status
& "C:\Program Files\liquibase\liquibase.bat" `
  --url="jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin" `
  --changeLogFile="D:/PRISM/phase6_dashboard/backend/changelogs/001-create-users.xml" `
  status

# Rollback to a tag
& "C:\Program Files\liquibase\liquibase.bat" `
  --url="jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin" `
  --changeLogFile="D:/PRISM/phase6_dashboard/backend/changelogs/001-create-users.xml" `
  rollback tag_name
```

**Key Points:**
- Use forward slashes in `--changeLogFile` path
- Quote paths with spaces
- Use `& "path"` syntax in PowerShell for paths with spaces

## Troubleshooting

### Common Errors and Fixes

#### 1. "The system cannot find the path specified"

**Error:** Liquibase executable not found

**Fix:**
- Verify Liquibase is installed at `C:\Program Files\liquibase\liquibase.bat`
- Check `.env` file has correct `LIQUIBASE_PATH` (use forward slashes)
- Test manually: `& "C:\Program Files\liquibase\liquibase.bat" --version`

#### 2. "Unknown database 'ysql://...'"

**Error:** Database URL parsing issue (often due to BOM or wrong format)

**Fix:**
- Ensure `.env` file is saved as **UTF-8 without BOM**
- Check URL format: `jdbc:mysql://127.0.0.1:3307/testdb_dev?user=root&password=admin`
- Verify no hidden characters or trailing spaces
- Use Notepad++ or VS Code to edit `.env` and save as UTF-8

#### 3. "ChangeLogParseException: Could not find file"

**Error:** Liquibase cannot find the changelog file

**Fix:**
- Backend converts paths to forward slashes automatically
- Ensure changelog file exists in `backend/changelogs/`
- Check backend logs for the exact path being used
- Verify file permissions (readable)

#### 4. "ClassNotFoundException: com.mysql.cj.jdbc.Driver"

**Error:** MySQL JDBC driver not found

**Fix:**
- Copy `mysql-connector-j-*.jar` to `C:\Program Files\liquibase\lib\`
- Verify file exists: `Test-Path "C:\Program Files\liquibase\lib\mysql-connector-j-9.5.0.jar"`
- Restart backend after adding driver

#### 5. "Duplicate JAR" warnings

**Warning:** Multiple MySQL connector JARs found

**Fix:**
- This is usually harmless, but you can remove duplicate JARs from `lib/` folder
- Keep only the version you need (e.g., `mysql-connector-j-9.5.0.jar`)

#### 6. Database Connection Errors

**Error:** `ECONNREFUSED` or `ER_ACCESS_DENIED_ERROR`

**Fix:**
- Verify Docker containers are running: `docker-compose ps`
- Check container logs: `docker-compose logs devdb`
- Verify ports are correct (3307, 3308, 3309)
- Test connection manually:
  ```powershell
  mysql -h 127.0.0.1 -P 3307 -u root -padmin -e "SELECT 1"
  ```

#### 7. PowerShell Path Quoting Issues

**Error:** Commands fail with paths containing spaces

**Fix:**
- Use `& "path"` syntax: `& "C:\Program Files\liquibase\liquibase.bat" --version`
- Or use `&` operator: `& 'C:\Program Files\liquibase\liquibase.bat' --version`
- Backend handles quoting automatically, but verify in logs

#### 8. Backend Fails to Start

**Error:** Port already in use or module not found

**Fix:**
- Check if port 4000 is in use: `netstat -ano | findstr :4000`
- Kill process if needed or change `PORT` in `.env`
- Reinstall dependencies: `cd backend && npm install`

### Useful Diagnostic Commands

```powershell
# Test Liquibase installation
& "C:\Program Files\liquibase\liquibase.bat" --version

# Test database connectivity
mysql -h 127.0.0.1 -P 3307 -u root -padmin -e "SELECT 1"

# Check Docker containers
docker-compose ps
docker-compose logs devdb

# Test backend API
Invoke-WebRequest -Uri http://localhost:4000/health
Invoke-WebRequest -Uri http://localhost:4000/api/database/status

# Check if JDBC driver exists
Test-Path "C:\Program Files\liquibase\lib\mysql-connector-j-9.5.0.jar"

# Verify .env file encoding (should be UTF-8)
Get-Content backend\.env -Encoding UTF8 | Select-Object -First 1
```

### Manual Database Verification

```powershell
# Connect to DEV database
mysql -h 127.0.0.1 -P 3307 -u root -padmin testdb_dev

# In MySQL prompt:
SHOW TABLES;
SELECT * FROM DATABASECHANGELOG;
SELECT * FROM DATABASECHANGELOGLOCK;
```

## API Endpoints

### GET /api/environments
Returns latest migration for each environment.

**Response:**
```json
{
  "dev": { "latest": { "id": "001-create-users", "author": "lalu", ... } },
  "qa": { "latest": null },
  "prod": { "latest": null }
}
```

### GET /api/migrations/history?env=dev
Returns migration history for an environment.

**Response:**
```json
{
  "env": "dev",
  "history": [
    { "id": "001-create-users", "author": "lalu", "dateexecuted": "...", ... }
  ]
}
```

### GET /api/migrations/pending?env=dev
Returns pending migrations (from `master-changelog.json` not in database).

**Response:**
```json
{
  "env": "dev",
  "pending": [
    { "id": "002-add-email", "author": "lalu", "filename": "changelogs/002-add-email.xml", ... }
  ]
}
```

### GET /api/database/status
Returns connection status for all environments.

**Response:**
```json
{
  "dev": { "ok": true },
  "qa": { "ok": true },
  "prod": { "ok": false, "error": "..." }
}
```

### POST /api/migrations/execute
Executes a migration.

**Request Body:**
```json
{
  "env": "dev",
  "changelogFile": "changelogs/002-add-email.xml"
}
```

**Response:**
```json
{
  "ok": true,
  "output": "Liquibase output...",
  "warnings": null
}
```

### POST /api/migrations/rollback
Rolls back to a tag.

**Request Body:**
```json
{
  "env": "dev",
  "tag": "tag_name"
}
```

### GET /api/migrations/diff?source=dev&target=qa
Compares schemas between environments.

## Acceptance Criteria

### ✅ From Scratch Setup

1. **Docker Compose:**
   ```powershell
   docker-compose up -d
   ```
   - Creates three MySQL instances
   - Databases `testdb_dev`, `testdb_qa`, `testdb_prod` are created
   - Containers are healthy

2. **Liquibase CLI:**
   ```powershell
   & "C:\Program Files\liquibase\liquibase.bat" --version
   ```
   - Prints version without error
   - `status` command returns "is up to date" after bootstrapping

3. **Backend:**
   ```powershell
   cd backend
   npm start
   ```
   - No exceptions in logs
   - `GET /api/database/status` returns all three `{ ok: true }`

4. **Frontend:**
   ```powershell
   cd frontend
   npm start
   ```
   - Opens at `http://localhost:3000`
   - Shows three environment cards
   - Pending migrations list is visible

### ✅ Migration Execution

1. **Pending Migration Display:**
   - Shows `002-add-email` in pending list for DEV (if `001-create-users` is applied)
   - Displays readable name and description

2. **Execute Migration:**
   - Click "Run" on `002-add-email`
   - Confirm dialog appears
   - Migration executes
   - Output modal shows stdout/stderr
   - Pending list updates (removes executed migration)
   - History updates (shows new migration)
   - Environment status updates

3. **Database Verification:**
   ```sql
   SELECT * FROM DATABASECHANGELOG;
   ```
   - Migration is recorded in `DATABASECHANGELOG`
   - `app_users` table has `email` column (for `002-add-email`)

### ✅ Error Handling

- No Liquibase fatal error dialogs (only optional warnings)
- Errors are displayed in modal with full details
- Backend logs show full command and output
- Frontend handles errors gracefully

## Project Structure

```
phase6_dashboard/
├── backend/
│   ├── changelogs/
│   │   ├── 001-create-users.xml
│   │   ├── 002-add-email.xml
│   │   └── master-changelog.json
│   ├── controllers/
│   │   └── migrations.js
│   ├── db/
│   │   └── pool.js
│   ├── liquibase.properties
│   ├── .env (create this)
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── EnvironmentCard.jsx
│   │   │   ├── MigrationsTimeline.jsx
│   │   │   └── PendingMigrations.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── index.jsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## License

This project is part of Phase 6 of the PRISM monitoring dashboard.

