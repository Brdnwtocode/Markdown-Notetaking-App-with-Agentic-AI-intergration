# Complete Installation & Deployment Guide

## 🎯 Quick Start (5 minutes)

### Step 1: Prerequisites Check

```bash
# Check Node.js installation
node --version  # Should be v18 or higher
npm --version

# Check PostgreSQL
psql --version  # Should be version 14 or higher
```

If either is missing, install from:
- Node.js: https://nodejs.org/
- PostgreSQL: https://www.postgresql.org/download/

### Step 2: Database Setup

```bash
# Create database
createdb notetaking_app

# Or use pgAdmin/DBeaver GUI if preferred
```

### Step 3: Environment Configuration

```bash
# Copy template
cp .env.local.example .env.local

# Edit .env.local - fill in these values:
```

Edit `.env.local`:

```env
# Your PostgreSQL connection
DATABASE_URL="postgresql://localhost/notetaking_app"

# Generate a secret (on command line):
# openssl rand -hex 32
NEXTAUTH_SECRET="<paste-generated-secret>"
NEXTAUTH_URL="http://localhost:3000"

# Get these from GitHub OAuth app settings
NEXTAUTH_GITHUB_ID="<your-github-id>"
NEXTAUTH_GITHUB_SECRET="<your-github-secret>"

# Get these from Google OAuth settings
NEXTAUTH_GOOGLE_ID="<your-google-id>"
NEXTAUTH_GOOGLE_SECRET="<your-google-secret>"

# Get from OpenAI API dashboard
OPENAI_API_KEY="sk-<your-key>"
```

### Step 4: Install & Run

```bash
# Install dependencies
npm install

# Create database schema
npm run db:push

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

## 🔐 OAuth Configuration (Detailed)

### GitHub OAuth Setup

1. **Go to GitHub Settings**
   - Visit: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Fill Application Form**
   - Application name: `Markdown Notetaking App`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

3. **Copy Credentials**
   - Copy `Client ID` → `NEXTAUTH_GITHUB_ID`
   - Click "Generate" for secret → `NEXTAUTH_GITHUB_SECRET`

### Google OAuth Setup

1. **Create Google Cloud Project**
   - Visit: https://console.cloud.google.com/
   - Click "Create Project"

2. **Enable Google+ API**
   - Search for "Google+ API"
   - Click "Enable"

3. **Create OAuth Credentials**
   - Go to "Credentials"
   - Click "Create Credentials" → OAuth 2.0 Client IDs
   - Select "Web application"
   - Add authorized JavaScript origins: `http://localhost:3000`
   - Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

4. **Copy Credentials**
   - Copy `Client ID` → `NEXTAUTH_GOOGLE_ID`
   - Copy `Client Secret` → `NEXTAUTH_GOOGLE_SECRET`

## 🚀 Production Deployment

### Deploy to Vercel

#### 1. Prepare Code

```bash
# Ensure .gitignore is set up
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

#### 2. Set Up Vercel

- Go to https://vercel.com
- Click "Import Project"
- Select your GitHub repository
- Configure environment variables (same as .env.local)

#### 3. Configure Production Database

Choose one of:

**Option A: Vercel Postgres**
```bash
npm i @vercel/postgres
```
- In Vercel dashboard, add Postgres
- Copy connection string to DATABASE_URL

**Option B: Railway.app**
- Create PostgreSQL database
- Copy connection string
- Add to Vercel environment variables

**Option C: Render.com**
- Create PostgreSQL database
- Copy connection string
- Add to Vercel environment variables

#### 4. Deploy

```bash
# The database will already exist from setup
# Just run migrations on production
vercel env pull  # Get production env vars locally
npm run db:push   # Push schema to production DB
```

Then push to GitHub, and Vercel will auto-deploy.

## 📦 Project Installation Details

### What Gets Installed

```
Dependencies:
- next: Web framework
- react: UI library
- prisma: Database ORM
- zustand: State management
- next-auth: Authentication
- openai: AI APIs
- tailwindcss: Styling
- lucide-react: Icons

Dev Dependencies:
- typescript: Type safety
- eslint: Code quality
- @types/*: Type definitions
```

### Key npm Scripts

```json
{
  "dev": "next dev",                 // Start dev server
  "build": "next build",             // Build for production
  "start": "next start",             // Start production server
  "lint": "next lint",               // Run linter
  "db:generate": "prisma generate",  // Generate Prisma client
  "db:migrate": "prisma migrate dev", // Create migrations
  "db:push": "prisma db push"        // Update schema
}
```

## 🔧 Troubleshooting Installation

### Issue: npm: command not found
**Solution:** Node.js not installed. Download from https://nodejs.org/

### Issue: createdb: command not found
**Solution:** PostgreSQL not in PATH
- Windows: Remove/reinstall PostgreSQL and check "Add to PATH"
- Mac: Use `brew install postgresql`
- Linux: Use `apt install postgresql`

### Issue: DATABASE_URL not working
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# If failed, check:
# 1. PostgreSQL is running
# 2. Database exists: psql -l
# 3. Credentials are correct
```

### Issue: Prisma migration fails
```bash
# Reset database (WARNING: deletes data)
npm run db:push -- --force-reset

# Or start fresh
dropdb notetaking_app
createdb notetaking_app
npm run db:push
```

### Issue: Port 3000 in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### Issue: Voice not working (microphone)
- Check browser allows microphone access
- HTTPS required for production (Vercel handles this)
- Restart browser if permission already denied

## 📊 Verification Checklist

After installation, verify everything works:

```
✅ Database
  - [ ] npm run db:push completes without error
  - [ ] User table created
  
✅ Authentication
  - [ ] Can visit http://localhost:3000
  - [ ] Landing page loads
  - [ ] "Sign in" buttons visible
  
✅ Notes Feature
  - [ ] Create a note
  - [ ] Edit and autosave
  - [ ] Delete note
  
✅ Stacks Feature
  - [ ] Create stack with custom columns
  - [ ] Add row to stack
  - [ ] Edit and delete rows
  
✅ Voice Feature
  - [ ] Hold Spacebar (or click button)
  - [ ] Browser asks for microphone permission
  - [ ] Recording animation appears
  - [ ] Transcription processed (requires OPENAI_API_KEY)
```

## 🌐 Environment-Specific Setup

### Local Development
- NODE_ENV: development
- DATABASE_URL: local PostgreSQL
- NEXTAUTH_URL: http://localhost:3000

### Production (Vercel)
- NODE_ENV: production
- DATABASE_URL: Cloud PostgreSQL (Railway/Render/Vercel)
- NEXTAUTH_URL: https://your-domain.vercel.app

## 📖 Next Steps

1. **Customize Branding**
   - Update `app/(marketing)/page.tsx` landing page
   - Modify `public/` assets

2. **Extend Features**
   - Add more note templates
   - Implement custom stack validations
   - Create voice command presets

3. **Monitor Performance**
   - Use Vercel Analytics
   - Monitor database query times
   - Track API response times

## 🆘 Support Links

- **Next.js Issues**: https://github.com/vercel/next.js/issues
- **Prisma Support**: https://github.com/prisma/prisma/discussions
- **NextAuth Issues**: https://github.com/nextauthjs/next-auth/issues
- **OpenAI Help**: https://help.openai.com/

---

**Happy coding! 🚀**
