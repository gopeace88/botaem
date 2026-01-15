/**
 * Botame MCP Server - Model Context Protocol server for 보탬e AI Guide Assistant
 *
 * Provides tools for:
 * - Running playbooks from start to finish
 * - Healing selectors for failed steps
 * - Reading playbook YAML files
 * - Listing available playbooks
 * - Getting browser status
 * - Capturing screenshots for analysis
 *
 * @module botame-mcp
 */

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as yaml from "js-yaml";
import { Playbook } from "../../shared/types";
import { PlaybookRunnerService } from "../services/playbook-runner.service";
import { BrowserService } from "../services/browser.service";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Type for the MCP server instance
 */
export type BotameMcpServerInstance = ReturnType<typeof createSdkMcpServer>;

/**
 * Options for creating the Botame MCP server
 */
export interface BotameMcpServerOptions {
  playbookRunner: PlaybookRunnerService;
  browserService: BrowserService;
  playbookDirectory?: string;
}

/**
 * Create the Botame MCP server with custom tools
 *
 * @param options - Server configuration options
 * @returns Configured MCP server instance
 */
export function createBotameMcpServer(
  options: BotameMcpServerOptions,
): BotameMcpServerInstance {
  const { playbookRunner, browserService, playbookDirectory } = options;

  return createSdkMcpServer({
    name: "botame",
    version: "1.0.0",
    tools: [
      /**
       * Run a playbook from start to finish
       *
       * Executes all steps in the playbook sequentially, with automatic
       * self-healing for failed selectors. Returns detailed results for each step.
       */
      tool(
        "run_playbook",
        "Execute a playbook from start to finish. Runs all steps sequentially with automatic self-healing for failed selectors. Returns detailed execution results including success/failure status, healing information, and any errors.",
        {
          playbookPath: z
            .string()
            .describe(
              "Absolute path to the playbook YAML file (e.g., /path/to/playbook.yaml)",
            ),
          startUrl: z
            .string()
            .optional()
            .describe(
              "Optional starting URL. If not provided, uses playbook's start_url or default",
            ),
        },
        async (args) => {
          try {
            // Read playbook file
            const playbookContent = await fs.readFile(
              args.playbookPath,
              "utf-8",
            );
            const playbook = yaml.load(playbookContent) as Playbook;

            // Validate playbook structure
            if (!playbook?.metadata || !playbook?.steps) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error: Invalid playbook structure. Missing metadata or steps.`,
                  },
                ],
              };
            }

            // Run playbook
            const result = await playbookRunner.runPlaybook(
              playbook,
              args.startUrl,
            );

            // Format response
            if (result.success) {
              const summary = formatExecutionSummary(result.data || []);
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Playbook execution completed successfully:\n\n${summary}`,
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Playbook execution failed: ${result.error}`,
                  },
                ],
              };
            }
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error running playbook: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * Generate alternative selectors for a failed step
       *
       * Analyzes the failed step and generates fallback selectors using
       * various strategies (accessibility attributes, text content, structural patterns).
       */
      tool(
        "heal_selector",
        "Generate alternative selectors for a failed step. Analyzes the step's context and generates fallback selectors using accessibility attributes, text content, ARIA labels, and structural patterns. Returns a list of candidate selectors with confidence scores.",
        {
          stepData: z
            .object({
              id: z.string(),
              action: z.string(),
              selector: z.string().optional(),
              message: z.string().optional(),
              smartSelector: z
                .object({
                  primary: z
                    .object({
                      strategy: z.string(),
                      value: z.string(),
                    })
                    .optional(),
                  fallback: z.array(z.any()).optional(),
                  snapshot: z
                    .object({
                      tagName: z.string().optional(),
                      textContent: z.string().optional(),
                      attributes: z.record(z.string(), z.any()),
                    })
                    .optional(),
                })
                .optional(),
            })
            .describe("Step data including selector and snapshot information"),
          strategy: z
            .enum(["accessibility", "text", "structural", "all"])
            .optional()
            .describe(
              "Healing strategy to use: 'accessibility' (ARIA, labels), 'text' (text content), 'structural' (DOM structure), or 'all' (default)",
            ),
        },
        async (args) => {
          try {
            const page = browserService.getPage();
            if (!page) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Error: Browser not initialized. Please start the browser first.",
                  },
                ],
              };
            }

            // Generate fallback selectors based on strategy
            const fallbackSelectors = await generateFallbackSelectors(
              page,
              args.stepData,
              args.strategy || "all",
            );

            if (fallbackSelectors.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No alternative selectors could be generated for step: ${args.stepData.id}`,
                  },
                ],
              };
            }

            // Format selector suggestions
            const formatted = fallbackSelectors
              .map(
                (s, i) =>
                  `${i + 1}. [${s.strategy}] ${s.selector} (confidence: ${s.confidence}%)`,
              )
              .join("\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Generated ${fallbackSelectors.length} alternative selectors:\n\n${formatted}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error healing selector: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * Read a playbook YAML file
       *
       * Parses and returns the playbook structure including metadata and steps.
       * Useful for analyzing playbook content before execution.
       */
      tool(
        "read_playbook",
        "Read and parse a playbook YAML file. Returns the playbook structure including metadata (name, version, description) and all steps with their selectors, actions, and messages.",
        {
          playbookPath: z
            .string()
            .describe(
              "Absolute path to the playbook YAML file (e.g., /path/to/playbook.yaml)",
            ),
        },
        async (args) => {
          try {
            const content = await fs.readFile(args.playbookPath, "utf-8");
            const playbook = yaml.load(content) as Playbook;

            // Format playbook for display
            const formatted = formatPlaybook(playbook);

            return {
              content: [
                {
                  type: "text" as const,
                  text: formatted,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error reading playbook: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * List available playbooks
       *
       * Scans the playbook directory and returns a list of all available
       * playbooks with metadata (name, description, step count, etc.).
       */
      tool(
        "list_playbooks",
        "List all available playbooks in the playbook directory. Returns playbook names, descriptions, step counts, categories, and file paths. Use this to discover what playbooks are available before running one.",
        {
          directory: z
            .string()
            .optional()
            .describe(
              "Directory to scan for playbooks. If not provided, uses the default playbook directory",
            ),
          filter: z
            .string()
            .optional()
            .describe(
              "Filter playbooks by name (case-insensitive partial match)",
            ),
        },
        async (args) => {
          try {
            const scanDir = args.directory || playbookDirectory || ".";
            const files = await fs.readdir(scanDir);

            // Filter YAML files
            const yamlFiles = files.filter(
              (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
            );

            if (yamlFiles.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No playbooks found in directory: ${scanDir}`,
                  },
                ],
              };
            }

            // Read playbook metadata
            const playbooks: Array<{
              name: string;
              path: string;
              description?: string;
              stepCount?: number;
              category?: string;
            }> = [];

            for (const file of yamlFiles) {
              try {
                const filePath = path.join(scanDir, file);
                const content = await fs.readFile(filePath, "utf-8");
                const playbook = yaml.load(content) as Playbook;

                // Apply filter if provided
                if (
                  args.filter &&
                  !playbook.metadata?.name
                    ?.toLowerCase()
                    .includes(args.filter.toLowerCase())
                ) {
                  continue;
                }

                playbooks.push({
                  name: playbook.metadata.name,
                  path: filePath,
                  description: playbook.metadata.description,
                  stepCount: playbook.steps?.length || 0,
                  category: playbook.metadata.category,
                });
              } catch (err) {
                // Skip invalid playbooks
                console.warn(`Skipping invalid playbook: ${file}`, err);
              }
            }

            // Format playbook list
            const formatted = playbooks
              .map(
                (p) =>
                  `- ${p.name}${p.category ? ` [${p.category}]` : ""}\n  Path: ${p.path}\n  Description: ${p.description || "N/A"}\n  Steps: ${p.stepCount || 0}`,
              )
              .join("\n\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Found ${playbooks.length} playbook(s):\n\n${formatted}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error listing playbooks: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * Check browser state
       *
       * Returns current browser status including connection state, URL,
       * and whether the browser is ready for playbook execution.
       */
      tool(
        "get_browser_status",
        "Check the current browser state. Returns connection status, current URL, whether browser is initialized and ready for playbook execution. Use this to verify browser is ready before running a playbook.",
        {},
        async () => {
          try {
            const isRunning = browserService.isRunning();
            const connectionCheck = await browserService.verifyConnection();
            const currentUrl = browserService.getCurrentUrl();
            const browser = browserService.getBrowser();

            const status = {
              connected: connectionCheck.connected,
              details: connectionCheck.details,
              isRunning,
              currentUrl,
              browserConnected: browser?.isConnected() ?? false,
            };

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(status, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error checking browser status: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * Capture screenshot for analysis
       *
       * Takes a screenshot of the current browser page and returns it as
       * base64-encoded data. Useful for visual analysis and debugging.
       */
      tool(
        "capture_screenshot",
        "Capture a screenshot of the current browser page. Returns base64-encoded screenshot data for visual analysis. Useful for debugging failed steps or analyzing page state.",
        {
          fullPage: z
            .boolean()
            .optional()
            .describe(
              "Capture full page (true) or visible viewport only (false, default)",
            ),
          format: z
            .enum(["png", "jpeg"])
            .optional()
            .describe("Screenshot format (default: png)"),
        },
        async (args) => {
          try {
            const page = browserService.getPage();
            if (!page) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Error: Browser not initialized. Please start the browser first.",
                  },
                ],
              };
            }

            // Capture screenshot
            const screenshot = await page.screenshot({
              fullPage: args.fullPage ?? false,
              type: args.format || "png",
            });

            const base64 = screenshot.toString("base64");
            const dataUrl = `data:image/${args.format || "png"};base64,${base64}`;

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Screenshot captured (${screenshot.length} bytes)\n\nData URL: ${dataUrl.slice(0, 100)}...`,
                },
                {
                  type: "image_url" as const,
                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error capturing screenshot: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),
    ],
  });
}

/**
 * Format execution results into a readable summary
 */
function formatExecutionSummary(
  results: Array<{
    stepId: string;
    stepIndex: number;
    status: string;
    message?: string;
    error?: string;
    duration?: number;
    healed?: boolean;
    healedSelector?: string;
    originalSelector?: string;
    healMethod?: string;
  }>,
): string {
  const lines: string[] = [];

  lines.push("## Execution Results");
  lines.push("");

  const success = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const healed = results.filter((r) => r.healed).length;

  lines.push(`Total Steps: ${results.length}`);
  lines.push(`✓ Success: ${success}`);
  lines.push(`✗ Failed: ${failed}`);
  lines.push(`⊘ Skipped: ${skipped}`);
  lines.push(`⟳ Healed: ${healed}`);
  lines.push("");

  lines.push("## Step Details");
  lines.push("");

  for (const result of results) {
    const statusIcon =
      result.status === "success"
        ? "✓"
        : result.status === "failed"
          ? "✗"
          : "⊘";
    const healInfo = result.healed ? ` [healed: ${result.healMethod}]` : "";

    lines.push(
      `${statusIcon} Step ${result.stepIndex + 1}: ${result.message || result.stepId}${healInfo}`,
    );

    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }

    if (result.healed) {
      lines.push(`  Original: ${result.originalSelector}`);
      lines.push(`  Healed: ${result.healedSelector}`);
    }

    if (result.duration) {
      lines.push(`  Duration: ${result.duration}ms`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format playbook for display
 */
function formatPlaybook(playbook: Playbook): string {
  const lines: string[] = [];

  lines.push("# Playbook");
  lines.push("");
  lines.push(`## ${playbook.metadata.name}`);
  lines.push(`**Version:** ${playbook.metadata.version}`);
  lines.push(`**ID:** ${playbook.metadata.id}`);
  lines.push(`**Category:** ${playbook.metadata.category || "Uncategorized"}`);
  lines.push(
    `**Difficulty:** ${playbook.metadata.difficulty || "Not specified"}`,
  );
  lines.push("");

  if (playbook.metadata.description) {
    lines.push("### Description");
    lines.push(playbook.metadata.description);
    lines.push("");
  }

  if (playbook.metadata.startUrl || playbook.metadata.start_url) {
    lines.push(
      `**Start URL:** ${playbook.metadata.startUrl || playbook.metadata.start_url}`,
    );
    lines.push("");
  }

  if (playbook.metadata.aliases && playbook.metadata.aliases.length > 0) {
    lines.push("**Aliases:**");
    lines.push(playbook.metadata.aliases.map((a) => `- ${a}`).join("\n"));
    lines.push("");
  }

  lines.push(`**Total Steps:** ${playbook.steps.length}`);
  lines.push("");

  lines.push("## Steps");
  lines.push("");

  playbook.steps.forEach((step, index) => {
    lines.push(`${index + 1}. **${step.action}** - ${step.message || step.id}`);

    if (step.selector) {
      lines.push(`   Selector: \`${step.selector}\``);
    }

    if (step.selectors && step.selectors.length > 0) {
      lines.push(
        `   Selectors: ${step.selectors.map((s) => `\`${s.value}\``).join(", ")}`,
      );
    }

    if (step.value) {
      lines.push(`   Value: \`${step.value}\``);
    }

    if (step.timeout) {
      lines.push(`   Timeout: ${step.timeout}ms`);
    }

    if (step.optional) {
      lines.push(`   Optional: true`);
    }

    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Generate fallback selectors for a failed step
 */
async function generateFallbackSelectors(
  page: import("playwright").Page,
  stepData: any,
  strategy: string,
): Promise<Array<{ selector: string; strategy: string; confidence: number }>> {
  const fallbacks: Array<{
    selector: string;
    strategy: string;
    confidence: number;
  }> = [];

  const snapshot = stepData.smartSelector?.snapshot;
  const tagName = snapshot?.tagName?.toLowerCase();
  const attributes = snapshot?.attributes || {};
  const textContent = snapshot?.textContent;

  // Strategy: Accessibility attributes
  if (strategy === "accessibility" || strategy === "all") {
    // aria-label
    if (attributes["aria-label"]) {
      fallbacks.push({
        selector: `[aria-label="${attributes["aria-label"]}"]`,
        strategy: "accessibility",
        confidence: 90,
      });
    }

    // role + name
    if (attributes["role"] && textContent) {
      fallbacks.push({
        selector: `[role="${attributes["role"]}"][aria-label*="${textContent.slice(0, 20)}"]`,
        strategy: "accessibility",
        confidence: 85,
      });
    }

    // label association (for inputs)
    if (tagName === "input" && attributes["id"]) {
      fallbacks.push({
        selector: `label[for="${attributes["id"]}"]`,
        strategy: "accessibility",
        confidence: 80,
      });
    }

    // title attribute
    if (attributes["title"]) {
      fallbacks.push({
        selector: `[title="${attributes["title"]}"]`,
        strategy: "accessibility",
        confidence: 75,
      });
    }
  }

  // Strategy: Text content
  if (strategy === "text" || strategy === "all") {
    if (textContent && textContent.length > 0 && textContent.length < 50) {
      const escapedText = textContent.replace(/"/g, '\\"');
      fallbacks.push({
        selector: `text="${escapedText}"`,
        strategy: "text",
        confidence: 85,
      });

      // Partial text match
      if (textContent.length > 10) {
        const partialText = textContent.slice(0, 20).replace(/"/g, '\\"');
        fallbacks.push({
          selector: `text=${partialText}`,
          strategy: "text",
          confidence: 70,
        });
      }
    }
  }

  // Strategy: Structural patterns
  if (strategy === "structural" || strategy === "all") {
    // data-testid
    if (attributes["data-testid"]) {
      fallbacks.push({
        selector: `[data-testid="${attributes["data-testid"]}"]`,
        strategy: "structural",
        confidence: 95,
      });
    }

    // data-* attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith("data-") && key !== "data-testid") {
        fallbacks.push({
          selector: `[${key}="${value}"]`,
          strategy: "structural",
          confidence: 80,
        });
      }
    }

    // ID (excluding auto-generated)
    if (attributes["id"] && !/^\d|^[a-f0-9-]{36}$/i.test(attributes["id"])) {
      fallbacks.push({
        selector: `#${attributes["id"]}`,
        strategy: "structural",
        confidence: 90,
      });
    }

    // name attribute (for forms)
    if (attributes["name"]) {
      fallbacks.push({
        selector: `[name="${attributes["name"]}"]`,
        strategy: "structural",
        confidence: 85,
      });
    }

    // placeholder (for inputs)
    if (attributes["placeholder"]) {
      fallbacks.push({
        selector: `[placeholder="${attributes["placeholder"]}"]`,
        strategy: "structural",
        confidence: 80,
      });
    }

    // type attribute (for inputs)
    if (tagName === "input" && attributes["type"]) {
      fallbacks.push({
        selector: `input[type="${attributes["type"]}"]`,
        strategy: "structural",
        confidence: 60,
      });
    }
  }

  // Validate selectors in actual page
  const validFallbacks = [];

  for (const fallback of fallbacks) {
    try {
      const count = await page.locator(fallback.selector).count();
      if (count > 0) {
        validFallbacks.push({
          ...fallback,
          confidence:
            count === 1 ? fallback.confidence : fallback.confidence - 20,
        });
      }
    } catch {
      // Selector invalid, skip
    }
  }

  // Sort by confidence
  return validFallbacks.sort((a, b) => b.confidence - a.confidence);
}
