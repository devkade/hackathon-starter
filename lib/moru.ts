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
 * Create a sandbox with the agent template
 */
export async function createSandbox(
  volumeId: string,
  conversationId: string,
  sessionId?: string
): Promise<{ sandbox: Sandbox; commandHandle: CommandHandle }> {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const sandbox = await Sandbox.create(TEMPLATE_NAME, {
    volumeId,
    volumeMountPath: "/workspace/data",
    envs: {
      ANTHROPIC_API_KEY: anthropicApiKey,
      CALLBACK_URL: `${baseUrl}/api/conversations/${conversationId}/status`,
      RESUME_SESSION_ID: sessionId || "",
    },
    timeoutMs: 30 * 60 * 1000, // 30 minutes
  });

  // Start the agent process - it will read from stdin
  const commandHandle = await sandbox.commands.run("node /app/agent.js", {
    background: true,
    stdin: true,
    cwd: "/workspace",
  });

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
 */
export async function readVolumeFile(
  volumeId: string,
  path: string
): Promise<string> {
  const volume = await Volume.get(volumeId);
  const buffer = await volume.download(path);
  return buffer.toString("utf-8");
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
