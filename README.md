# Hackathon Starter

Minimal Next.js fullstack app demonstrating Claude Agent SDK running in Moru sandboxes. Features a chat UI and workspace file explorer adapted from [maru.moru.io](https://maru.moru.io).

## Features

- **Chat Interface**: Send messages to Claude, view responses with tool use rendering
- **Workspace Panel**: File explorer with tree view, syntax-highlighted file viewer
- **Moru Integration**: Sandboxes with persistent volumes for file storage
- **Polling Updates**: 2-second polling for conversation status and file changes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │     Chat Panel       │  │     Workspace Panel          │ │
│  │  - Message display   │  │  - File explorer (tree)      │ │
│  │  - Prompt form       │  │  - File viewer (Shiki)       │ │
│  │  - Status indicator  │  │  - Download support          │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                       │
│  POST /api/conversations      - Create/continue conversation │
│  GET  /api/conversations/[id] - Get status & messages        │
│  POST /api/conversations/[id]/status - Agent callback        │
│  GET  /api/conversations/[id]/files  - List files (tree)     │
│  GET  /api/conversations/[id]/files/[...path] - Read file    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────┐         ┌──────────────────────────┐
│      PostgreSQL      │         │      Moru Sandbox        │
│  - Conversation      │         │  - Volume (persistent)   │
│  - Status tracking   │         │  - Agent process         │
│  - Session ID        │         │  - Claude Agent SDK      │
└──────────────────────┘         └──────────────────────────┘
```

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Moru API key
- Anthropic API key

### Environment Variables

Create `.env`:

```bash
DATABASE_URL="postgresql://user@localhost:5432/hackathon"
MORU_API_KEY="your-moru-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
BASE_URL="http://localhost:3000"  # For agent callbacks
```

### Install & Run

```bash
# Install dependencies
npm install

# Link local Moru SDK (if using unreleased Volume feature)
cd ~/moru/sdks/packages/js-sdk && pnpm build && npm link
cd ~/moru/hackathon-starter && npm link @moru-ai/core

# Setup database
npm run db:push

# Start dev server
npm run dev
```

Open http://localhost:3000

## Implementation Status

### Completed

| Component | Description | Status |
|-----------|-------------|--------|
| **UI - Chat** | Message display, prompt form, status indicator | Done |
| **UI - Workspace** | File explorer, file viewer, syntax highlighting | Done |
| **API - Conversations** | Create, get status, polling | Done |
| **API - Files** | List (tree), read content | Done |
| **Moru SDK** | Volume, Sandbox integration | Done |
| **TypeScript** | Full type safety | Done |

### Not Yet Tested (Requires Infrastructure)

| Component | Description | Blocker |
|-----------|-------------|---------|
| **Full Flow** | Volume → Sandbox → Agent → Files | Needs valid API keys |
| **Agent Execution** | Claude Agent SDK in sandbox | Needs `hackathon-ts-agent` template |
| **Message Parsing** | Claude Code JSONL format | Needs running agent |
| **Session Resume** | Continue existing conversation | Needs session ID from agent |

## Project Structure

```
hackathon-starter/
├── app/
│   ├── api/
│   │   └── conversations/
│   │       ├── route.ts              # POST: create/continue
│   │       └── [id]/
│   │           ├── route.ts          # GET: status & messages
│   │           ├── status/route.ts   # POST: agent callback
│   │           └── files/
│   │               ├── route.ts      # GET: list files
│   │               └── [...path]/route.ts  # GET: read file
│   ├── layout.tsx
│   ├── page.tsx                      # Main chat + workspace UI
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── cc-messages.tsx           # Message list
│   │   ├── cc-assistant-message.tsx  # Assistant message rendering
│   │   ├── cc-tool-use.tsx           # Tool use display
│   │   └── prompt-form.tsx           # Input form
│   ├── workspace/
│   │   ├── workspace-panel.tsx       # Main panel with header
│   │   ├── file-explorer.tsx         # Tree-based file browser
│   │   └── file-viewer.tsx           # Syntax-highlighted viewer
│   └── ui/
│       ├── button.tsx
│       ├── textarea.tsx
│       ├── resizable.tsx
│       ├── tooltip.tsx
│       ├── dropdown-menu.tsx
│       ├── file-icon.tsx
│       └── collapsible.tsx
├── lib/
│   ├── db.ts                         # Prisma client
│   ├── moru.ts                       # Moru SDK helpers
│   ├── types.ts                      # Claude Code session types
│   └── utils.ts                      # cn() helper
├── prisma/
│   └── schema.prisma                 # Conversation model
├── agent/                            # Agent code (runs in sandbox)
│   ├── src/agent.ts                  # Claude Agent SDK query
│   ├── package.json
│   └── tsconfig.json
└── package.json
```

## Key Dependencies

- `next` - React framework
- `@moru-ai/core` - Moru SDK (Sandbox, Volume)
- `@prisma/client` - Database ORM
- `react-resizable-panels` - Resizable layout
- `shiki` - Syntax highlighting
- `lucide-react` - Icons

## Agent Template

The agent runs inside a Moru sandbox. Template requirements:

1. Node.js environment with Claude Agent SDK
2. Volume mounted at `/workspace/data`
3. Environment variables: `ANTHROPIC_API_KEY`, `CALLBACK_URL`, `RESUME_SESSION_ID`
4. Entrypoint: `node /app/agent.js`

See `agent/` directory for the agent implementation.

## Next Steps

1. Register `hackathon-ts-agent` template in Moru
2. Test full conversation flow with valid API keys
3. Verify JSONL message parsing from Claude Code sessions
4. Test session resume functionality
