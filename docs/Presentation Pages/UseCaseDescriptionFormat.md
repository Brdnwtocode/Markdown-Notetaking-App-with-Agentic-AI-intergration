Use Case Name
Login with Google
Short description
Allow users to authenticate and access the system securely using their existing Google accounts (OAuth).
Actor
Registered User, Guest
Pre-condition
Actor must have a valid Google Account.
Basic Flow
1. Actor navigates to the Login Page.
2. Actor clicks "Continue with Google".
3. System redirects Actor to the Google OAuth authentication screen.
4. Actor selects their Google account and grants permission.
5. System validates the token and redirects Actor to the Dashboard.
Alternative Flow
5a. If it is the Actor’s first time logging in via Google, the system automatically creates a new profile before redirecting to the Dashboard.
Exception Flow
E1: Actor cancels the Google login process. System redirects back to the Login Page.
E2: Google Service is unreachable. The system displays errors and prompts Actor to try again later.



Core Workspace and Unstructured Data Management (Notes), covering fundamental operations like viewing the workspace, creating, editing (with Live Preview and Raw Markdown Toggle), deleting, searching, and exporting Markdown documents. Details will be shown in Table 8, 9, 10, 11, 12, 21, 22.
Example description : Table 9: use case Create Note
Use Case Name
Create Note
Short description
Allow users to instantiate a new unstructured Markdown document.
Actor
Authenticated User
Pre-condition
Actor is within the Workspace environment.
Basic Flow
1. Actor clicks the "New Note" icon in the Explorer Sidebar or Ribbon.
2. System generates a new Markdown file with a default title (e.g., "Untitled").
3. System adds the new note to the Explorer list.
4. System automatically opens the note in a new tab and focuses the editor.
Alternative Flow
1a. Actor uses a keyboard shortcut (e.g., Cmd/Ctrl + N) to trigger creation.
1b. Actor uses a Voice Command (e.g., “Create a new Note for my Morning Meeting” ) to get a create Note suggestion. 
Exception Flow
E1: Database sync error. System displays a notification "Failed to create note, please try again."

E2: Voice Command fail to create note, system prompt user to try again later. 


---

Core Workspace and Explorer Management, covering hierarchical file tree operations, drag-and-drop structural reorganization, real-time query filtering, and sorting.
Use Case Name
Manage Explorer
Short description
Allow users to create, rename, delete, nest, drag-and-drop, filter, and sort notes, stacks, and folders in a hierarchical directory tree structure.
Actor
Authenticated User
Pre-condition
Actor is within the Workspace environment and has the Sidebar Explorer visible.
Basic Flow
1. Actor clicks the "New Folder" icon in the Sidebar Explorer.
2. System prompts Actor to name the new folder, then creates and displays the empty folder at the root of the tree explorer.
3. Actor drags an existing Note or Stack node and drops it inside the new folder.
4. System updates the item parent ID, persists the updated tree hierarchy in the PostgreSQL database, and renders the updated child nodes nested under the folder.
5. Actor inputs a text query in the search/filter input field at the top of the Sidebar Explorer.
6. System filters visible files and folders matching the query in real-time.
Alternative Flow
1a. Rename Item: Actor double-clicks a folder/note/stack name or clicks "Rename" from the context menu, inputs a new name, and the system saves and updates the display.
1b. Delete Item: Actor clicks the "Delete" trash icon or context menu item on a folder/note/stack, and the system permanently removes the item (performing cascading deletions for folders containing other notes/stacks).
1c. Sort Tree: Actor clicks the sorting menu dropdown in the explorer sidebar and selects a sorting criterion (e.g., A-Z, Z-A, Date Created, File Type); the system reorders the tree nodes accordingly.
Exception Flow
E1: Database write error during drag-and-drop or creation. System reverts the item position or deletion, and displays a warning notification: "Explorer structure sync failed."
E2: Cyclic Folder Nesting. Actor attempts to drag a parent folder into one of its child folders. System blocks the action and alerts the user: "Cannot move a folder into its own subdirectory."


---

Audio Capture and Playback (Records Workstation), covering persistent background recording, playback control configuration, and live speech transcription pipelines.
Use Case Name
Manage Audio Records
Short description
Allow users to navigate the records panel, record background audio (surviving tab switches) with live Speech-to-Text streaming, and control playback speed, volume, and timeline scrubbing.
Actor
Authenticated User
Pre-condition
Actor has navigated to the `/workspace/records` workstation route and granted microphone permissions.
Basic Flow
1. Actor clicks the "Record" button.
2. System starts the microphone stream, begins recording audio, and initializes a visual waveform canvas updating at 60fps.
3. System streams Speech-to-Text (STT) over WebSockets, displaying a live transcript that auto-scrolls in the viewport as the Actor speaks.
4. Actor clicks "Stop".
5. System stops capturing audio, processes the final transcript block, and displays a temporary playback player with timeline controls.
6. Actor inputs a title and clicks "Save".
7. System uploads the raw audio binary file (.webm) to S3-compatible cloud storage, records metadata and transcript to PostgreSQL, and refreshes the saved records list.
Alternative Flow
1a. Background Recording: Actor switches workspace tabs (e.g., opens a Note or a Stack table) while recording is active; the background recorder continues recording and streaming transcripts uninterrupted.
5a. Playback Controls: Actor selects a saved record from the workstation list, clicks "Play", adjusts the playback speed (1x, 1.5x, 2x) or volume slider, or scrubs the timeline; the system coordinates the audio player and updates current playback time.
Exception Flow
E1: Microphone access denied. System cancels the recording request and displays a prompt: "Microphone permission is required to record."
E2: S3 upload failure. System saves the text metadata and transcript in PostgreSQL, but displays a notification: "Transcript saved, but audio file upload failed."


---

Agentic AI Orchestration and Automation, covering persistent audio uploads, parallel extractor LangGraph pipelines, and human-in-the-loop validation gates.
Use Case Name
Agentic Automate
Short description
Allow users to persist audio to S3, run individual or parallel AI extractions (summarize transcripts, extract tasks, map columns to stacks, diarize speakers, suggest calendar events), and review bundled mutations using a human-in-the-loop confirmation gate.
Actor
Authenticated User
Pre-condition
Actor is viewing a saved recording with a valid transcript in the Records workstation.
Basic Flow
1. Actor selects an AI automation task (e.g., "Full Automate") from the right-side Agentic Automate sidebar panel.
2. System packages the active transcript, speaker metadata, and audio stream, sending it as a multipart request to the FastAPI AI microservice.
3. FastAPI microservice executes the LangGraph StateGraph pipeline: parses raw text, routes tasks through safety checks, runs parallel extractors, and reflections the output.
4. FastAPI returns a structured JSON execution payload containing proposed mutations (e.g., a drafted Markdown summary note, extracted tasks, calendar events).
5. Next.js BFF and Zustand staging system intercepts the payload, visualizes the suggestion diffs, and displays a floating confirmation toast.
6. Actor clicks "Accept" on the confirmation gate.
7. System executes the staged mutations, writing the records to PostgreSQL, and transitions the workspace to focus on the newly created database elements.
Alternative Flow
1a. Individual AI Tool Extraction: Actor clicks a specific task button (e.g., "Extract Tasks", "Summarize to Note", "Populate Stack") instead of "Full Automate". System runs only the targeted node, proposing a single mutation type for confirmation.
6a. Discard Suggestions: Actor reviews the proposed mutations and clicks "Discard" on the toast. System clears the Zustand staging buffer and restores original UI layout states without mutating the database.
Exception Flow
E1: AI microservice down or network error. System terminates loading state and alerts: "Agentic Automate service is currently unreachable."
E2: Safety validation rejected. LangGraph Safety Gate detects a prompt injection attempt in the transcript. System aborts processing, blocks execution, and notifies: "Command blocked due to security validation failure."
