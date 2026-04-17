# Installation & Setup Guide

Welcome to the **Markdown Notetaking App with Agentic AI Integration**! This guide will walk you through setting up the project locally and deploying it to production.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher): [Download from nodejs.org](https://nodejs.org/)
- **PostgreSQL** (v14 or higher): [Download from postgresql.org](https://www.postgresql.org/download/)
- **Git**: For version control

Verify installations:
```bash
node --version    # Should show v18+
npm --version     # Should show 8+
psql --version    # Should show 14+
```

## 🚀 Quick Local Setup (5-10 minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd Markdown-Notetaking-App-with-Agentic-AI-integration

# Install dependencies
npm install
```

### 2. Database Setup

Choose one of the following database options:

#### Option A: Local PostgreSQL
```bash
# Create a local database
createdb notetaking_app
```

#### Option B: Neon (Recommended for Development)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```env
# Database Connection
# For local PostgreSQL:
DATABASE_URL="postgresql://localhost/notetaking_app"
# For Neon:
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-hex-32"

# OAuth Providers (optional for basic functionality)
NEXTAUTH_GITHUB_ID="your-github-oauth-app-id"
NEXTAUTH_GITHUB_SECRET="your-github-oauth-app-secret"

NEXTAUTH_GOOGLE_ID="your-google-oauth-client-id"
NEXTAUTH_GOOGLE_SECRET="your-google-oauth-client-secret"

# OpenAI API (required for AI features)
OPENAI_API_KEY="sk-your-openai-api-key"
```

### 4. Database Migration

```bash
# Push the schema to your database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 5. Start the Application

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

🎉 **You're all set!** The app should now be running locally.

## 🔐 OAuth Setup (Optional)

For full authentication features, set up OAuth providers:

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Markdown Notetaking App
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret to your `.env.local`

### Google OAuth

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to Credentials → Create OAuth 2.0 Client IDs
5. Set authorized origins: `http://localhost:3000`
6. Set redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret to your `.env.local`

## 🚀 Production Deployment

### Deploy to Vercel

1. **Prepare Your Code**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Import Project" and select your GitHub repo
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add all variables from your `.env.local`
   - For production database, use a hosted PostgreSQL service

4. **Database for Production**
   Choose from:
   - **Neon**: Free tier available, easy setup
   - **Railway**: Simple deployment
   - **Render**: Good for PostgreSQL hosting
   - **Vercel Postgres**: Integrated with Vercel

   Update your `DATABASE_URL` in Vercel environment variables.

5. **Deploy**
   ```bash
   # Push to GitHub - Vercel will auto-deploy
   git push origin main
   ```

### Alternative: Deploy to Other Platforms

- **Railway**: Connect GitHub repo, auto-deploys
- **Render**: Manual setup, good for full-stack apps
- **Netlify**: For static sites, but may need serverless functions

## 🛠️ Troubleshooting

### Common Issues

**"Environment variable not found: DATABASE_URL"**
- Ensure `.env.local` exists in the root directory
- For Prisma CLI, you may need a `.env` file instead of `.env.local`
- Copy `.env.local` to `.env` in the root

**"Cannot find module '@auth/prisma-adapter'"**
- For NextAuth v5, use: `import { PrismaAdapter } from "next-auth/adapters"`
- Remove `@auth/prisma-adapter` from package.json if installed

**Database Connection Issues**
- Verify PostgreSQL is running: `pg_isready`
- Check connection string format
- For Neon, ensure SSL parameters are included

**Build Errors**
- Run `npm run build` locally to debug
- Check for missing environment variables
- Ensure all dependencies are installed

### Useful Commands

```bash
# Reset database
npx prisma db push --force-reset

# View database
npx prisma studio

# Generate types
npx prisma generate

# Lint code
npm run lint
```

## 📦 Project Structure

```
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── (marketing)/    # Marketing pages
│   └── (workspace)/    # Main app pages
├── components/         # React components
├── lib/                # Utilities and configurations
├── prisma/             # Database schema
└── types/              # TypeScript definitions
```

## 🔧 Development Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run db:push`: Update database schema
- `npm run db:studio`: Open Prisma Studio

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [OpenAI API Documentation](https://platform.openai.com/docs)

If you encounter issues not covered here, please check the project's GitHub issues or create a new one.
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
