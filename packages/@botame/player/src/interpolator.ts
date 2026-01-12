/**
 * Variable Interpolator
 * @module @botame/player/interpolator
 */

/**
 * Variable Interpolator
 * Handles template variable substitution and condition evaluation
 */
export class VariableInterpolator {
  // Regex pattern for matching {{variable}} or {{object.property}} syntax
  private readonly variablePattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g;

  /**
   * Interpolate variables in a template string
   * @param template - Template string with {{variable}} placeholders
   * @param variables - Object containing variable values
   * @returns Interpolated string
   */
  interpolate(template: string, variables: Record<string, unknown>): string {
    return template.replace(this.variablePattern, (match, varName) => {
      const value = this.getNestedValue(variables, varName);

      if (value === undefined) {
        // Leave undefined variables unchanged
        return match;
      }

      return String(value);
    });
  }

  /**
   * Evaluate a condition expression with variables
   * @param condition - Condition string (e.g., "{{status}} === 'active'")
   * @param variables - Object containing variable values
   * @returns Boolean result of the condition evaluation
   */
  evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // First, interpolate variables in the condition
      const interpolated = condition.replace(this.variablePattern, (_match, varName) => {
        const value = this.getNestedValue(variables, varName);

        if (value === undefined) {
          return 'undefined';
        }

        // Return appropriate JavaScript literal
        if (typeof value === 'string') {
          return JSON.stringify(value);
        }
        if (typeof value === 'boolean' || typeof value === 'number') {
          return String(value);
        }
        if (value === null) {
          return 'null';
        }

        return JSON.stringify(value);
      });

      // Create a safe evaluation function
      // Note: In production, consider using a proper expression parser
      // instead of eval for better security
      const safeEval = new Function(`
        "use strict";
        try {
          return (${interpolated});
        } catch (e) {
          return false;
        }
      `);

      const result = safeEval();
      return Boolean(result);
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  /**
   * Extract variable names from a template string
   * @param template - Template string with {{variable}} placeholders
   * @returns Array of unique variable names
   */
  extractVariables(template: string): string[] {
    const matches = template.matchAll(this.variablePattern);
    const variables = new Set<string>();

    for (const match of matches) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Check if a string contains any template variables
   * @param text - String to check
   * @returns True if the string contains variables
   */
  hasVariables(text: string): boolean {
    return this.variablePattern.test(text);
  }

  /**
   * Get nested value from an object using dot notation
   * @param obj - Source object
   * @param path - Property path (e.g., "user.name")
   * @returns Value at the path or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');

    let current: unknown = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Interpolate all string values in a step object
   * @param step - Step object with potential template strings
   * @param variables - Variables for interpolation
   * @returns New step object with interpolated values
   */
  interpolateStep<T extends Record<string, unknown>>(
    step: T,
    variables: Record<string, unknown>
  ): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(step)) {
      if (typeof value === 'string') {
        result[key] = this.interpolate(value, variables);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return this.interpolateStep(item as Record<string, unknown>, variables);
          }
          if (typeof item === 'string') {
            return this.interpolate(item, variables);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateStep(value as Record<string, unknown>, variables);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }
}
