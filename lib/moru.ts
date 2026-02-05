import Sandbox, { Volume, type CommandHandle } from "@moru-ai/core";

const TEMPLATE_NAME = "hackathon-ts-agent";

/**
 * Create a new volume for a conversation
 */
export async function createVolume(conversationId: string): Promise<string> {
  const volume = await Volume.create({ name: `hackathon-${conversationId}` });
  return volume.volumeId;
}

/**
 * Get an existing volume
 */
export async function getVolume(volumeId: string) {
  return Volume.get(volumeId);
}

/**
 * Create a sandbox with the agent template.
 *
 * The agent code is pre-installed in the template at /app/agent.mts
 * (similar to maru's Python agent pattern).
 *
 * Claude Code credentials are embedded in the template at ~/.claude/.credentials.json
 * (extracted from macOS Keychain during template build).
 */
export async function createSandbox(
  volumeId: string,
  conversationId: string,
  sessionId?: string
): Promise<{ sandbox: Sandbox; commandHandle: CommandHandle }> {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  // Note: ANTHROPIC_API_KEY not needed - template has embedded Claude Code credentials
  // const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  const sandbox = await Sandbox.create(TEMPLATE_NAME, {
    volumeId,
    volumeMountPath: "/workspace/data",
    timeoutMs: 30 * 60 * 1000, // 30 minutes
  });

  // Create symlink ~/.claude -> /workspace/data/.claude so session files persist to volume
  // This ensures Claude Code sessions are stored in the volume and can be read back
  // IMPORTANT: Copy credentials first before removing ~/.claude, then create symlink
  // NOTE: Use `cp -a /home/user/.claude/. dest/` to copy hidden files (glob * doesn't match .files)
  await sandbox.commands.run(
    "mkdir -p /workspace/data/.claude && " +
    "cp -a /home/user/.claude/. /workspace/data/.claude/ && " +
    "rm -rf /home/user/.claude && " +
    "ln -sf /workspace/data/.claude /home/user/.claude"
  );

  // Start the pre-installed agent - it reads from stdin (matching maru pattern)
  // Pass envs to commands.run() like maru does in agent-session.ts
  const commandHandle = await sandbox.commands.run(
    "cd /app && npx tsx agent.mts",
    {
      background: true,
      stdin: true,
      cwd: "/workspace/data",
      // Pass environment variables to the agent process (matching maru pattern)
      envs: {
        // Note: Using embedded Claude Code credentials instead of API key
        // ANTHROPIC_API_KEY: anthropicApiKey,
        WORKSPACE_DIR: "/workspace/data",
        CALLBACK_URL: `${baseUrl}/api/conversations/${conversationId}/status`,
        RESUME_SESSION_ID: sessionId || "",
      },
      // Match maru's 30-minute timeout for agent sessions
      timeoutMs: 30 * 60 * 1000,
      // Log agent output for debugging
      onStdout: (data: string) => {
        console.log(`[AGENT stdout] ${data}`);
      },
      onStderr: (data: string) => {
        console.error(`[AGENT stderr] ${data}`);
      },
    }
  );

  return { sandbox, commandHandle };
}

/**
 * Send a message to the sandbox agent via stdin
 */
export async function sendToAgent(
  sandbox: Sandbox,
  pid: number,
  message: Record<string, unknown>
) {
  await sandbox.commands.sendStdin(pid, JSON.stringify(message) + "\n");
}

export interface FileInfo {
  name: string;
  type: "file" | "directory";
  size?: number;
  path: string;
  children?: FileInfo[];
}

/**
 * List files in a volume directory
 */
export async function listVolumeFiles(
  volumeId: string,
  path: string
): Promise<FileInfo[]> {
  const volume = await Volume.get(volumeId);

  try {
    const files = await volume.listFiles(path);
    return files.map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      path: f.path,
    }));
  } catch {
    return [];
  }
}

/**
 * Build a recursive file tree from a volume
 */
export async function buildFileTree(
  volumeId: string,
  path: string = "/",
  maxDepth: number = 5
): Promise<FileInfo[]> {
  const volume = await Volume.get(volumeId);

  async function buildNode(
    currentPath: string,
    depth: number
  ): Promise<FileInfo[]> {
    if (depth > maxDepth) return [];

    try {
      const files = await volume.listFiles(currentPath);
      const result: FileInfo[] = [];

      for (const f of files) {
        const node: FileInfo = {
          name: f.name,
          type: f.type,
          size: f.size,
          path: f.path,
        };

        if (f.type === "directory") {
          node.children = await buildNode(f.path, depth + 1);
        }

        result.push(node);
      }

      // Sort: directories first, then alphabetically
      result.sort((a, b) => {
        if (a.type === "directory" && b.type !== "directory") return -1;
        if (a.type !== "directory" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch {
      return [];
    }
  }

  return buildNode(path, 0);
}

/**
 * Read a file from a volume
 * Note: Bypasses SDK's volume.download() due to 401 bug - calls API directly
 */
export async function readVolumeFile(
  volumeId: string,
  path: string
): Promise<string> {
  // Ensure path is absolute
  const absolutePath = path.startsWith("/") ? path : `/${path}`;

  // Bypass SDK bug: call API directly
  const apiKey = process.env.MORU_API_KEY;
  const response = await fetch(
    `https://api.moru.io/volumes/${volumeId}/files/download?path=${encodeURIComponent(absolutePath)}`,
    {
      headers: { "X-API-Key": apiKey || "" },
    }
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Kill a sandbox
 */
export async function killSandbox(sandboxId: string) {
  try {
    await Sandbox.kill(sandboxId);
  } catch {
    // Sandbox might already be dead
  }
}
