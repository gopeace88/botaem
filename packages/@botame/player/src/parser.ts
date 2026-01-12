/**
 * Playbook Parser
 * @module @botame/player/parser
 */

import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { Playbook, VariableDefinition } from '@botame/types';

export class PlaybookParser {
  /**
   * Parse YAML string to Playbook object
   */
  parse(yamlContent: string): Playbook {
    let parsed: unknown;

    try {
      parsed = yaml.load(yamlContent);
    } catch (error) {
      throw new Error(
        `Invalid YAML syntax: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid playbook format: content must be an object');
    }

    const data = parsed as Record<string, unknown>;

    // Validate required fields
    if (!data.metadata) {
      throw new Error('Invalid playbook: missing required field "metadata"');
    }

    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error('Invalid playbook: missing or empty "steps" array');
    }

    // Validate metadata fields
    const metadata = data.metadata as Record<string, unknown>;
    const requiredMetadataFields = ['id', 'name', 'version'];

    for (const field of requiredMetadataFields) {
      if (!metadata[field]) {
        throw new Error(`Invalid playbook: missing required metadata field "${field}"`);
      }
    }

    // Construct Playbook object
    const playbook: Playbook = {
      metadata: {
        id: String(metadata.id),
        name: String(metadata.name),
        version: String(metadata.version),
        description: metadata.description ? String(metadata.description) : undefined,
        category: metadata.category as Playbook['metadata']['category'],
        difficulty: metadata.difficulty as Playbook['metadata']['difficulty'],
        estimatedTime: metadata.estimated_time
          ? String(metadata.estimated_time)
          : metadata.estimatedTime
            ? String(metadata.estimatedTime)
            : undefined,
        estimated_time: metadata.estimated_time
          ? String(metadata.estimated_time)
          : metadata.estimatedTime
            ? String(metadata.estimatedTime)
            : undefined,
        keywords: metadata.keywords as string[] | undefined,
        author: metadata.author ? String(metadata.author) : undefined,
        last_updated: metadata.last_updated
          ? String(metadata.last_updated)
          : metadata.updatedAt
            ? String(metadata.updatedAt)
            : undefined,
        updatedAt: metadata.updatedAt
          ? String(metadata.updatedAt)
          : metadata.last_updated
            ? String(metadata.last_updated)
            : undefined,
        startUrl: metadata.startUrl
          ? String(metadata.startUrl)
          : metadata.start_url
            ? String(metadata.start_url)
            : undefined,
        start_url: metadata.start_url
          ? String(metadata.start_url)
          : metadata.startUrl
            ? String(metadata.startUrl)
            : undefined,
        aliases: metadata.aliases as string[] | undefined,
      },
      steps: this.parseSteps(data.steps as unknown[]),
    };

    // Parse optional fields
    if (data.variables) {
      playbook.variables = this.parseVariables(data.variables as Record<string, unknown>);
    }

    if (data.preconditions && Array.isArray(data.preconditions)) {
      playbook.preconditions = data.preconditions.map((p) => {
        const precondition = p as Record<string, unknown>;
        return {
          check: String(precondition.check),
          message: String(precondition.message),
          action: precondition.action as 'warn' | 'block',
        };
      });
    }

    if (data.error_handlers && Array.isArray(data.error_handlers)) {
      playbook.error_handlers = data.error_handlers.map((h) => {
        const handler = h as Record<string, unknown>;
        return {
          match: String(handler.match),
          action: handler.action as 'retry' | 'skip' | 'abort' | 'guide',
          message: handler.message ? String(handler.message) : undefined,
        };
      });
    }

    return playbook;
  }

  /**
   * Parse YAML file to Playbook object
   */
  parseFile(filePath: string): Playbook {
    const content = readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parse steps array
   */
  private parseSteps(stepsData: unknown[]): Playbook['steps'] {
    return stepsData.map((stepData) => {
      const step = stepData as Record<string, unknown>;

      const parsedStep: Playbook['steps'][0] = {
        id: String(step.id),
        action: step.action as Playbook['steps'][0]['action'],
      };

      // Optional fields
      if (step.selector) parsedStep.selector = String(step.selector);
      if (step.value) parsedStep.value = String(step.value);
      if (step.message) parsedStep.message = String(step.message);
      if (step.wait_for) parsedStep.wait_for = step.wait_for as Playbook['steps'][0]['wait_for'];
      if (step.timeout) parsedStep.timeout = Number(step.timeout);
      if (step.optional !== undefined) parsedStep.optional = Boolean(step.optional);
      if (step.waitAfter !== undefined) parsedStep.waitAfter = Number(step.waitAfter);
      if (step.condition) parsedStep.condition = String(step.condition);
      if (step.on_error) parsedStep.on_error = step.on_error as Playbook['steps'][0]['on_error'];
      if (step.variable) parsedStep.variable = String(step.variable);

      // Nested steps
      if (step.then && Array.isArray(step.then)) {
        parsedStep.then = this.parseSteps(step.then);
      }
      if (step.else && Array.isArray(step.else)) {
        parsedStep.else = this.parseSteps(step.else);
      }
      if (step.steps && Array.isArray(step.steps)) {
        parsedStep.steps = this.parseSteps(step.steps);
      }

      return parsedStep;
    });
  }

  /**
   * Parse variables definition
   */
  private parseVariables(
    variablesData: Record<string, unknown>
  ): Record<string, VariableDefinition> {
    const variables: Record<string, VariableDefinition> = {};

    for (const [key, value] of Object.entries(variablesData)) {
      const varDef = value as Record<string, unknown>;
      variables[key] = {
        type: varDef.type as VariableDefinition['type'],
        label: String(varDef.label),
        required: varDef.required !== undefined ? Boolean(varDef.required) : undefined,
        default: varDef.default !== undefined ? String(varDef.default) : undefined,
        options: varDef.options as VariableDefinition['options'],
        validation: varDef.validation as VariableDefinition['validation'],
      };
    }

    return variables;
  }
}
