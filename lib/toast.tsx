"use client";

import originalToast from "react-hot-toast";
import { X } from "lucide-react";

/**
 * Custom toast renderer that adds a visible dismiss (X) button to every toast.
 * Uses react-hot-toast's `custom()` under the hood so the toast can be
 * dismissed either by clicking the X button or by clicking anywhere on the toast.
 */
function renderWithDismiss(
  message: string,
  type: "success" | "error",
  opts?: { duration?: number }
) {
  const accentColor = type === "success" ? "#10B981" : "#EF4444";

  return originalToast.custom(
    (t) => (
      <div
        role="alert"
        className={`${
          t.visible ? "animate-enter" : "animate-leave"
        } max-w-md w-full bg-[#131313] border border-[#27272A] rounded-sm shadow-lg pointer-events-auto flex items-center gap-3 p-3`}
        style={{ boxShadow: `0 0 12px ${accentColor}15` }}
      >
        {/* Colored left accent bar */}
        <div
          className="self-stretch w-0.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />

        {/* Message */}
        <div className="flex-1 text-sm text-zinc-200 leading-snug">{message}</div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            originalToast.dismiss(t.id);
          }}
          className="shrink-0 text-zinc-500 hover:text-white hover:bg-white/10 rounded-sm p-0.5 transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    ),
    { duration: opts?.duration ?? 6000 }
  );
}

/**
 * Drop-in replacement for `react-hot-toast` that renders every success/error
 * toast with a visible dismiss button and a 6-second timeout.
 *
 * Usage (identical to react-hot-toast):
 *   import { toast } from "@/lib/toast";
 *   toast.success("Note saved!");
 *   toast.error("Failed to save");
 *   toast("Plain message");           // still works
 *   toast.loading("Loading...");       // forwarded unchanged
 *
 * All other react-hot-toast methods (loading, dismiss, custom, promise, etc.)
 * are forwarded unchanged.
 */
export const toast = Object.assign(
  // Preserve the callable nature of react-hot-toast (e.g. toast("message"))
  (message: string) => originalToast(message),
  originalToast,
  {
    success: (message: string) => renderWithDismiss(message, "success"),
    error: (message: string) => renderWithDismiss(message, "error"),
    /**
     * Persistent success toast — stays visible until the user explicitly
     * dismisses it via the X button, Accept/Discard action, or click.
     * Use this for AI suggestions and mutations that require user review.
     */
    persistent: (message: string) =>
      renderWithDismiss(message, "success", { duration: Infinity }),
  }
);

export default toast;
