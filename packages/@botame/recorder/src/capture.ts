/**
 * Action Capture Module
 * @module @botame/recorder/capture
 */

import {
  ActionCapture,
  CDPEvent,
  Playbook,
  RecordedAction,
  ActionType,
  PlaybookMetadata,
} from "@botame/types";

export class Recorder {
  private recording = false;
  private actions: ActionCapture[] = [];
  private startTime = 0;

  start(): void {
    this.recording = true;
    this.actions = [];
    this.startTime = Date.now();
  }

  recordAction(cdpEvent: CDPEvent): ActionCapture {
    if (!this.recording) {
      throw new Error("Recorder is not started");
    }

    // Extract action info from CDP event
    const capture: ActionCapture = {
      action: this.extractActionType(cdpEvent),
      timestamp: Date.now() - this.startTime,
      primarySelector: (cdpEvent.selector as string) || "",
      fallbackSelectors: [],
      identity: cdpEvent.identity as any,
      clickX: cdpEvent.clickX as number | undefined,
      clickY: cdpEvent.clickY as number | undefined,
    };

    this.actions.push(capture);
    return capture;
  }

  generatePlaybook(metadata?: Partial<PlaybookMetadata>): Playbook {
    return {
      metadata: {
        id: metadata?.id || `playbook-${Date.now()}`,
        name: metadata?.name || "Recorded Playbook",
        version: metadata?.version || "1.0.0",
        description: metadata?.description,
        category: metadata?.category,
        difficulty: metadata?.difficulty,
        keywords: metadata?.keywords,
        createdAt: metadata?.createdAt || new Date().toISOString(),
        startUrl: metadata?.startUrl,
      },
      steps: this.actions.map((action, index) => ({
        id: `step-${index}`,
        action: action.action,
        selector: action.primarySelector,
        selectors: action.fallbackSelectors,
      })),
    };
  }

  stop(): RecordedAction[] {
    this.recording = false;
    return this.actions.map((action) => ({
      type: action.action,
      selector: action.primarySelector,
      selectors: action.fallbackSelectors,
      timestamp: action.timestamp,
      clickX: action.clickX,
      clickY: action.clickY,
    }));
  }

  private extractActionType(cdpEvent: CDPEvent): ActionType {
    // Determine action type from CDP event
    const type = cdpEvent.type as string;

    if (type.includes("click")) return "click";
    if (type.includes("type") || type.includes("input")) return "type";
    if (type.includes("navigate")) return "navigate";
    if (type.includes("select")) return "select";

    return "click" as ActionType; // Default
  }
}
