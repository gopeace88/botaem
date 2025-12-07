import { VariableInterpolator } from '@electron/playbook/interpolator';

describe('VariableInterpolator', () => {
  let interpolator: VariableInterpolator;

  beforeEach(() => {
    interpolator = new VariableInterpolator();
  });

  describe('interpolate', () => {
    test('should replace single variable', () => {
      const template = 'Hello, {{name}}!';
      const variables = { name: '홍길동' };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Hello, 홍길동!');
    });

    test('should replace multiple variables', () => {
      const template = '{{year}}년 {{month}}월 {{day}}일';
      const variables = { year: '2025', month: '01', day: '30' };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('2025년 01월 30일');
    });

    test('should handle variables with underscores', () => {
      const template = 'Budget: {{budget_amount}} KRW';
      const variables = { budget_amount: '1000000' };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Budget: 1000000 KRW');
    });

    test('should leave undefined variables unchanged', () => {
      const template = '{{defined}} and {{undefined}}';
      const variables = { defined: 'value' };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('value and {{undefined}}');
    });

    test('should handle empty string values', () => {
      const template = 'Value: {{empty}}';
      const variables = { empty: '' };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Value: ');
    });

    test('should handle number values', () => {
      const template = 'Count: {{count}}';
      const variables = { count: 42 };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Count: 42');
    });

    test('should handle boolean values', () => {
      const template = 'Active: {{active}}';
      const variables = { active: true };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('Active: true');
    });

    test('should return original string if no variables', () => {
      const template = 'No variables here';
      const variables = {};

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('No variables here');
    });

    test('should handle nested object access', () => {
      const template = 'User: {{user.name}}';
      const variables = { user: { name: '김철수' } };

      const result = interpolator.interpolate(template, variables);

      expect(result).toBe('User: 김철수');
    });
  });

  describe('evaluateCondition', () => {
    test('should evaluate equality condition', () => {
      const condition = '{{status}} === "active"';
      const variables = { status: 'active' };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate inequality condition', () => {
      const condition = '{{count}} !== 0';
      const variables = { count: 5 };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate numeric comparison', () => {
      const condition = '{{amount}} > 1000';
      const variables = { amount: 5000 };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate less than condition', () => {
      const condition = '{{value}} < 100';
      const variables = { value: 50 };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate boolean variable', () => {
      const condition = '{{logged_in}} === true';
      const variables = { logged_in: true };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate AND condition', () => {
      const condition = '{{a}} === true && {{b}} === true';
      const variables = { a: true, b: true };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should evaluate OR condition', () => {
      const condition = '{{a}} === true || {{b}} === true';
      const variables = { a: false, b: true };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });

    test('should return false for undefined variables in condition', () => {
      const condition = '{{undefined_var}} === true';
      const variables = {};

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(false);
    });

    test('should handle string comparison with quotes', () => {
      const condition = '{{category}} === "교부관리"';
      const variables = { category: '교부관리' };

      const result = interpolator.evaluateCondition(condition, variables);

      expect(result).toBe(true);
    });
  });

  describe('extractVariables', () => {
    test('should extract single variable', () => {
      const template = '{{name}}';

      const result = interpolator.extractVariables(template);

      expect(result).toEqual(['name']);
    });

    test('should extract multiple variables', () => {
      const template = '{{year}}/{{month}}/{{day}}';

      const result = interpolator.extractVariables(template);

      expect(result).toEqual(['year', 'month', 'day']);
    });

    test('should return unique variables', () => {
      const template = '{{name}} is {{name}}';

      const result = interpolator.extractVariables(template);

      expect(result).toEqual(['name']);
    });

    test('should return empty array if no variables', () => {
      const template = 'No variables';

      const result = interpolator.extractVariables(template);

      expect(result).toEqual([]);
    });

    test('should handle nested variable syntax', () => {
      const template = '{{user.name}} from {{user.org}}';

      const result = interpolator.extractVariables(template);

      expect(result).toEqual(['user.name', 'user.org']);
    });
  });
});
