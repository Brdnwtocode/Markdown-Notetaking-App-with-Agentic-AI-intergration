// components/workspace/imageUploadPlugin.ts
//
// Milkdown $prose plugin that intercepts image paste/drop events and uploads
// the image directly to S3 via presigned URL, instead of inlining as base64.
//
// Flow:
//   1. User pastes/drops an image
//   2. Plugin inserts an image node with blob: URL (instant local preview)
//   3. POST to /api/notes/{noteId}/upload-url to get presigned PUT URL
//   4. PUT raw bytes to S3
//   5. On success: update node src → /api/images/{noteId}/{key}
//   6. On failure: set alt → "[upload failed]"
//
// PENDING DETECTION: Uses `src.startsWith("blob:")` as the pending marker
// (no custom ProseMirror attributes needed — works with standard Milkdown
// image schema which only has src, alt, title).
//
// SAVE PATH: The markdownUpdated listener in LiveEditor.tsx strips
// `![...](blob:...)` patterns before saving, so saves never block on
// in-flight uploads.

import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Node as ProsemirrorNode } from "prosemirror-model";

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Image upload helper ─────────────────────────────────────────────────────

interface UploadResult {
  success: boolean;
  key?: string;
  error?: string;
}

async function uploadImage(
  file: File,
  noteId: string,
): Promise<UploadResult> {
  const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[imageUpload:${uploadId}] ═══ UPLOAD START: "${file.name}" (${file.type}, ${(file.size / 1024).toFixed(1)}KB) ═══`);

  try {
    // ── Single-step backend-proxied upload ─────────────────────────
    // Sends the file to our own API, which uploads to S3 server-to-server.
    // Avoids CORS issues with direct browser→S3 PUT (S3 buckets typically
    // don't allow cross-origin PUT from localhost).
    console.log(`[imageUpload:${uploadId}] STEP 1: POST /api/notes/${noteId}/upload (multipart)`);

    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch(`/api/notes/${noteId}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    console.log(`[imageUpload:${uploadId}] RESPONSE: status=${res.status}, ok=${res.ok}`);

    if (!res.ok) {
      let errBody: any = {};
      try { errBody = await res.json(); } catch { /* not JSON */ }
      console.error(`[imageUpload:${uploadId}] ❌ UPLOAD FAILED:`, {
        status: res.status,
        statusText: res.statusText,
        error: errBody.error,
      });
      return { success: false, error: errBody.error || `Server error: ${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    const { key } = data;
    console.log(`[imageUpload:${uploadId}] ✅ UPLOAD SUCCESS: key="${key}"`);
    console.log(`[imageUpload:${uploadId}] ═══ DONE ═══`);

    return { success: true, key };
  } catch (err: any) {
    console.error(`[imageUpload:${uploadId}] ❌ UNHANDLED ERROR:`, {
      name: err?.name,
      message: err?.message,
    });
    return { success: false, error: err.message || "Upload failed" };
  }
}

// ─── Plugin helpers ──────────────────────────────────────────────────────────

/**
 * Find an image node in the document whose src matches a given blob URL.
 * Scans the entire doc — not position-dependent, so it survives doc mutations.
 * Blob URLs are unique per createObjectURL call, making this a reliable lookup.
 */
function findImageBySrc(
  view: EditorView,
  src: string,
): { pos: number; node: ProsemirrorNode } | null {
  const { doc } = view.state;
  let found: { pos: number; node: ProsemirrorNode } | null = null;

  doc.descendants((node, pos) => {
    if (found) return false; // stop early
    if (node.type.name === "image" && node.attrs.src === src) {
      found = { pos, node };
      return false;
    }
    return true;
  });

  return found;
}

/**
 * Find the DOM <img> element for an image node at the given position
 * and add/remove CSS classes for visual upload feedback.
 */
function updateImageDOMStatus(
  view: EditorView,
  pos: number,
  status: "uploading" | "success" | "error",
): void {
  try {
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    const img = dom?.querySelector?.("img") || (dom?.tagName === "IMG" ? dom : null);
    if (!img) return;

    img.classList.remove("lk-image-uploading", "lk-image-error", "lk-image-success");
    if (status === "uploading") {
      img.classList.add("lk-image-uploading");
    } else if (status === "error") {
      img.classList.add("lk-image-error");
    } else {
      img.classList.add("lk-image-success");
    }
  } catch {
    // DOM manipulation is best-effort; ProseMirror state is the source of truth
  }
}

/**
 * Check if any node type in the transfer matches an image MIME type.
 */
function containsImage(items: DataTransferItemList): boolean {
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) return true;
  }
  return false;
}

/**
 * Check if any file in the list is an image.
 */
function hasImageFile(files: FileList): boolean {
  for (let i = 0; i < files.length; i++) {
    if (files[i].type.startsWith("image/")) return true;
  }
  return false;
}

// ─── Milkdown Plugin ────────────────────────────────────────────────────────

export const imageUploadPluginKey = new PluginKey("imageUpload");

/**
 * Create the image upload plugin for a specific note.
 * Each note instance gets its own plugin so uploads know which noteId to target.
 */
export function createImageUploadPlugin(noteId: string) {
  console.log(`[imageUpload] Plugin created for noteId=${noteId}`);
  return $prose((_ctx) => {
    console.log(`[imageUpload] ProseMirror plugin factory invoked for noteId=${noteId}`);
    return new Plugin({
      key: imageUploadPluginKey,

      props: {
        // ── handlePaste ──────────────────────────────────────────────
        handlePaste(view: EditorView, event: ClipboardEvent): boolean {
          const { clipboardData } = event;
          if (!clipboardData || !containsImage(clipboardData.items)) {
            return false; // not an image paste → pass through to Milkdown default
          }

          console.log(`[imageUpload] handlePaste intercepted: ${clipboardData.items.length} items`);
          event.preventDefault();

          for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (!item.type.startsWith("image/")) continue;

            const file = item.getAsFile();
            if (!file) continue;

            handleImageFile(view, file, noteId);
          }

          return true;
        },

        // ── handleDrop ───────────────────────────────────────────────
        handleDrop(view: EditorView, event: DragEvent): boolean {
          const { dataTransfer } = event;
          if (!dataTransfer?.files || !hasImageFile(dataTransfer.files)) {
            return false; // not an image drop → pass through
          }
          console.log(`[imageUpload] handleDrop intercepted: ${dataTransfer.files.length} files`);          event.preventDefault();

          for (let i = 0; i < dataTransfer.files.length; i++) {
            const file = dataTransfer.files[i];
            if (!file.type.startsWith("image/")) continue;

            handleImageFile(view, file, noteId);
          }

          return true;
        },
      },
    });
  });
}

// ─── Core image handling logic ───────────────────────────────────────────────

function handleImageFile(
  view: EditorView,
  file: File,
  noteId: string,
): void {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    console.warn(
      `[imageUpload] File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`,
    );
    // Insert a placeholder text node to inform the user inline
    const { state } = view;
    const text = state.schema.text("[image too large — max 10MB]");
    const tr = state.tr.insert(state.selection.$head.pos, text);
    view.dispatch(tr);
    return;
  }

  const blobUrl = URL.createObjectURL(file);

  // Insert image node with blob URL as src (instant local preview).
  // Uses only standard Milkdown image attributes: src, alt, title.
  // The blob: prefix is the pending-state marker — no custom attrs needed.
  // alt shows upload status: filename → "Uploading..." → filename (or "[upload failed]")
  const { state } = view;
  const imageNode = state.schema.nodes.image.create({
    src: blobUrl,
    alt: `Uploading: ${file.name || "image"}`,
    title: "",
  });

  const tr = state.tr.insert(state.selection.$head.pos, imageNode);
  view.dispatch(tr);

  console.log(`[imageUpload] Pasted: ${file.name} (${(file.size / 1024).toFixed(1)}KB), noteId=${noteId}`);

  // Add visual "uploading" indicator to the DOM image element
  const insertedPos = state.selection.$head.pos;
  updateImageDOMStatus(view, insertedPos, "uploading");

  // Start the async upload — do not await, let it resolve independently
  uploadImage(file, noteId).then((result) => {
    // Guard: editor may have been destroyed if user switched views/navigated away
    try {
      // Quick check: accessing .state on a destroyed view throws
      void view.state;
    } catch {
      console.log(`[imageUpload] Editor destroyed before upload resolved: ${file.name}`);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Find the node by its unique blob URL (survives doc mutations)
    const found = findImageBySrc(view, blobUrl);
    if (!found) {
      // Node was removed/deleted before upload completed — clean up blob URL
      console.log(`[imageUpload] Node deleted before upload resolved: ${file.name}`);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const { pos } = found;

    if (result.success && result.key) {
      // Update src to the stable redirect path, set alt to filename
      const newAttrs = {
        src: `/api/images/${noteId}/${result.key}`,
        alt: file.name || "",
        title: "",
      };

      const updateTr = view.state.tr.setNodeMarkup(pos, null, newAttrs);
      view.dispatch(updateTr);
      console.log(`[imageUpload] Success: ${file.name} → /api/images/${noteId}/${result.key}`);

      // Apply success visual feedback, then clean up after a short delay
      updateImageDOMStatus(view, pos, "success");
      setTimeout(() => {
        try {
          const img = (view.nodeDOM(pos) as HTMLElement)?.querySelector?.("img");
          img?.classList.remove("lk-image-success");
        } catch { /* best-effort DOM cleanup */ }
      }, 3000);

      // Revoke the blob URL AFTER the DOM has switched to the new src.
      // requestAnimationFrame ensures the browser has processed the dispatch.
      requestAnimationFrame(() => {
        URL.revokeObjectURL(blobUrl);
      });
    } else {
      // Upload failed — mark image with error alt text showing the reason.
      // CRITICAL: Do NOT revoke the blob URL here — the image node still
      // references it as its src. Revoking would make the image disappear.
      const shortReason = result.error
        ? result.error.length > 80
          ? result.error.slice(0, 77) + "..."
          : result.error
        : "unknown error";
      console.error(`[imageUpload] Upload failed for ${file.name}: ${result.error}`);
      const newAttrs = {
        ...found.node.attrs,
        alt: `⚠ ${file.name} — ${shortReason}`,
      };

      const updateTr = view.state.tr.setNodeMarkup(pos, null, newAttrs);
      view.dispatch(updateTr);
      updateImageDOMStatus(view, pos, "error");
      // blobUrl intentionally NOT revoked — the failed image preview stays visible
    }
  }).catch((err) => {
    // Unexpected throw in uploadImage or the then() handler above.
    // Common cause: editor view was destroyed (user switched views/navigated away)
    // while the upload was in-flight.
    console.error("[imageUpload] Resolve error (editor likely destroyed):", err?.message);
    // Revoke the blob since the editor is gone — no one can see the preview anymore
    try { URL.revokeObjectURL(blobUrl); } catch { /* already revoked */ }
  });
}
