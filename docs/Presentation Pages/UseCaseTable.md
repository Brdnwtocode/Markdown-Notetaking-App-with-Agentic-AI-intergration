# Use Case Table

This table lists the functional use cases of the **Lock In** personal knowledge workspace. It highlights both client-side editor functions and background agentic AI/audio pipelines, mapping out the features implemented in the system codebase.

| No. | Function Name | Description |
| :--- | :--- | :--- |
| **1** | View Workspace | Allow users to access the main application shell, view the dual-sidebar (icon ribbon and explorer), and see their active tabs. |
| **2** | Create Note | Allow users to instantiate a new unstructured Markdown document. |
| **3** | Edit Note | Allow users to modify note content using a "Live Preview" editor (WYSIWYG formatting that reveals Markdown syntax upon focus). |
| **4** | Delete Note | Allow users to permanently remove a note from their workspace. |
| **5** | Search Workspace | Allow users to find specific notes or stacks using title-based search functionality. |
| **6** | Create Stack | Allow users to create a new structured database table by defining a custom schema (column names and data types such as Text, Int, Boolean, Date, Select). |
| **7** | View Stack | Allow users to view their structured data in a grid layout. |
| **8** | Manage Stack | Allow users to manually add, edit, or delete specific rows or columns of data within a Stack table. |
| **9** | Delete Stack | Allow users to permanently remove a Stack and its associated schema/data. |
| **10** | Voice Command | Allow users to initiate the AI voice assistant via a UI button or keyboard shortcut (Ctrl+Space) to dictate natural language commands. |
| **11** | Confirm/Discard Note Update | Allow users to review an AI-proposed note modification (visualized as a red/green inline text diff) and explicitly accept or discard the change before the database is mutated. |
| **12** | Confirm/Discard Stack Row | Allow users to review an AI-proposed row addition (visualized as a highlighted "ghost row" in the table) and explicitly accept or discard the data. |
| **13** | View Conversational AI Reply | Allow users to read natural-language responses from the AI (bypassing the confirmation gate) via a persistent sliding side-panel. |
| **14** | Toggle Raw Markdown View | Allow users to switch the editor from "Live Preview" mode to a pure raw Markdown text view via a workspace dropdown menu. |
| **15** | Export Note | Allow users to download their unstructured note content locally as a .md or .txt file. |
| **16** | Export Stack | Allow users to download their structured table data locally as a .csv file. |
| **17** | Log Out | Allow users to securely terminate their session and return to the landing page. |
| **18** | Manage Explorer | Allow users to create, rename, delete, nest, drag-and-drop, filter, and sort notes, stacks, and folders in a hierarchical directory tree structure. |
| **19** | Manage Audio Records | Allow users to navigate the records panel, record background audio (surviving tab switches) with live Speech-to-Text streaming, and control playback speed, volume, and timeline scrubbing. |
| **20** | Agentic Automate | Allow users to persist audio to S3, run individual or parallel AI extractions (summarize transcripts, extract tasks, map columns to stacks, diarize speakers, suggest calendar events), and review bundled mutations using a human-in-the-loop confirmation gate. |

