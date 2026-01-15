# Botame MCP Server

Model Context Protocol (MCP) server for 보탬e AI Guide Assistant.

## Overview

This MCP server provides tools for AI agents to interact with the Botame playbook system, including:

- **Running playbooks** - Execute playbooks from start to finish with automatic self-healing
- **Healing selectors** - Generate alternative selectors for failed steps
- **Reading playbooks** - Parse and display playbook YAML files
- **Listing playbooks** - Discover available playbooks in a directory
- **Browser status** - Check browser connection state
- **Capturing screenshots** - Take screenshots for visual analysis

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk js-yaml zod
```

## Usage

### Basic Setup

```typescript
import { createBotameMcpServer } from "./mcp";
import { PlaybookRunnerService } from "./services/playbook-runner.service";
import { BrowserService } from "./services/browser.service";

// Initialize services
const browserService = new BrowserService();
const playbookRunner = new PlaybookRunnerService(browserService);

// Create MCP server
const mcpServer = createBotameMcpServer({
  playbookRunner,
  browserService,
  playbookDirectory: "/path/to/playbooks",
});

// Server is now ready to use with MCP clients
```

### Tools Reference

#### 1. `run_playbook`

Execute a playbook from start to finish.

**Parameters:**
- `playbookPath` (string, required): Absolute path to the playbook YAML file
- `startUrl` (string, optional): Optional starting URL

**Returns:** Execution results with success/failure status, healing information, and errors

**Example:**
```typescript
const result = await mcpServer.callTool("run_playbook", {
  playbookPath: "/path/to/playbook.yaml",
  startUrl: "https://example.com"
});
```

#### 2. `heal_selector`

Generate alternative selectors for a failed step.

**Parameters:**
- `stepData` (object, required): Step data including selector and snapshot
  - `id` (string): Step ID
  - `action` (string): Step action type
  - `selector` (string, optional): Original selector
  - `message` (string, optional): Step message
  - `smartSelector` (object, optional): Smart selector with snapshot
- `strategy` (enum, optional): Healing strategy - "accessibility", "text", "structural", or "all" (default)

**Returns:** List of candidate selectors with confidence scores

**Example:**
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
  strategy: "all"
});
```

#### 3. `read_playbook`

Read and parse a playbook YAML file.

**Parameters:**
- `playbookPath` (string, required): Absolute path to the playbook YAML file

**Returns:** Formatted playbook with metadata and steps

**Example:**
```typescript
const result = await mcpServer.callTool("read_playbook", {
  playbookPath: "/path/to/playbook.yaml"
});
```

#### 4. `list_playbooks`

List all available playbooks in a directory.

**Parameters:**
- `directory` (string, optional): Directory to scan (default: configured playbook directory)
- `filter` (string, optional): Filter by name (case-insensitive partial match)

**Returns:** List of playbooks with metadata

**Example:**
```typescript
const result = await mcpServer.callTool("list_playbooks", {
  directory: "/path/to/playbooks",
  filter: "login"
});
```

#### 5. `get_browser_status`

Check the current browser state.

**Parameters:** None

**Returns:** Browser connection status, current URL, and readiness state

**Example:**
```typescript
const result = await mcpServer.callTool("get_browser_status", {});
```

#### 6. `capture_screenshot`

Capture a screenshot of the current browser page.

**Parameters:**
- `fullPage` (boolean, optional): Capture full page (default: false)
- `format` (enum, optional): Screenshot format - "png" or "jpeg" (default: "png")

**Returns:** Base64-encoded screenshot data

**Example:**
```typescript
const result = await mcpServer.callTool("capture_screenshot", {
  fullPage: true,
  format: "png"
});
```

## Architecture

The MCP server follows the same pattern as the Obsidian MCP server:

1. **Tool Definition** - Each tool is defined using the `tool()` function with:
   - Name and description
   - Zod schema for input validation
   - Async handler function

2. **Server Creation** - `createSdkMcpServer()` wraps all tools into an MCP server

3. **Error Handling** - All tools include try-catch blocks with meaningful error messages

4. **Type Safety** - Full TypeScript types with Zod validation

## Integration with Existing Services

The MCP server integrates with existing Botame services:

- **PlaybookRunnerService** - Executes playbooks with self-healing
- **BrowserService** - Manages Playwright browser instance
- **File System** - Reads playbook YAML files using `fs.promises`

## Selector Healing Strategies

The `heal_selector` tool supports multiple strategies:

1. **Accessibility** (confidence: 75-90%)
   - `aria-label` attributes
   - `role` + name combinations
   - Label associations
   - `title` attributes

2. **Text** (confidence: 70-85%)
   - Exact text content matches
   - Partial text matches
   - Text-based selectors

3. **Structural** (confidence: 60-95%)
   - `data-testid` attributes
   - `data-*` attributes
   - ID attributes (excluding auto-generated)
   - `name` attributes (forms)
   - `placeholder` attributes
   - `type` attributes

Selectors are validated against the actual page and sorted by confidence score.

## File Structure

```
electron/mcp/
├── botame-mcp.server.ts  # Main MCP server implementation
├── index.ts              # Entry point for exports
└── README.md             # This file
```

## Dependencies

- `@anthropic-ai/claude-agent-sdk` - MCP SDK for tool creation
- `zod` - Schema validation
- `js-yaml` - YAML parsing
- `playwright` - Browser automation (via BrowserService)
- `@botame/types` - Shared type definitions

## Error Handling

All tools return errors in a consistent format:

```typescript
{
  content: [
    {
      type: "text",
      text: "Error: <error message>"
    }
  ]
}
```

Common errors:
- Browser not initialized
- Invalid playbook structure
- File not found
- YAML parse errors
- Selector generation failures

## Testing

```typescript
// Test server creation
import { createBotameMcpServer } from "./mcp";

const mockRunner = {
  runPlaybook: async () => ({ success: true, data: [] })
};

const mockBrowser = {
  getPage: () => null,
  isRunning: () => false,
  verifyConnection: async () => ({ connected: false, details: "Test" })
};

const server = createBotameMcpServer({
  playbookRunner: mockRunner,
  browserService: mockBrowser
});

console.log("MCP server created successfully");
```

## License

MIT
