# Database Setup Guide

PostgreSQL is not installed locally. You have two options:

## Option 1: Use Supabase (Managed PostgreSQL) - **Recommended**

1. Go to https://supabase.com and sign up (free tier available)
2. Create a new project
3. Copy your database connection string from Settings → Database → Connection String
4. Update `apps/backend/.env`:
   ```
   DATABASE_URL="your-supabase-connection-string"
   ```
5. Run migrations and seeding:
   ```
   npm run --workspace apps/backend migrate
   npm run --workspace apps/backend seed
   npm run --workspace apps/backend smoke:modules
   ```

## Option 2: Install PostgreSQL Locally

### Windows Installation:
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run the installer (recommended: default port 5432, user=postgres, password=postgres)
3. After installation, run:
   ```
   npm run --workspace apps/backend migrate
   npm run --workspace apps/backend seed
   npm run --workspace apps/backend smoke:modules
   ```

## Option 3: Use WSL2 with PostgreSQL

If you have WSL2 installed:
```bash
# In WSL terminal
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start

# Create database
sudo -u postgres createdb erp_saas

# Then run from Windows PowerShell:
npm run --workspace apps/backend migrate
npm run --workspace apps/backend seed
npm run --workspace apps/backend smoke:modules
```

---

**Current Status:** Backend is ready, just need database connectivity.
**Next Step:** Choose an option above and update `.env` with the connection string.
