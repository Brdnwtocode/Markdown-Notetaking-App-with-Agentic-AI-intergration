# Markdown Notetaking App with AI Voice Integration

A modern, full-stack web application for intelligent note-taking and structured data management with multimodal AI integration.

## 🎯 Vision

A personal knowledge workspace that combines:
- **Smart Notes**: Markdown editor with live preview
- **Dynamic Tables**: Flexible schema-based data management
- **Voice Control**: AI-powered voice commands in Vietnamese/English
- **Real-time Sync**: Instant autosave and updates

## ✨ Key Features

### Phase 1: Foundation & Notes ✅
- User authentication (GitHub + Google OAuth)
- Markdown note editor with split-pane view
- Live markdown preview with syntax highlighting
- Autosave with 1000ms debounce
- Note CRUD operations

### Phase 2: Stacks (Dynamic Tables) ✅
- Create custom database schemas with typed columns
- Support for TEXT, INT, FLOAT, BOOLEAN data types
- Row-level CRUD operations
- Real-time SUM/AVG aggregates for numeric columns
- Interactive schema builder UI

### Phase 3: AI Voice Pipeline ✅
- **Audio Recording**: Hold spacebar or click to record voice commands
- **STT**: OpenAI Whisper API (Vietnamese + English)
- **NLU**: GPT-4o with function calling
- **Intent Execution**: Automatic tool calling to update notes/stacks
- **Latency Target**: ≤ 3.5s roundtrip (< 1s Whisper, < 2s GPT-4o)

### Phase 4: Advanced Features ✅
- **Export**: Download notes as Markdown, stacks as CSV
- **Dynamic Layout**: Toggle between single and side-by-side views
- **Canvas**: Simple drawing tool for diagrams

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router, TypeScript) |
| **Styling** | Tailwind CSS + Shadcn/UI |
| **State** | Zustand (lightweight, synchronous) |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | NextAuth.js v5 (OAuth) |
| **AI/ML** | OpenAI APIs (Whisper + GPT-4o) |
| **Icons** | Lucide React |
| **Notifications** | React Hot Toast |

### Database Schema

```prisma
User
├── Note[]
└── Stack[]
    ├── StackColumn[]
    └── StackRow[] (JSON data)
```

### Voice AI Pipeline

```
User Voice Input
    ↓
MediaRecorder API (WebM)
    ↓
OpenAI Whisper API (Transcription)
    ↓
GPT-4o (Intent Recognition with Tool Calling)
    ↓
Tool Execution (update_note or add_stack_row)
    ↓
Prisma DB Update
    ↓
Client UI Update (< 3.5s total)
```

## 📋 API Contract

### Notes Endpoints
- `GET /api/notes` - List all notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PUT /api/notes/:id` - Update note (autosave)
- `DELETE /api/notes/:id` - Delete note

### Stacks Endpoints
- `GET /api/stacks` - List all stacks
- `POST /api/stacks` - Create stack with schema
- `GET /api/stacks/:id` - Get stack with data
- `POST /api/stacks/:id/rows` - Add row
- `PUT /api/stacks/:id/rows/:rowId` - Update row
- `DELETE /api/stacks/:id/rows/:rowId` - Delete row

### Voice AI Endpoint
- `POST /api/voice/process` - Process audio and return action

**Request Format:**
```javascript
FormData {
  audio: Blob,           // WebM audio file
  contextType: "NOTE" | "STACK",
  contextId: String,
  cursorPosition?: Number
}
```

**Response Format:**
```javascript
{
  transcript: String,
  action: "update_note" | "add_stack_row" | "none",
  updatedData: Object,
  success: Boolean
}
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### Installation

1. **Install Node.js**
   - Download from https://nodejs.org/
   - Verify: `node --version && npm --version`

2. **Set up PostgreSQL**
   ```bash
   createdb notetaking_app
   ```

3. **Install project dependencies**
   ```bash
   npm install
   ```

4. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/notetaking_app"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -hex 32)"

# OAuth - GitHub
NEXTAUTH_GITHUB_ID="your-github-oauth-id"
NEXTAUTH_GITHUB_SECRET="your-github-oauth-secret"

# OAuth - Google
NEXTAUTH_GOOGLE_ID="your-google-oauth-id"
NEXTAUTH_GOOGLE_SECRET="your-google-oauth-secret"

# OpenAI
OPENAI_API_KEY="sk-..."
```

### Development Server

1. **Push database schema**
   ```bash
   npm run db:push
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Open browser**
   - Navigate to http://localhost:3000

## 📁 Project Structure

```
.
├── app/
│   ├── (marketing)/              # Landing page (public)
│   ├── (workspace)/              # Main app (authenticated)
│   │   ├── notes/[id]/
│   │   ├── stacks/[id]/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── notes/
│   │   ├── stacks/
│   │   ├── voice/process/
│   │   └── auth/
│   ├── auth.ts                   # NextAuth configuration
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # Shadcn/UI components
│   ├── workspace/
│   │   ├── Sidebar.tsx
│   │   ├── SplitEditor.tsx
│   │   ├── StackTable.tsx
│   │   ├── StackAggregates.tsx
│   │   ├── SchemaBuilder.tsx
│   │   ├── DynamicLayout.tsx
│   │   └── Canvas.tsx
│   └── shared/
│       └── PushToTalk.tsx
├── lib/
│   ├── prisma.ts                 # Prisma client
│   ├── store.ts                  # Zustand store
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
├── .env.local.example
├── package.json
└── SETUP.md
```

## 🎤 Voice Commands Examples

### Note Commands
```
"Append a new section about project goals"
→ Appends text to end of note

"Insert a reminder at cursor"
→ Inserts text at cursor position

"Replace with new content"
→ Replaces entire note content
```

### Stack Commands
```
Given Stack: "Inventory" with columns: Product (TEXT), Quantity (INT), Price (FLOAT)

"Add iPhone with quantity 50 and price 999.99"
→ Creates new row: {Product: "iPhone", Quantity: 50, Price: 999.99}
```

## ⚙️ Configuration

### Database Migrations

```bash
# Create new migration
npm run db:migrate -- --name migration_name

# Push schema (development)
npm run db:push

# Generate Prisma client
npm run db:generate
```

### OAuth Setup

**GitHub:**
1. Go to https://github.com/settings/developers
2. Create New OAuth App
3. Set Authorization callback: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to .env.local

**Google:**
1. Go to https://console.cloud.google.com/
2. Create new project and enable Google+ API
3. Create OAuth 2.0 Web Application credentials
4. Add authorized redirect: `http://localhost:3000/api/auth/callback/google`

## 🧪 Testing

### Manual Testing Checklist

- [ ] Authentication flow (GitHub/Google)
- [ ] Create, edit, delete notes
- [ ] Create, edit, delete stacks with custom schemas
- [ ] Autosave functionality
- [ ] Voice recording and transcription
- [ ] Voice command execution (append/insert/replace)
- [ ] Stack row management
- [ ] Export to Markdown/CSV
- [ ] Split view toggle

## 🚢 Deployment

### Deploy to Vercel

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Visit https://vercel.com/import
   - Select GitHub repository
   - Configure environment variables
   - Deploy

3. **Set up Production Database**
   - Create PostgreSQL database on cloud provider (e.g., Vercel Postgres, Render, Railway)
   - Update `DATABASE_URL` in Vercel environment
   - Run migrations: `npm run db:push`

## 📊 Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Whisper STT | < 1.0s | ✅ |
| GPT-4o Processing | < 2.0s | ✅ |
| Note Autosave | 1.0s debounce | ✅ |
| Voice Roundtrip | ≤ 3.5s | ✅ |
| Initial Page Load | < 2.0s | ⚡ |

## 🔐 Security

- All routes protected with NextAuth session verification
- Database queries validate `userId` ownership
- CSRF protection via NextAuth
- API keys stored in environment variables
- TypeScript for compile-time type safety

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env.local`
- Confirm database exists: `psql -l`

### Microphone Permission Error
- Check browser permissions for microphone access
- Try refreshing the page
- Use HTTPS (required for microphone on production)

## 📚 Documentation

- [Next.js 14 Docs](https://nextjs.org/docs)
- [Prisma ORM Docs](https://www.prisma.io/docs/)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 📝 License

MIT License - See LICENSE file

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

**Built with ❤️ using Next.js, Prisma, and OpenAI APIs**

A web-based, all-in-one personal knowledge workspace. It targets tech-savvy users (students, young professionals) familiar with tools like Notion and Obsidian. Its core differentiator is deep, action-oriented AI integration across two knowledge formats: free-form Markdown notes and structured data tables.
