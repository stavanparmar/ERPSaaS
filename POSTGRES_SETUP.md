# PostgreSQL Quick Setup - Windows

## Step 1: Download & Install PostgreSQL

1. Visit: https://www.postgresql.org/download/windows/
2. Download the latest version (PostgreSQL 16 recommended)
3. Run the installer with these settings:
   - Port: `5432`
   - Username: `postgres`
   - Password: `postgres` (or any password you prefer)
   - Default everything else, click through

After installation completes, close the installer.

## Step 2: Create the Database

Open PowerShell and run:
```powershell
psql -U postgres -c "CREATE DATABASE erp_saas;"
```

When prompted, enter the password you set during installation.

## Step 3: Run Migrations & Seed

```powershell
npm run --workspace apps/backend migrate
npm run --workspace apps/backend seed
```

## Step 4: Run Smoke Test

```powershell
npm run --workspace apps/backend smoke:modules
```

---

**If you set a different password during PostgreSQL installation**, update `.env`:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/erp_saas?schema=public"
```

---

Let me know once PostgreSQL is installed and I'll help you run the setup commands.
