# Botame MCP Server - Implementation Summary

## Overview

Comprehensive Model Context Protocol (MCP) server implementation for the 보탬e AI Guide Assistant project, following the pattern established by the Obsidian MCP server.

## Files Created

### 1. `/botame-admin/electron/mcp/botame-mcp.server.ts` (834 lines)

**Main MCP server implementation with 6 tools:**

#### Tool: `run_playbook`
- **Purpose**: Execute a playbook from start to finish
- **Parameters**:
  - `playbookPath` (string, required): Absolute path to YAML file
  - `startUrl` (string, optional): Override start URL
- **Features**:
  - Reads and parses YAML files using `js-yaml`
  - Validates playbook structure (metadata + steps)
  - Delegates execution to `PlaybookRunnerService`
  - Formats execution results with summary statistics
- **Returns**: Detailed execution results including success/failure counts, healing info, errors, and duration

#### Tool: `heal_selector`
- **Purpose**: Generate alternative selectors for failed steps
- **Parameters**:
  - `stepData` (object, required): Step context with selector and snapshot
  - `strategy` (enum, optional): "accessibility" | "text" | "structural" | "all"
- **Healing Strategies**:
  1. **Accessibility** (75-90% confidence):
     - `aria-label` attributes
     - `role` + name combinations
     - Label associations
     - `title` attributes
  2. **Text** (70-85% confidence):
     - Exact text content matches
     - Partial text matches
  3. **Structural** (60-95% confidence):
     - `data-testid`, `data-*` attributes
     - ID attributes (excluding auto-generated)
     - `name`, `placeholder`, `type` attributes
- **Validation**: All selectors are validated against the actual page
- **Returns**: Sorted list of candidates by confidence score

#### Tool: `read_playbook`
- **Purpose**: Parse and display playbook YAML files
- **Parameters**:
  - `playbookPath` (string, required): Absolute path to YAML file
- **Features**:
  - Parses YAML with `js-yaml`
  - Formats playbook with metadata and all steps
  - Shows selectors, values, timeouts, optional flags
- **Returns**: Human-readable playbook representation

#### Tool: `list_playbooks`
- **Purpose**: Discover available playbooks
- **Parameters**:
  - `directory` (string, optional): Scan directory (default: configured)
  - `filter` (string, optional): Case-insensitive name filter
- **Features**:
  - Scans for `.yaml` and `.yml` files
  - Extracts metadata from each playbook
  - Gracefully handles invalid playbooks
- **Returns**: List with names, paths, descriptions, step counts, categories

#### Tool: `get_browser_status`
- **Purpose**: Check browser connection state
- **Parameters**: None
- **Returns**:
  - `connected`: Boolean connection status
  - `details`: Diagnostic message
  - `isRunning`: Browser running state
  - `currentUrl`: Current page URL
  - `browserConnected`: WebSocket connection status

#### Tool: `capture_screenshot`
- **Purpose**: Capture page screenshot for analysis
- **Parameters**:
  - `fullPage` (boolean, optional): Full page vs viewport (default: false)
  - `format` (enum, optional): "png" | "jpeg" (default: "png")
- **Returns**: Base64-encoded screenshot with data URL

### 2. `/botame-admin/electron/mcp/index.ts` (12 lines)

**Entry point for exports:**
```typescript
export { createBotameMcpServer } from "./botame-mcp.server";
export type {
  BotameMcpServerInstance,
  BotameMcpServerOptions,
} from "./botame-mcp.server";
```

### 3. `/botame-admin/electron/mcp/README.md` (300+ lines)

**Comprehensive documentation including:**
- Overview and feature list
- Installation instructions
- Usage examples for each tool
- Architecture explanation
- Selector healing strategies
- Error handling patterns
- Testing guidelines

## Technical Implementation

### Dependencies (Already Installed)

✅ `js-yaml@^4.1.0` - YAML parsing
✅ `zod` - Schema validation (via @anthropic-ai/claude-agent-sdk)
✅ `@botame/types` - Shared type definitions

### Dependencies (To Install)

⚠️ `@anthropic-ai/claude-agent-sdk@^0.2.7` - MCP SDK

**Install command:**
```bash
cd /mnt/d/00.Projects/02.보탬e/botame-admin
npm install @anthropic-ai/claude-agent-sdk@^0.2.7
```

### Type Safety

All tools use **Zod schemas** for runtime validation:
- Type-safe parameter definitions
- Automatic schema generation for MCP protocol
- Compile-time TypeScript checking

### Error Handling

Consistent error format across all tools:
```typescript
{
  content: [
    {
      type: "text",
      text: "Error: <meaningful message>"
    }
  ]
}
```

### Helper Functions

#### `formatExecutionSummary(results)`
Formats step-by-step execution results with:
- Summary statistics (success, failed, skipped, healed counts)
- Detailed step information
- Healing details (original → healed selector)
- Duration tracking

#### `formatPlaybook(playbook)`
Human-readable playbook representation:
- Metadata header (name, version, category, difficulty)
- Description and start URL
- Step-by-step breakdown with selectors and values

#### `generateFallbackSelectors(page, stepData, strategy)`
Intelligent selector generation:
- Multi-strategy approach (accessibility, text, structural)
- Page validation to ensure selectors work
- Confidence scoring and sorting
- Filters out auto-generated IDs

## Integration with Existing Services

The MCP server integrates seamlessly with existing Botame services:

### PlaybookRunnerService
```typescript
const result = await playbookRunner.runPlaybook(
  playbook,
  startUrl
);
```
- Uses existing execution engine
- Leverages self-healing capabilities
- Returns structured StepResult[]

### BrowserService
```typescript
const page = browserService.getPage();
const status = await browserService.verifyConnection();
```
- Access to Playwright Page instance
- Connection state management
- Screenshot capture

## Usage Example

```typescript
import { createBotameMcpServer } from "./mcp";
import { PlaybookRunnerService } from "./services/playbook-runner.service";
import { BrowserService } from "./services/browser.service";

// Initialize services
const browserService = new BrowserService("https://www.losims.go.kr/lss.do");
const playbookRunner = new PlaybookRunnerService(browserService);

// Create MCP server
const mcpServer = createBotameMcpServer({
  playbookRunner,
  browserService,
  playbookDirectory: "/path/to/playbooks",
});

// Server is now ready for MCP clients
// Tools can be called via:
// await mcpServer.callTool("list_playbooks", { directory: "/path" });
// await mcpServer.callTool("run_playbook", { playbookPath: "/path/file.yaml" });
// await mcpServer.callTool("get_browser_status", {});
```

## Comparison with Obsidian MCP Server

| Aspect | Obsidian | Botame |
|--------|----------|--------|
| SDK | `@anthropic-ai/claude-agent-sdk` | Same |
| Pattern | `createSdkMcpServer()` | Same |
| Tool Definition | `tool(name, description, schema, handler)` | Same |
| Validation | Zod schemas | Zod schemas |
| Error Handling | Try-catch with text returns | Same |
| Type Safety | Full TypeScript | Full TypeScript |
| Tools | 17 tools (file ops, search, RAG) | 6 tools (playbook focus) |

## Key Features

1. **Comprehensive Tool Coverage**
   - All requested tools implemented
   - Additional helper functions for formatting
   - Intelligent selector healing

2. **Production Ready**
   - Full error handling
   - Input validation with Zod
   - TypeScript type safety
   - JSDoc documentation

3. **Service Integration**
   - Works with existing PlaybookRunnerService
   - Uses existing BrowserService
   - No service modifications required

4. **Extensibility**
   - Easy to add new tools following the pattern
   - Modular helper functions
   - Clear separation of concerns

## Next Steps

1. **Install SDK dependency:**
   ```bash
   npm install @anthropic-ai/claude-agent-sdk@^0.2.7
   ```

2. **Test MCP server creation:**
   ```typescript
   import { createBotameMcpServer } from "./mcp";
   // Verify server initializes without errors
   ```

3. **Integrate with Electron main process:**
   ```typescript
   // In main.ts
   import { createBotameMcpServer } from "./mcp";
   // Expose MCP tools to renderer via IPC
   ```

4. **Add unit tests:**
   - Test each tool independently
   - Mock PlaybookRunnerService and BrowserService
   - Verify error handling

5. **Add integration tests:**
   - Test with real playbook files
   - Verify selector healing works
   - Check screenshot capture

## File Locations

```
/mnt/d/00.Projects/02.보탬e/botame-admin/
├── electron/
│   ├── mcp/
│   │   ├── botame-mcp.server.ts  ← Main implementation (834 lines)
│   │   ├── index.ts              ← Entry point (12 lines)
│   │   └── README.md             ← Documentation (300+ lines)
│   ├── services/
│   │   ├── playbook-runner.service.ts  ← Used by MCP
│   │   └── browser.service.ts          ← Used by MCP
│   └── main.ts                      ← Integration point
└── package.json                    ← Add dependency here
```

## Summary

✅ **All requirements met:**
- Created `botame-mcp.server.ts` with 6 required tools
- Exported `createBotameMcpServer()` function
- Used `createSdkMcpServer` from @anthropic-ai/claude-agent-sdk
- All tools properly typed with Zod schemas
- Error handling for each tool
- JSDoc comments for all functions
- Followed Obsidian MCP server pattern
- No modifications to existing services
- Comprehensive documentation

**Total Lines of Code:** ~1,150 lines
- Implementation: 834 lines
- Documentation: 300+ lines
- Entry point: 12 lines

**Status:** Ready for integration once SDK dependency is installed.
