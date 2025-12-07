import { PlaybookValidator } from '@electron/playbook/validator';
import { Playbook } from '@electron/playbook/types';

describe('PlaybookValidator', () => {
  let validator: PlaybookValidator;

  beforeEach(() => {
    validator = new PlaybookValidator();
  });

  const createValidPlaybook = (): Playbook => ({
    metadata: {
      id: 'test-playbook',
      name: '테스트 플레이북',
      version: '1.0.0',
      category: '기타',
      difficulty: '쉬움',
    },
    steps: [
      {
        id: 'step1',
        action: 'navigate',
        value: 'https://example.com',
      },
    ],
  });

  describe('validate', () => {
    test('should return valid for correct playbook', () => {
      const playbook = createValidPlaybook();
      const result = validator.validate(playbook);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate metadata fields', () => {
      const playbook = createValidPlaybook();
      // @ts-expect-error: Testing invalid data
      playbook.metadata.id = '';

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate step action types', () => {
      const playbook = createValidPlaybook();
      // @ts-expect-error: Testing invalid data
      playbook.steps[0].action = 'invalid_action';

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('action'))).toBe(true);
    });

    test('should validate required selector for click action', () => {
      const playbook = createValidPlaybook();
      playbook.steps[0] = {
        id: 'step1',
        action: 'click',
        // Missing selector
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('selector'))).toBe(true);
    });

    test('should validate required selector for type action', () => {
      const playbook = createValidPlaybook();
      playbook.steps[0] = {
        id: 'step1',
        action: 'type',
        value: 'test',
        // Missing selector
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });

    test('should validate required value for navigate action', () => {
      const playbook = createValidPlaybook();
      playbook.steps[0] = {
        id: 'step1',
        action: 'navigate',
        // Missing value (URL)
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });

    test('should validate category enum', () => {
      const playbook = createValidPlaybook();
      // @ts-expect-error: Testing invalid data
      playbook.metadata.category = 'invalid_category';

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });

    test('should validate difficulty enum', () => {
      const playbook = createValidPlaybook();
      // @ts-expect-error: Testing invalid data
      playbook.metadata.difficulty = 'invalid';

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });

    test('should validate nested then/else steps', () => {
      const playbook = createValidPlaybook();
      playbook.steps[0] = {
        id: 'step1',
        action: 'condition',
        condition: '{{test}} === true',
        then: [
          {
            id: 'step1-1',
            action: 'click',
            selector: '#btn',
          },
        ],
        else: [
          {
            id: 'step1-2',
            // @ts-expect-error: Testing invalid data
            action: 'invalid',
          },
        ],
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });

    test('should validate variable definitions', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        test_var: {
          type: 'string',
          label: '테스트 변수',
          required: true,
        },
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(true);
    });

    test('should validate variable type enum', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        test_var: {
          // @ts-expect-error: Testing invalid data
          type: 'invalid_type',
          label: '테스트',
        },
      };

      const result = validator.validate(playbook);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateVariables', () => {
    test('should validate required variables are provided', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        required_var: {
          type: 'string',
          label: '필수 변수',
          required: true,
        },
        optional_var: {
          type: 'string',
          label: '선택 변수',
        },
      };

      const result = validator.validateVariables(playbook, {});

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'required_var')).toBe(true);
    });

    test('should pass when required variables are provided', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        required_var: {
          type: 'string',
          label: '필수 변수',
          required: true,
        },
      };

      const result = validator.validateVariables(playbook, {
        required_var: 'test value',
      });

      expect(result.valid).toBe(true);
    });

    test('should validate variable type', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        num_var: {
          type: 'number',
          label: '숫자 변수',
          required: true,
        },
      };

      const result = validator.validateVariables(playbook, {
        num_var: 'not a number',
      });

      expect(result.valid).toBe(false);
    });

    test('should use default values for missing optional variables', () => {
      const playbook = createValidPlaybook();
      playbook.variables = {
        optional_var: {
          type: 'string',
          label: '선택 변수',
          default: 'default_value',
        },
      };

      const result = validator.validateVariables(playbook, {});

      expect(result.valid).toBe(true);
    });
  });
});
