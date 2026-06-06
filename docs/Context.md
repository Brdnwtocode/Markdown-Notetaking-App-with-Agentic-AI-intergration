# Project Context: Markdown Notetaking App with Agentic AI Integration

## 1. Project Overview
This is a full-stack, Next.js-based markdown notetaking application with integrated agentic AI capabilities, real-time voice transcription, task management, calendar scheduling, and structured data stacking (Airtable-like tables). The app targets power users who need unified workspace tools with AI assistance for content creation, organization, and task management.

**Core Premise**: Combine traditional notetaking with agentic AI that can understand context, assist with task breakdown, calendar scheduling, and structured data management in a single workspace.

## 2. Technology Stack
| Category | Technology |
|----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, shadcn/ui components |
| Database ORM | Prisma |
| Database | PostgreSQL (via Prisma) |
| Authentication | NextAuth.js (supports OAuth + email verification) |
| State Management | Zustand (slices in `lib/slices/`, central store in `lib/store.ts`) |
| Voice Transcription | Deepgram (real-time STT via WebSocket) |
| AI Integration | Custom agentic AI module (AISidebar component, `aiSlice` state) |
| Validation | Prisma schema constraints, TypeScript type safety |

## 3. Database Schema (Prisma/PostgreSQL)
Defined in `prisma/schema.prisma`, with PostgreSQL as the provider. Key models and relationships:

### Enums
- `DataType`: TEXT, INT, FLOAT, BOOLEAN, DATE, SELECT (for stack column types)
- `TaskStatus`: TODO, IN_PROGRESS, DONE
- `TaskPriority`: LOW, MEDIUM, HIGH

### Core Models
1. **User**
   - Fields: `id` (UUID), `email` (unique), `emailVerified`, `name`, `image`
   - Relations: 1:N with Note, Stack, Task, CalendarEvent; 1:N with Account, Session
   - Indexes: None explicit, but all user-owned resources are cascaded on delete

2. **Note**
   - Fields: `id` (UUID), `title`, `content` (Text)
   - Relation: N:1 to User (cascade delete)
   - Dynamic routes: `app/(workspace)/notes/[id]/`, `workspace/notes/[id]/`

3. **Stack** (Airtable-like structured data tables)
   - Fields: `id` (UUID), `name`
   - Relations: 1:N with StackColumn, StackRow; N:1 to User (cascade delete)
   - Sub-models:
     - `StackColumn`: Defines column schema with `name` and optional `DataType`
     - `StackRow`: Stores row data as JSONB (`{ [columnId]: value }`)

4. **Task** (Hierarchical task management)
   - Fields: `id` (UUID), `title`, `description` (Text), `status`, `priority`, `assignee`, `dueDate`
   - Relations: Self-referential parent/children (1:N "TaskSubtasks"), N:1 to User (cascade delete)
   - Indexes: `[userId, parentId]`, `[userId, status]`, `[userId, dueDate]`

5. **CalendarEvent**
   - Fields: `id` (UUID), `title`, `notes` (Text), `startAt`, `endAt`, `allDay`, `color`
   - Relation: N:1 to User (cascade delete)
   - Indexes: `[userId, startAt]`, `[userId, endAt]`

6. **Auth Models** (NextAuth.js standard)
   - `Account`: OAuth provider accounts linked to User
   - `Session`: Active user sessions
   - `VerificationToken`: Email verification tokens

## 4. Project Directory Structure
```
├── app/                          # Next.js App Router routes
│   ├── (marketing)/              # Public landing pages (layout + page)
│   ├── (workspace)/              # Authenticated workspace routes (layout + page)
│   │   ├── workspace/            # Main workspace dashboard
│   │   │   ├── calendar/        # Calendar view page
│   │   │   ├── notes/[id]/      # Individual note editor
│   │   │   ├── stacks/[id]/     # Individual stack (table) view
│   │   │   └── tasks/           # Task list page
│   │   └── api/                 # Next.js API routes (REST endpoints)
│   │       ├── auth/[...nextauth]/  # NextAuth.js handler
│   │       ├── deepgram/token/   # Deepgram API token endpoint
│   │       ├── voice/process/    # Voice processing endpoint
│   │       ├── notes/           # Note CRUD API
│   │       ├── stacks/          # Stack CRUD API
│   │       ├── tasks/           # Task CRUD API
│   │       └── events/          # Calendar event CRUD API
│   ├── auth.ts                   # NextAuth configuration
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/                   # Reusable React components
│   ├── shared/                   # Cross-cutting components (PushToTalk for voice input)
│   ├── ui/                       # shadcn/ui base components (button, dialog, dropdown-menu, etc.)
│   └── workspace/                # Workspace-specific components
│       ├── AISidebar.tsx         # Agentic AI assistant sidebar
│       ├── Canvas.tsx            # Main workspace canvas
│       ├── LiveEditor.tsx        # Markdown live editor
│       ├── SchemaBuilder.tsx     # Stack (table) schema builder
│       ├── StackTable.tsx        # Stack data table renderer
│       ├── TaskDialog.tsx        # Task create/edit dialog
│       └── Sidebar.tsx           # Workspace navigation sidebar
├── lib/                          # Utility libraries and state
│   ├── api.ts                    # API client helpers
│   ├── prisma.ts                 # Prisma client singleton
│   ├── store.ts                  # Zustand central store (useWorkspaceStore)
│   ├── constants.ts              # App-wide constants
│   ├── voiceApi.ts               # Voice API helpers
│   ├── hooks/                    # Custom React hooks (useDeepgramSTT for real-time STT)
│   └── slices/                   # Zustand store slices
│       ├── aiSlice.ts            # AI assistant state
│       ├── calendarSlice.ts      # Calendar state
│       ├── notesSlice.ts         # Notes state
│       ├── stacksSlice.ts       # Stacks state
│       ├── tasksSlice.ts         # Tasks state
│       └── voiceSlice.ts         # Voice input state
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma             # Prisma schema (source of truth for DB)
│   └── migrations/               # SQL migration history
├── docs/                          # Project documentation (this file added here)
├── reports/                       # Progress and audit reports
├── public/                        # Static assets
│   └── worklets/                 # Audio worklets (pcm-processor.js for Deepgram)
├── scripts/                       # Utility scripts (health-check.js)
└── types/                         # TypeScript type extensions (next-auth.d.ts)
```

## 5. Key Features & Modules
### 5.1 Authentication
- NextAuth.js with OAuth provider support and email verification
- User sessions persisted in PostgreSQL via Prisma
- Protected workspace routes via Next.js middleware (implied by (workspace) route group)

### 5.2 Notes Module
- **Markdown Editor**: Uses Milkdown framework (v7.20.0) with React integration
  - Presets: `commonmark` (base markdown), `gfm` (GitHub Flavored Markdown)
  - Plugins: `history` (undo/redo), `listener` (editor events), `tooltip` (floating toolbar)
  - Custom tooltip menu with Bold, Italic, Strikethrough, Code, Link actions
  - Uses `diff` library to track content changes between edits
- **LiveEditor.tsx**: Client-side component with "use client" directive
  - Props: `noteId` (string), `content` (string)
  - Integrates with Zustand store via `useWorkspaceStore`
  - Uses `MilkdownProvider`, `Milkdown` component from `@milkdown/react`
- Individual note routes with dynamic `[id]` segments
- Note CRUD operations via `/api/notes` endpoints

### 5.3 Stacks Module (Structured Data)
- Airtable-like tables with customizable columns (DataType enum)
- Schema builder (`SchemaBuilder.tsx`) to define column types
- Row data stored as JSONB in `StackRow` for flexible schema
- Aggregate views via `StackAggregates.tsx`

### 5.4 Tasks Module
- Hierarchical tasks (parent/child subtasks)
- Status and priority tracking with enum constraints
- Due date, assignee, and description support
- Task dialog for create/edit operations

### 5.5 Calendar Module
- Event scheduling with start/end times, all-day toggle, and color coding
- Calendar view page in workspace
- Event CRUD via `/api/events` endpoints

### 5.6 Voice Integration
- Real-time speech-to-text via Deepgram WebSocket API
- `PushToTalk.tsx` component for voice input
- `useDeepgramSTT.ts` hook managing WebSocket connection and audio processing
- Deepgram token generation endpoint for secure API access

### 5.7 Agentic AI Integration
- `AISidebar.tsx` provides a dedicated AI assistant panel (client-side component with "use client" directive)
- AI sidebar is a fixed overlay (w-80 md:w-96) on the right side, slides in when `aiReply` state is set
- Uses `ReactMarkdown` to render AI responses with prose styling
- `aiSlice.ts` manages AI state including `aiReply` (string | null) and `setAiReply` action
- AI can interact with notes, tasks, stacks, and calendar via API integrations (implied by agentic design)
- Trigger mechanism: AI reply state is set elsewhere in the app (e.g., voice processing, API responses)

## 6. Existing Documentation & Reports
Located in `docs/` and `reports/`:
- `AI_MICROSERVICE_CONTRACT.md`: Contract for AI microservice integration
- `Contract_Tasks & Calendar.md`: Task and calendar module contracts
- `Implementation Contracts/`: Deepgram STT, Tasks-Calendar implementation details
- Progress reports: Auth, UI theming, voice, React integration, validation, security audit
- `DESIGN.md`, `SETUP.md`, `INSTALLATION.md`: High-level design and setup guides

## 7. State Management Architecture (Zustand)
The app uses **Zustand** (not Redux Toolkit) for state management, with a modular slice pattern:
- `lib/store.ts` creates a combined `useWorkspaceStore` using Zustand's `create` function
- Each slice (`notesSlice`, `stacksSlice`, `voiceSlice`, `uiSlice`, `aiSlice`, `tasksSlice`, `calendarSlice`) is a factory function that returns its portion of the store
- The `RootStore` type is an intersection of all slice types
- Store also re-exports TypeScript types from each slice for use throughout the app
- Key store types: `Note`, `Stack`, `StackColumn`, `StackRow`, `OpenTab`, `TabType`, `SyncState`, `PendingAction`, `Task`, `TaskStatus`, `TaskPriority`, `CalendarEvent`

## 8. API Patterns & Conventions
All API routes follow Next.js App Router conventions and use NextAuth.js session validation:

### Authentication Pattern (consistent across all API routes)
```typescript
const session = await auth(); // from "@/app/auth"
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
// Use session.user.id for user-scoped queries
```

### Notes API (`/api/notes`)
- `GET`: Returns all notes for authenticated user (selects id, userId, title, createdAt, updatedAt), ordered by `updatedAt: "desc"`
- `POST`: Creates new note with required `title` (string validation), initializes `content: ""`
- Individual note operations at `/api/notes/[id]` (implied CRUD)

### General API Characteristics
- All user-scoped endpoints filter by `userId: session.user.id`
- Prisma client imported from `@/lib/prisma` (singleton pattern)
- JSON request/response format with appropriate HTTP status codes
- TypeScript with `NextRequest`/`NextResponse` from `next/server`

## 9. Authentication Flow
- Configured in `app/auth.ts` using NextAuth.js
- Session provider wraps entire app in root `layout.tsx` via `<SessionProvider>`
- Database session storage via Prisma adapter (implied by Account/Session models in schema)
- OAuth providers and email verification supported (User model has `emailVerified` field)
- Custom `next-auth.d.ts` in `types/` extends NextAuth types for TypeScript support

## 10. Voice Processing Pipeline
1. **User Action**: `PushToTalk.tsx` component triggers voice recording
2. **Audio Capture**: Browser audio API captures microphone input
3. **Processing**: `pcm-processor.js` worklet processes raw PCM audio
4. **WebSocket Connection**: `useDeepgramSTT.ts` hook manages Deepgram WebSocket connection
5. **Real-time STT**: Audio streamed to Deepgram, transcription returned in real-time
6. **Token Security**: `/api/deepgram/token` endpoint generates secure Deepgram API tokens
7. **Voice API**: `lib/voiceApi.ts` provides helper functions for voice processing
8. **State Management**: `voiceSlice.ts` tracks voice input state in Zustand store

## 11. Workspace Layout & Navigation
- `(workspace)` route group provides authenticated layout with sidebar navigation
- `Sidebar.tsx`: Main navigation component for workspace sections
- `TabBar.tsx`: Tab management for multiple open notes/stacks/tasks
- `DynamicLayout.tsx`: Handles dynamic layout rendering based on active tab
- `Canvas.tsx`: Main content area that renders based on selected tab type
- `WorkspaceUserSync.tsx`: Synchronizes workspace state with user session

## 12. Key Dependencies (from package.json)
### Core Framework & Runtime
- `next`: ^14.0.0 (App Router)
- `react`: ^18.2.0, `react-dom`: ^18.2.0
- `typescript`: (implied by tsconfig.json)

### Database & Auth
- `@prisma/client`: ^5.6.0, `prisma`: (dev dependency implied)
- `next-auth`: ^5.0.0-beta.31 (NextAuth.js v5 beta)
- `@auth/prisma-adapter`: ^2.11.2 (Prisma adapter for NextAuth)

### UI & Styling
- `tailwindcss`: (implied by tailwind.config.ts)
- Radix UI primitives: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-slot`
- `lucide-react`: ^0.294.0 (icons)
- `class-variance-authority`: ^0.7.0, `clsx`: ^2.0.0 (class merging utilities)
- `react-hot-toast`: ^2.4.0 (toast notifications)

### Markdown & Editor
- `@milkdown/*`: ^7.20.0 (Markdown editor framework - core, components, react, presets, plugins, theme-nord)
- `react-markdown`: (used in AISidebar for rendering)
- `prosemirror-state`, `prosemirror-view`: (ProseMirror dependencies for Milkdown)

### Voice & AI
- `@deepgram/sdk`: ^5.3.0 (Deepgram SDK for STT)
- `openai`: ^4.24.0 (OpenAI SDK for AI integration)

### Workspace Features
- `react-big-calendar`: ^1.13.0 (calendar component)
- `react-dnd`, `react-dnd-html5-backend`: ^16.0.1 (drag-and-drop for stacks/tasks)
- `date-fns`: ^3.6.0 (date utilities for calendar)
- `axios`: ^1.6.0 (HTTP client for API calls)

### Form Handling
- `react-hook-form`: ^7.48.0, `@hookform/resolvers`: ^3.3.0

### Utilities
- `diff`: ^9.0.0 (diffing utilities, possibly for note versioning)

## 13. Current State & Notes
- The development server (`npm run dev`) most recently exited with code 1, indicating a possible runtime error (unresolved at time of writing)
- All Prisma migrations are applied up to `20260514073500_add_tasks_and_calendar`
- The project uses route groups `(marketing)` and `(workspace)` to separate public and authenticated layouts
- Root layout (`app/layout.tsx`) uses NextAuth's `SessionProvider` and `react-hot-toast` for toasts
- The app uses `next/font/google` (Inter font) and enforces dark mode (`className="dark"` on html element)
- Audio processing for voice input uses a custom PCM processor worklet in `public/worklets/pcm-processor.js`
- All user-generated content is cascade-deleted when a user account is removed (enforced at DB level via Prisma relations)
- Calendar uses `react-big-calendar` CSS import in the root layout
- Next.js config (`next.config.js`): React strict mode enabled, SWC minification, experimental ESM externals

## 14. Summary for AI Consumption
This is a **Next.js 14+ App Router** application with:
- **Full-stack TypeScript** with Prisma/PostgreSQL backend
- **Zustand** state management with modular slices pattern
- **NextAuth.js v5 beta** for authentication with Prisma adapter
- **Milkdown** (ProseMirror-based) for markdown editing with GFM support
- **Deepgram** for real-time voice-to-text transcription
- **OpenAI SDK** for agentic AI integration (sidebar assistant)
- **React Big Calendar** for event scheduling
- **React DnD** for drag-and-drop interactions (stacks/tasks)
- **shadcn/ui + Radix UI** for accessible component primitives
- **Dark mode only** design with Tailwind CSS styling
- **Route groups** separating public `(marketing)` and authenticated `(workspace)` layouts
- **API routes** following consistent auth pattern with session validation
- **Cascade delete** on all user content at database level
- **Health check** script runs before dev server starts (`node scripts/health-check.js && next dev`)

**Key Architectural Decisions**:
1. Zustand over Redux for simpler state management
2. Milkdown over simpler editors for extensible markdown editing
3. Deepgram for low-latency voice transcription
4. JSONB in PostgreSQL for flexible stack row data
5. Hierarchical tasks with self-referential relationships
6. NextAuth.js v5 beta (bleeding edge at time of development)
