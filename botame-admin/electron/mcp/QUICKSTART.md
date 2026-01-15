# Botame MCP Server - Quick Start Guide

## Installation

```bash
cd botame-admin
npm install @anthropic-ai/claude-agent-sdk@^0.2.7
```

## Basic Usage

```typescript
import { createBotameMcpServer } from "./electron/mcp";
import { PlaybookRunnerService } from "./electron/services/playbook-runner.service";
import { BrowserService } from "./electron/services/browser.service";

// 1. Initialize services
const browserService = new BrowserService();
const playbookRunner = new PlaybookRunnerService(browserService);

// 2. Create MCP server
const mcpServer = createBotameMcpServer({
  playbookRunner,
  browserService,
  playbookDirectory: "/path/to/playbooks",
});

// 3. Use tools
const result = await mcpServer.callTool("list_playbooks", {});
```

## Tool Reference

### 1. List Playbooks
```typescript
const result = await mcpServer.callTool("list_playbooks", {
  directory: "/path/to/playbooks",  // optional
  filter: "login"                    // optional
});
```

### 2. Read Playbook
```typescript
const result = await mcpServer.callTool("read_playbook", {
  playbookPath: "/absolute/path/to/playbook.yaml"
});
```

### 3. Run Playbook
```typescript
const result = await mcpServer.callTool("run_playbook", {
  playbookPath: "/absolute/path/to/playbook.yaml",
  startUrl: "https://example.com"  // optional
});
```

### 4. Check Browser Status
```typescript
const result = await mcpServer.callTool("get_browser_status", {});
```

### 5. Capture Screenshot
```typescript
const result = await mcpServer.callTool("capture_screenshot", {
  fullPage: false,    // optional, default: false
  format: "png"       // optional, default: "png"
});
```

### 6. Heal Selector
```typescript
const result = await mcpServer.callTool("heal_selector", {
  stepData: {
    id: "step-1",
    action: "click",
    selector: "#button",
    smartSelector: {
      snapshot: {
        tagName: "BUTTON",
        textContent: "Submit",
        attributes: { "aria-label": "Submit form" }
      }
    }
  },
  strategy: "all"  // "accessibility" | "text" | "structural" | "all"
});
```

## Response Format

All tools return:
```typescript
{
  content: [
    {
      type: "text",
      text: "Result or error message"
    }
  ]
}
```

Screenshot tool also returns:
```typescript
{
  content: [
    { type: "text", text: "Screenshot info..." },
    {
      type: "image_url",
      image_url: { url: "data:image/png;base64,..." }
    }
  ]
}
```

## Error Handling

Errors are returned in the text field:
```typescript
{
  content: [
    {
      type: "text",
      text: "Error: Browser not initialized. Please start the browser first."
    }
  ]
}
```

## Selector Healing

The `heal_selector` tool returns ranked alternatives:
```
Generated 3 alternative selectors:

1. [accessibility] [aria-label="Submit form"] (confidence: 90%)
2. [text] text="Submit" (confidence: 85%)
3. [structural] #submit-btn (confidence: 80%)
```

## Integration Example

```typescript
// In Electron main process
import { ipcMain } from "electron";
import { createBotameMcpServer } from "./mcp";

const mcpServer = createBotameMcpServer({
  playbookRunner,
  browserService,
});

ipcMain.handle("mcp:callTool", async (_event, toolName, args) => {
  return await mcpServer.callTool(toolName, args);
});

// In renderer process
const result = await window.electron.ipcRenderer.invoke(
  "mcp:callTool",
  "list_playbooks",
  {}
);
```

## File Structure

```
electron/mcp/
├── botame-mcp.server.ts  # 6 tools, 834 lines
├── index.ts              # Exports
├── README.md             # Full documentation
├── IMPLEMENTATION.md     # Implementation details
└── QUICKSTART.md         # This file
```

## Troubleshooting

**Problem:** SDK not found
```bash
npm install @anthropic-ai/claude-agent-sdk@^0.2.7
```

**Problem:** TypeScript errors
```bash
npm install --save-dev @types/js-yaml
```

**Problem:** Playbook not found
- Use absolute paths
- Check file extension (.yaml or .yml)
- Verify file exists

**Problem:** Browser not ready
- Call `get_browser_status` first
- Initialize browser before running playbooks

## Next Steps

1. Install dependencies
2. Test with sample playbook
3. Integrate into Electron main process
4. Add IPC handlers
5. Create UI for tool invocation

## Support

See `README.md` for full documentation.
See `IMPLEMENTATION.md` for technical details.
