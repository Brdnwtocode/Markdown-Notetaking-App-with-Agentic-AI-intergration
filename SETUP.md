# Markdown Notetaking App - Setup Guide

## Phase 1: Foundation & Notes ✅ COMPLETE

This guide walks you through the setup and implementation of the Markdown Notetaking App.

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

### Environment Setup

1. **Install Node.js** (if not already installed)
   - Visit https://nodejs.org/ and download LTS version
   - Verify installation: `node --version` and `npm --version`

2. **Set up PostgreSQL Database**
   ```bash
   # Create a new database for the app
   createdb notetaking_app
   
   # Or use your favorite database client (pgAdmin, DBeaver, etc.)
   ```

3. **Clone/Open this project**
   ```bash
   cd "d:\SCHOOL\Year4\SEM2\KLTN\Markdown-Notetaking-App-with-Agentic-AI-intergration"
   ```

4. **Copy environment template**
   ```bash
   copy .env.local.example .env.local
   # Then edit .env.local with your actual values
   ```

5. **Install dependencies**
   ```bash
   npm install
   ```

### Configuration

#### 1. Database Configuration (.env.local)
```
DATABASE_URL="postgresql://username:password@localhost:5432/notetaking_app"
```

#### 2. NextAuth Setup

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -hex 32
# Or on Windows PowerShell:
# [Convert]::ToBase64String((1..32 | ForEach-Object { [byte]$_ })) | Cut the length to 64 chars
```

Add to `.env.local`:
```
NEXTAUTH_SECRET="your-generated-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

#### 3. OAuth Configuration

**GitHub OAuth:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret
5. Add to `.env.local`:
```
NEXTAUTH_GITHUB_ID="your-github-id"
NEXTAUTH_GITHUB_SECRET="your-github-secret"
```

**Google OAuth:**
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 Credentials (Web Application)
5. Add Authorized redirect URL: `http://localhost:3000/api/auth/callback/google`
6. Add to `.env.local`:
```
NEXTAUTH_GOOGLE_ID="your-google-id"
NEXTAUTH_GOOGLE_SECRET="your-google-secret"
```

#### 4. OpenAI API (For Phase 3)
```
OPENAI_API_KEY="sk-your-api-key-here"
```
Get from: https://platform.openai.com/api-keys

### Running the Application

1. **Run database migrations**
   ```bash
   npm run db:push
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Open in browser**
   - Navigate to http://localhost:3000
   - You should see the landing page

### Project Structure

```
.
├── app/
│   ├── (marketing)/          # Landing page (Guest)
│   ├── (workspace)/          # Main app (Authenticated)
│   │   ├── notes/[id]/       # Note editor page
│   │   ├── stacks/[id]/      # Stack table page
│   │   └── layout.tsx        # App shell with sidebar
│   ├── api/
│   │   ├── notes/            # Note CRUD endpoints
│   │   ├── stacks/           # Stack CRUD endpoints
│   │   └── auth/             # NextAuth routes
│   ├── auth.ts               # NextAuth configuration
│   └── layout.tsx            # Root layout
├── components/
│   ├── ui/                   # Shadcn/UI components
│   ├── workspace/            # App-specific components
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   ├── SplitEditor.tsx   # Markdown split-pane editor
│   │   └── StackTable.tsx    # Dynamic table component
│   └── shared/
│       └── PushToTalk.tsx    # Voice control button (stub)
├── lib/
│   ├── prisma.ts            # Prisma client
│   ├── store.ts             # Zustand state management
│   └── utils.ts             # Utility functions
├── prisma/
│   └── schema.prisma        # Database schema
├── public/                  # Static assets
└── package.json            # Dependencies
```

### Phase 1 Features Implemented

✅ **Authentication**
- NextAuth.js v5 with GitHub and Google OAuth
- Session management
- Protected routes

✅ **Notes CRUD**
- Create, read, update, delete notes
- GET /api/notes - List all notes
- POST /api/notes - Create new note
- GET /api/notes/:id - Get single note
- PUT /api/notes/:id - Update note
- DELETE /api/notes/:id - Delete note

✅ **UI Components**
- Markdown split-pane editor (SplitEditor.tsx)
- Live markdown preview with syntax highlighting
- Debounced autosave (1000ms)
- Responsive sidebar navigation

✅ **State Management**
- Zustand store for notes, stacks, and UI state
- Optimistic UI updates

### Troubleshooting

**Port 3000 already in use:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

**Database connection error:**
- Verify PostgreSQL is running
- Check DATABASE_URL in .env.local
- Verify database exists: `psql -l`

**NextAuth errors:**
- Ensure NEXTAUTH_SECRET is set
- Check OAuth credentials are correct
- Clear browser cookies and try again

### Next Steps

**Phase 2: Stacks**
- Implement column type system (TEXT, INT, FLOAT, BOOLEAN)
- Add frontend schema definition UI
- Build row-level CRUD with validation
- Implement SUM/AVG aggregators

**Phase 3: AI Voice Pipeline**
- Implement MediaRecorder audio capture
- Integrate OpenAI Whisper API for STT
- Build GPT-4o intent recognition
- Create dynamic JSON schema generation

**Phase 4: Supplementary Features**
- Implement react-resizable-panels for layout
- Export functionality (Markdown, CSV)
- Canvas component with react-flow-renderer

---

For questions or issues, refer to the official documentation:
- [Next.js 14](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs/)
- [NextAuth.js](https://next-auth.js.org/)
- [Zustand](https://github.com/pmndrs/zustand)
