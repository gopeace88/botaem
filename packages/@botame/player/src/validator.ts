/**
 * Playbook Validator
 * @module @botame/player/validator
 */

import Ajv, { ErrorObject } from 'ajv';
import {
  Playbook,
  PlaybookStep,
  ValidationResult,
  ValidationError,
  VariableDefinition,
} from '@botame/types';

// JSON Schema for Playbook validation
const playbookSchema = {
  type: 'object',
  required: ['metadata', 'steps'],
  properties: {
    metadata: {
      type: 'object',
      required: ['id', 'name', 'version'],
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', minLength: 1 },
        description: { type: 'string' },
        category: {
          type: 'string',
        },
        difficulty: {
          type: 'string',
          enum: ['쉬움', '보통', '어려움'],
        },
        estimated_time: { type: 'string' },
        estimatedTime: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        author: { type: 'string' },
        last_updated: { type: 'string' },
        updatedAt: { type: 'string' },
        startUrl: { type: 'string' },
        start_url: { type: 'string' },
        aliases: { type: 'array', items: { type: 'string' } },
      },
    },
    variables: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['type', 'label'],
        properties: {
          type: {
            type: 'string',
            enum: ['string', 'number', 'date', 'select', 'boolean'],
          },
          label: { type: 'string', minLength: 1 },
          required: { type: 'boolean' },
          default: { type: 'string' },
          options: {
            oneOf: [
              { type: 'array', items: { type: 'string' } },
              {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['value', 'label'],
                  properties: {
                    value: { type: 'string' },
                    label: { type: 'string' },
                  },
                },
              },
            ],
          },
          validation: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              minLength: { type: 'number' },
              maxLength: { type: 'number' },
              pattern: { type: 'string' },
            },
          },
        },
      },
    },
    preconditions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['check', 'message', 'action'],
        properties: {
          check: { type: 'string' },
          message: { type: 'string' },
          action: { type: 'string', enum: ['warn', 'block'] },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/step' },
    },
    error_handlers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['match', 'action'],
        properties: {
          match: { type: 'string' },
          action: { type: 'string', enum: ['retry', 'skip', 'abort', 'guide'] },
          message: { type: 'string' },
        },
      },
    },
  },
  $defs: {
    step: {
      type: 'object',
      required: ['id', 'action'],
      properties: {
        id: { type: 'string', minLength: 1 },
        action: {
          type: 'string',
          enum: [
            'navigate',
            'click',
            'type',
            'select',
            'wait',
            'assert',
            'highlight',
            'guide',
            'condition',
            'loop',
            'extract',
            'validate',
            'scroll',
            'hover',
          ],
        },
        selector: { type: 'string' },
        value: { type: 'string' },
        message: { type: 'string' },
        wait_for: {
          type: 'string',
          enum: ['element', 'navigation', 'network', 'user', 'user_input'],
        },
        timeout: { type: 'number', minimum: 0 },
        optional: { type: 'boolean' },
        waitAfter: { type: 'number', minimum: 0 },
        condition: { type: 'string' },
        on_error: { type: 'string', enum: ['retry', 'skip', 'abort'] },
        variable: { type: 'string' },
        then: { type: 'array', items: { $ref: '#/$defs/step' } },
        else: { type: 'array', items: { $ref: '#/$defs/step' } },
        steps: { type: 'array', items: { $ref: '#/$defs/step' } },
      },
    },
  },
};

// Actions that require selector
const SELECTOR_REQUIRED_ACTIONS = ['click', 'type', 'select', 'highlight', 'assert'];

// Actions that require value
const VALUE_REQUIRED_ACTIONS = ['navigate', 'type'];

export class PlaybookValidator {
  private ajv: Ajv;
  private validateSchema: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validateSchema = this.ajv.compile(playbookSchema);
  }

  /**
   * Validate playbook structure against schema
   */
  validate(playbook: Playbook): ValidationResult {
    const errors: ValidationError[] = [];

    // Schema validation
    const valid = this.validateSchema(playbook);

    if (!valid && this.validateSchema.errors) {
      errors.push(...this.convertAjvErrors(this.validateSchema.errors));
    }

    // Additional semantic validations
    errors.push(...this.validateStepRequirements(playbook.steps));

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate that provided variables match definitions
   */
  validateVariables(
    playbook: Playbook,
    providedVariables: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (!playbook.variables) {
      return { valid: true, errors: [] };
    }

    for (const [name, definition] of Object.entries(playbook.variables)) {
      const value = providedVariables[name];
      const hasValue = value !== undefined && value !== null && value !== '';
      const hasDefault = definition.default !== undefined;

      // Check required
      if (definition.required && !hasValue && !hasDefault) {
        errors.push({
          path: name,
          message: `Required variable "${name}" is missing`,
          keyword: 'required',
        });
        continue;
      }

      // Skip validation if no value and not required
      if (!hasValue) continue;

      // Type validation
      const typeError = this.validateVariableType(name, value, definition);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert AJV errors to ValidationError format
   */
  private convertAjvErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map((err) => ({
      path: err.instancePath || err.schemaPath,
      message: err.message || 'Validation error',
      keyword: err.keyword,
    }));
  }

  /**
   * Validate step-specific requirements
   */
  private validateStepRequirements(
    steps: PlaybookStep[],
    pathPrefix = 'steps'
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    steps.forEach((step, index) => {
      const path = `${pathPrefix}[${index}]`;

      // Check selector requirement
      if (SELECTOR_REQUIRED_ACTIONS.includes(step.action) && !step.selector) {
        errors.push({
          path: `${path}.selector`,
          message: `Action "${step.action}" requires a selector`,
          keyword: 'required',
        });
      }

      // Check value requirement
      if (VALUE_REQUIRED_ACTIONS.includes(step.action) && !step.value) {
        // type action can use variable instead of value
        if (step.action === 'type' && step.variable) {
          // OK, using variable
        } else {
          errors.push({
            path: `${path}.value`,
            message: `Action "${step.action}" requires a value`,
            keyword: 'required',
          });
        }
      }

      // Check condition requirement for condition action
      if (step.action === 'condition' && !step.condition) {
        errors.push({
          path: `${path}.condition`,
          message: 'Action "condition" requires a condition expression',
          keyword: 'required',
        });
      }

      // Validate nested steps
      if (step.then) {
        errors.push(...this.validateStepRequirements(step.then, `${path}.then`));
      }
      if (step.else) {
        errors.push(...this.validateStepRequirements(step.else, `${path}.else`));
      }
      if (step.steps) {
        errors.push(...this.validateStepRequirements(step.steps, `${path}.steps`));
      }
    });

    return errors;
  }

  /**
   * Validate variable type
   */
  private validateVariableType(
    name: string,
    value: unknown,
    definition: VariableDefinition
  ): ValidationError | null {
    switch (definition.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return {
            path: name,
            message: `Variable "${name}" must be a number`,
            keyword: 'type',
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return {
            path: name,
            message: `Variable "${name}" must be a boolean`,
            keyword: 'type',
          };
        }
        break;

      case 'date':
        if (isNaN(Date.parse(String(value)))) {
          return {
            path: name,
            message: `Variable "${name}" must be a valid date`,
            keyword: 'type',
          };
        }
        break;

      case 'select':
        if (definition.options) {
          const validValues = Array.isArray(definition.options)
            ? definition.options.map((o) => (typeof o === 'string' ? o : o.value))
            : [];
          if (!validValues.includes(String(value))) {
            return {
              path: name,
              message: `Variable "${name}" must be one of: ${validValues.join(', ')}`,
              keyword: 'enum',
            };
          }
        }
        break;

      case 'string':
      default:
        // String type accepts anything
        break;
    }

    return null;
  }
}
