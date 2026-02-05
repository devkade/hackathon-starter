import { SessionEntry } from "./types";

/**
 * Parse Claude Code session JSONL file into session entries
 */
export function parseSessionJSONL(content: string): SessionEntry[] {
  const entries: SessionEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed);
      // Filter for user, assistant, and system messages
      if (
        entry.type === "user" ||
        entry.type === "assistant" ||
        entry.type === "system"
      ) {
        entries.push(entry as SessionEntry);
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return entries;
}

/**
 * Find the session JSONL file path from session ID
 */
export function getSessionFilePath(sessionId: string): string {
  // Claude Code stores sessions at ~/.claude/projects/-workspace/{sessionId}.jsonl
  // With our symlink: ~/.claude -> /workspace/data/.claude
  // So the file is at /workspace/data/.claude/projects/-workspace/{sessionId}.jsonl
  return `.claude/projects/-workspace/${sessionId}.jsonl`;
}
