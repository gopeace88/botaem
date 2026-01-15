import { app, BrowserWindow } from "electron";
import path from "path";
import {
  ChatHandler,
  PlaybookHandler,
  WindowHandler,
  AutomationHandler,
  RecordingHandler,
} from "./ipc";
import { supabaseService } from "./services";
import { PlaybookStep, ExecutionContext, StepResult } from "./playbook/types";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Only in production with electron-squirrel-startup installed
try {
  if (require("electron-squirrel-startup")) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, skip in development
}

let mainWindow: BrowserWindow | null = null;

// IPC Handlers
let windowHandler: WindowHandler;
let playbookHandler: PlaybookHandler;
let chatHandler: ChatHandler;
let automationHandler: AutomationHandler;
let recordingHandler: RecordingHandler;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 350,
    minHeight: 500,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      sandbox: true,
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html in development or production
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Set main window reference for handlers that need it
  windowHandler.setMainWindow(mainWindow);
  playbookHandler.setMainWindow(mainWindow);
  recordingHandler.setMainWindow(mainWindow);
};

/**
 * Create step executor that uses BotameAutomation
 */
const createStepExecutor = (
  automation: AutomationHandler,
  playbook: PlaybookHandler,
) => {
  return async (
    step: PlaybookStep,
    context: ExecutionContext,
  ): Promise<StepResult> => {
    console.log("[StepExecutor] Executing step:", step.action, step.id);
    const auto = automation.getAutomation();

    // Initialize browser if not already done
    if (!auto.isInitialized()) {
      console.log("[StepExecutor] Initializing browser...");
      const initResult = await auto.initialize();
      console.log("[StepExecutor] Browser init result:", initResult);
      if (!initResult.success) {
        console.error("[StepExecutor] Browser init failed:", initResult.error);
        return { success: false, error: initResult.error };
      }

      // Connect page to playbook engine for verification
      const page = auto.getPage();
      if (page) {
        playbook.setPage(page);
      }
    }

    // Handle wait_for: user - wait for user confirmation
    console.log(
      "[StepExecutor] step.wait_for:",
      step.wait_for,
      "action:",
      step.action,
    );
    if (step.wait_for === "user" || step.wait_for === "user_input") {
      console.log("[StepExecutor] Waiting for user action...");
      return { success: true, waitForUser: true };
    }

    // Execute based on action type
    switch (step.action) {
      case "navigate": {
        if (!step.value) {
          return {
            success: false,
            error: "Navigate action requires a value (URL)",
          };
        }
        return auto.navigateTo(step.value);
      }

      case "click": {
        if (!step.selector) {
          return { success: false, error: "Click action requires a selector" };
        }
        return auto.clickElement(step.selector);
      }

      case "type": {
        if (!step.selector) {
          return { success: false, error: "Type action requires a selector" };
        }
        const value =
          step.value ||
          (context.variables[step.variable || ""] as string) ||
          "";
        return auto.fillInput(step.selector, value);
      }

      case "select": {
        if (!step.selector || !step.value) {
          return {
            success: false,
            error: "Select action requires selector and value",
          };
        }
        return auto.selectOption(step.selector, step.value);
      }

      case "wait": {
        if (step.selector) {
          return auto.waitForElement(step.selector, step.timeout);
        }
        // Wait for a fixed time if no selector
        await new Promise((resolve) =>
          setTimeout(resolve, step.timeout || 1000),
        );
        return { success: true };
      }

      case "assert": {
        if (!step.selector) {
          return { success: false, error: "Assert action requires a selector" };
        }
        const result = await auto.waitForElement(
          step.selector,
          step.timeout || 5000,
        );
        if (!result.success) {
          return {
            success: false,
            error: `Assertion failed: element not found - ${step.selector}`,
          };
        }
        return { success: true };
      }

      case "highlight":
      case "guide": {
        // For guide actions, just show the message and continue
        // The message is already handled by the engine's event system
        return { success: true };
      }

      case "extract": {
        // Extract data from page
        if (!step.selector || !step.variable) {
          return {
            success: false,
            error: "Extract action requires selector and variable",
          };
        }
        try {
          const result = await auto.evaluateScript(`
            (() => {
              const el = document.querySelector('${step.selector}');
              return el ? el.textContent || el.value : null;
            })()
          `);
          if (result.success && result.data) {
            context.variables[step.variable] = result.data;
          }
          return result;
        } catch (e) {
          return { success: false, error: `Extract failed: ${e}` };
        }
      }

      case "validate": {
        // Validate extracted data
        return { success: true };
      }

      default:
        return { success: true };
    }
  };
};

const initializeHandlers = async (): Promise<void> => {
  const playbooksDir = path.join(app.getPath("userData"), "playbooks");

  // Initialize Supabase if configured
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    supabaseService.initialize({
      url: supabaseUrl,
      anonKey: supabaseKey,
    });
    console.log("Supabase initialized");
  }

  // Create handlers
  windowHandler = new WindowHandler();
  playbookHandler = new PlaybookHandler(playbooksDir);
  chatHandler = new ChatHandler();
  automationHandler = new AutomationHandler(process.env.VITE_BOTAME_URL);
  recordingHandler = new RecordingHandler(automationHandler.getAutomation());

  // Connect playbook engine with automation (pass playbookHandler for page connection)
  playbookHandler.setStepExecutor(
    createStepExecutor(automationHandler, playbookHandler),
  );

  // Initialize Claude service if API key is available
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  if (claudeApiKey) {
    chatHandler.initializeClaudeService({
      baseUrl: "https://api.anthropic.com",
      apiKey: claudeApiKey,
      model: "claude-3-haiku-20240307",
      maxTokens: 1024,
    });
    console.log("Claude API initialized");
  } else {
    console.log("Claude API key not found, running in offline mode");
  }

  // Register all handlers
  windowHandler.register();
  playbookHandler.register();
  chatHandler.register();
  automationHandler.register();
  recordingHandler.register();

  // Load playbooks and update chat handler
  const playbooks = await playbookHandler.loadPlaybooksFromDir();
  chatHandler.updatePlaybooks(playbooks);

  console.log(`Loaded ${playbooks.length} playbooks`);

  // Initialize Credentials Service and register IPC handlers
  const { getCredentialsService } = require('./services/credentials.service');
  const credentialsService = getCredentialsService();

  const { ipcMain } = require('electron');
  
  ipcMain.handle('credentials:set', async (_event, service, key) => {
    return await credentialsService.setApiKey(service, key);
  });

  ipcMain.handle('credentials:get', async (_event, service) => {
    const key = await credentialsService.getApiKey(service);
    return { success: key !== null, key };
  });

  ipcMain.handle('credentials:delete', async (_event, service) => {
    return await credentialsService.deleteApiKey(service);
  });

  ipcMain.handle('credentials:has', async (_event, service) => {
    const hasKey = await credentialsService.hasApiKey(service);
    return { success: true, hasKey };
  });

  ipcMain.handle('credentials:validate', async (_event, service, key) => {
    return credentialsService.validateApiKeyFormat(service, key);
  });
};

const cleanupHandlers = (): void => {
  windowHandler?.unregister();
  playbookHandler?.unregister();
  chatHandler?.unregister();
  automationHandler?.unregister();
  recordingHandler?.unregister();
};

// App lifecycle
app.whenReady().then(async () => {
  await initializeHandlers();
  createWindow();

  // Auto-initialize browser in development mode
  if (process.env.NODE_ENV === "development") {
    console.log("[Dev] Auto-initializing browser...");
    const auto = automationHandler.getAutomation();
    const initResult = await auto.initialize();
    if (initResult.success) {
      console.log("[Dev] Browser initialized, navigating to main page...");
      await auto.navigateToMain();
    } else {
      console.error("[Dev] Browser initialization failed:", initResult.error);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    cleanupHandlers();
    app.quit();
  }
});

app.on("before-quit", () => {
  cleanupHandlers();
});
