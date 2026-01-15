/**
 * Guide App MCP Server - Model Context Protocol server for 보탬e AI Guide Assistant
 *
 * Provides tools for:
 * - Reading playbook YAML files
 * - Listing available playbooks
 * - Getting playbook recommendations
 * - Checking browser status
 *
 * @module guide-mcp
 */

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { Playbook } from "@botame/types";
import { RecommendationService } from "../services/recommendation.service";

/**
 * Type for the MCP server instance
 */
export type GuideMcpServerInstance = ReturnType<typeof createSdkMcpServer>;

/**
 * Options for creating the Guide MCP server
 */
export interface GuideMcpServerOptions {
  recommendationService: RecommendationService;
  playbooks?: Playbook[];
}

/**
 * Create the Guide MCP server with custom tools
 *
 * @param options - Server configuration options
 * @returns Configured MCP server instance
 */
export function createGuideMcpServer(
  options: GuideMcpServerOptions,
): GuideMcpServerInstance {
  const { recommendationService, playbooks } = options;

  return createSdkMcpServer({
    name: "guide",
    version: "1.0.0",
    tools: [
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
          playbookId: z
            .string()
            .describe(
              "Playbook ID (e.g., auto-login, budget-register, member-info)",
            ),
        },
        async (args) => {
          try {
            // Find playbook by ID
            const playbook = playbooks?.find(
              (p) => p.metadata.id === args.playbookId,
            );

            if (!playbook) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error: Playbook not found with ID: ${args.playbookId}`,
                  },
                ],
              };
            }

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
       * Returns a list of all available playbooks with metadata
       * (name, description, step count, etc.).
       */
      tool(
        "list_playbooks",
        "List all available playbooks. Returns playbook names, descriptions, step counts, categories, and IDs. Use this to discover what playbooks are available before recommending one.",
        {
          category: z
            .string()
            .optional()
            .describe(
              "Filter playbooks by category (e.g., 사용자지원, 예산관리, 지출관리)",
            ),
        },
        async (args) => {
          try {
            if (!playbooks || playbooks.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No playbooks available",
                  },
                ],
              };
            }

            // Filter by category if specified
            let filteredPlaybooks = playbooks;
            if (args.category) {
              filteredPlaybooks = playbooks.filter(
                (p) => p.metadata.category === args.category,
              );
            }

            if (filteredPlaybooks.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: args.category
                      ? `No playbooks found in category: ${args.category}`
                      : "No playbooks available",
                  },
                ],
              };
            }

            // Format playbook list
            const formatted = filteredPlaybooks
              .map(
                (p) =>
                  `- **${p.metadata.name}** (ID: ${p.metadata.id})${
                    p.metadata.category ? ` [${p.metadata.category}]` : ""
                  }\n  설명: ${p.metadata.description || "N/A"}\n  단계 수: ${
                    p.steps?.length || 0
                  }`,
              )
              .join("\n\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `사용 가능한 플레이북 ${filteredPlaybooks.length}개:\n\n${formatted}`,
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
       * Get playbook recommendation
       *
       * Analyzes user query and recommends relevant playbooks.
       */
      tool(
        "recommend_playbook",
        "Get playbook recommendations based on user query. Analyzes the query and returns the most relevant playbooks with confidence scores and match reasons.",
        {
          query: z
            .string()
            .describe(
              "User query to analyze (e.g., '예산 등록 방법', '회원정보 조회')",
            ),
          limit: z
            .number()
            .optional()
            .describe(
              "Maximum number of recommendations to return (default: 5)",
            ),
        },
        async (args) => {
          try {
            const result = recommendationService.recommend({
              query: args.query,
              limit: args.limit || 5,
            });

            if (result.recommendations.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No matching playbooks found for query: "${args.query}"`,
                  },
                ],
              };
            }

            // Format recommendations
            const formatted = result.recommendations
              .map(
                (r) =>
                  `- **${r.title}** (ID: ${r.playbookId})\n  설명: ${r.description}\n  신뢰도: ${Math.round(
                    r.confidence * 100,
                  )}%${r.matchReason ? `\n  매칭 이유: ${r.matchReason}` : ""}`,
              )
              .join("\n\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `"${args.query}"에 대한 플레이북 추천 ${result.recommendations.length}개:\n\n${formatted}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error getting recommendations: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                },
              ],
            };
          }
        },
      ),

      /**
       * Get browser state
       *
       * Returns current browser status including connection state, URL,
       * and whether the browser is ready for playbook execution.
       */
      tool(
        "get_browser_state",
        "Check the current browser state. Returns connection status, current URL, and whether browser is ready. Note: This is a simplified version for the guide app.",
        {},
        async () => {
          try {
            // Guide app doesn't directly control browser, but can report state
            // This is a placeholder for future integration
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      status: "browser_integration_pending",
                      message:
                        "Browser state checking will be available when guide app integrates with player service",
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error checking browser state: ${
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
 * Format playbook for display
 */
function formatPlaybook(playbook: Playbook): string {
  const lines: string[] = [];

  lines.push("# 플레이북");
  lines.push("");
  lines.push(`## ${playbook.metadata.name}`);
  lines.push(`**버전:** ${playbook.metadata.version}`);
  lines.push(`**ID:** ${playbook.metadata.id}`);
  lines.push(`**카테고리:** ${playbook.metadata.category || "분류 없음"}`);
  lines.push(`**난이도:** ${playbook.metadata.difficulty || "미지정"}`);
  lines.push("");

  if (playbook.metadata.description) {
    lines.push("### 설명");
    lines.push(playbook.metadata.description);
    lines.push("");
  }

  if (playbook.metadata.startUrl || playbook.metadata.start_url) {
    lines.push(
      `**시작 URL:** ${playbook.metadata.startUrl || playbook.metadata.start_url}`,
    );
    lines.push("");
  }

  if (playbook.metadata.aliases && playbook.metadata.aliases.length > 0) {
    lines.push("**별칭:**");
    lines.push(playbook.metadata.aliases.map((a) => `- ${a}`).join("\n"));
    lines.push("");
  }

  if (playbook.metadata.keywords && playbook.metadata.keywords.length > 0) {
    lines.push("**키워드:**");
    lines.push(playbook.metadata.keywords.map((k) => `- ${k}`).join("\n"));
    lines.push("");
  }

  lines.push(`**총 단계 수:** ${playbook.steps.length}`);
  lines.push("");

  lines.push("## 단계");
  lines.push("");

  playbook.steps.forEach((step, index) => {
    lines.push(`${index + 1}. **${step.action}** - ${step.message || step.id}`);

    if (step.selector) {
      lines.push(`   셀렉터: \`${step.selector}\``);
    }

    if (step.selectors && step.selectors.length > 0) {
      lines.push(
        `   셀렉터들: ${step.selectors.map((s) => `\`${s.value}\``).join(", ")}`,
      );
    }

    if (step.value) {
      lines.push(`   값: \`${step.value}\``);
    }

    if (step.timeout) {
      lines.push(`   타임아웃: ${step.timeout}ms`);
    }

    if (step.optional) {
      lines.push(`   선택적: true`);
    }

    lines.push("");
  });

  return lines.join("\n");
}
