
# CAi5: Voice Command Chat UI - Pre-Implementation Plan

---

## Executive Summary
This document outlines the implementation plan for a new collapsible Chat UI sidebar that integrates with the existing Voice Command feature, providing a complete conversational interface to interact with AI features in the markdown notetaking app.

---

## 1. Requirements Clarification & Goals

### User Requirements
- **Collapsible Chat Interface**: Chat window/sidebar that appears when user makes a voice command or wants to chat with AI
- **Conversation Display**: Show user input (voice/typed), context sent (file, notes, stack, etc.), and AI replies with history
- **Visual Feedback**: Show loaders, processing indicators while AI works
- **Design System**: Minimal design matching current Notion-inspired aesthetic
- **Performance**: UI loads quickly, collapses smoothly
- **Integration**: Works seamlessly with existing PushToTalk component

### Project Goals
1. Enhance the Voice Command feature with a complete conversational UI
2. Provide full visibility of the AI interaction (what was said, what context was sent, AI's reply)
3. Add support for both voice and text-based interactions
4. Improve user experience with visual feedback during AI processing
5. Maintain consistency with existing design system

---

## 2. Project Structure Analysis

### Current Tech Stack
- **Framework**: Next.js 14 (App Router)
- **State Management**: Zustand (`lib/store.ts`, slices in `lib/slices/`)
- **UI Components**: shadcn/ui components (Button, Dialog, etc.) + custom Radix UI components
- **Styling**: Tailwind CSS
- **Voice/AI**: Deepgram STT, `/api/voice/process` endpoint
- **Existing UI**: AISidebar.tsx (simple), PushToTalk.tsx (button + transcript)

### Current Zustand Slices
- `aiSlice.ts`: Manages `aiReply`, `pendingAction`
- `voiceSlice.ts`: Manages `isRecording`, `recordingTranscript`, `sttStatus`
- `notesSlice.ts`, `stacksSlice.ts`, `tasksSlice.ts`, `calendarSlice.ts`: Manages content
- `uiSlice.ts`: Manages general UI state

---

## 3. Proposed Implementation Plan

### Phase 1: State Management (Zustand Slices)
- **Enhance `aiSlice.ts`**: Add chat message history, chat visibility state
- **Define Message Types**: Structured messages with type (user/ai), content, context, status (pending/processing/completed/error), timestamp

### Phase 2: Chat UI Components
- **Create `ChatSidebar.tsx`**: New collapsible sidebar replacing/upgrading AISidebar
  - Header with close button and status indicator
  - Message list area with history
  - Input area (text input + voice button)
  - Collapsible/expandable smooth transitions
- **Create Message Components**:
  - `UserMessage.tsx`: Shows user input and context sent
  - `AiMessage.tsx`: Shows AI reply with markdown support
  - `LoadingMessage.tsx`: Visual indicator while AI is working
- **Update/Replace `AISidebar.tsx`**: Migrate to new ChatSidebar
- **Update `PushToTalk.tsx`**: Integrate with new chat state

### Phase 3: Chat Functionality
- Connect chat input to existing `/api/voice/process` (or new dedicated chat endpoint)
- Handle both voice and text inputs
- Show context (file/notes/stack) sent with each request
- Display AI processing status in real-time

### Phase 4: UI/UX Polish
- Apply design system tokens from DESIGN.md
- Add smooth transitions and animations
- Test responsiveness
- Add keyboard shortcuts

---

## 4. Component Hierarchy

```
Workspace Layout
├── Sidebar
├── TabBar
├── Main Content
├── PushToTalk (updated)
└── ChatSidebar (new, replaces simple AISidebar)
    ├── Chat Header
    ├── Messages List
    │   ├── UserMessage
    │   ├── AiMessage
    │   └── LoadingMessage
    └── Chat Input Area
        ├── Text Input
        └── Voice Button
```

---

## 5. Data Models & Types

### New Types (Proposed)
```typescript
type MessageStatus = "pending" | "processing" | "completed" | "error";

type MessageContext = {
  type: "NOTE" | "STACK" | "TASK" | "CALENDAR";
  id: string;
  title?: string;
  preview?: string;
};

type ChatMessage = {
  id: string;
  type: "user" | "ai";
  content: string;
  context?: MessageContext;
  status: MessageStatus;
  timestamp: Date;
};
```

---

## 6. Open Questions & Decisions Needed

1. **Chat Persistence**: Should chat history persist between sessions?
2. **AI Endpoint**: Use existing `/api/voice/process` or create new `/api/chat` endpoint for text interactions?
3. **Context Display**: How to visually display which context was sent with a message?
4. **Voice Integration**: Should voice recording happen directly in chat sidebar or keep existing PushToTalk button?
5. **Positioning**: Keep chat on right sidebar (like current AISidebar) or different placement?
6. **Collapse Behavior**: Collapse to a small button or hide completely?
7. **Markdown Rendering**: Continue using `react-markdown` for AI replies?

---

## 7. Next Steps

1. [ ] Confirm decisions on open questions
2. [ ] Finalize design mockups/sketches
3. [ ] Implement Phase 1 (State Management)
4. [ ] Implement Phase 2 (UI Components)
5. [ ] Implement Phase 3 (Functionality)
6. [ ] Implement Phase 4 (Polish)
7. [ ] Test & Iterate

