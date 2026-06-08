import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function adjustCursorPosition(content: string, pos: number): number {
  const regex = /<br\s*\/?>/gi;
  let match;
  // Track all <br /> positions to find the correct adjusted position.
  // We need to guard against positions that fall at or inside a <br /> tag,
  // because inserting there would split the tag and break formatting.
  let adjusted = pos;
  while ((match = regex.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Position at the start boundary (pos === start) is also dangerous —
    // inserting right before <br /> can break the tag structure. Push past it.
    if (pos >= start && pos < end) {
      adjusted = Math.max(adjusted, end);
    }
  }
  return adjusted;
}

/**
 * Apply smart padding around AI-suggested content to prevent it from
 * fusing with adjacent markdown tokens. Ensures the insertion sits on
 * clean word/line boundaries without breaking formatting.
 */
export function applySuggestionPadding(
  originalContent: string,
  insertionPos: number,
  suggestion: string
): { paddedSuggestion: string; adjustedPos: number } {
  let padded = suggestion;
  let pos = insertionPos;

  // ── Leading padding ──────────────────────────────────────────────
  // If we're not at position 0 and the character before the insertion
  // point is not whitespace or a newline, add a space to prevent fusing.
  if (pos > 0) {
    const charBefore = originalContent[pos - 1];
    if (charBefore !== ' ' && charBefore !== '\n' && charBefore !== '\r') {
      // Only add leading space if the suggestion itself doesn't start with one
      if (padded.length > 0 && padded[0] !== ' ' && padded[0] !== '\n') {
        padded = ' ' + padded;
      }
    }
  }

  // ── Trailing padding ─────────────────────────────────────────────
  // If we're not at the end and the character after the insertion
  // point is not whitespace or a newline, add a space to prevent fusing.
  if (pos < originalContent.length) {
    const charAfter = originalContent[pos];
    if (charAfter !== ' ' && charAfter !== '\n' && charAfter !== '\r') {
      // Only add trailing space if the suggestion itself doesn't end with one
      if (padded.length > 0 && padded[padded.length - 1] !== ' ' && padded[padded.length - 1] !== '\n') {
        padded = padded + ' ';
      }
    }
  }

  return { paddedSuggestion: padded, adjustedPos: pos };
}
