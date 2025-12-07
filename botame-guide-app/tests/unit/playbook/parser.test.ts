import { PlaybookParser } from '@electron/playbook/parser';
import { Playbook } from '@electron/playbook/types';

describe('PlaybookParser', () => {
  let parser: PlaybookParser;

  beforeEach(() => {
    parser = new PlaybookParser();
  });

  describe('parse', () => {
    test('should parse valid YAML playbook', () => {
      const yaml = `
metadata:
  id: budget-register
  name: 예산 등록
  version: "1.0.0"
  description: 신규 예산을 등록하는 방법을 안내합니다
  category: 교부관리
  difficulty: 보통
  estimated_time: 5분

variables:
  budget_year:
    type: string
    label: 예산연도
    required: true
    default: "2025"

steps:
  - id: step1
    action: navigate
    value: https://botame.go.kr/budget
    message: 예산 관리 페이지로 이동합니다
`;

      const result = parser.parse(yaml);

      expect(result.metadata.id).toBe('budget-register');
      expect(result.metadata.name).toBe('예산 등록');
      expect(result.metadata.category).toBe('교부관리');
      expect(result.variables).toBeDefined();
      expect(result.variables?.budget_year.type).toBe('string');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action).toBe('navigate');
    });

    test('should parse playbook with multiple steps', () => {
      const yaml = `
metadata:
  id: test-playbook
  name: 테스트 플레이북
  version: "1.0.0"
  category: 기타
  difficulty: 쉬움

steps:
  - id: step1
    action: navigate
    value: https://example.com
  - id: step2
    action: click
    selector: "#login-btn"
  - id: step3
    action: type
    selector: "#username"
    value: "{{username}}"
`;

      const result = parser.parse(yaml);

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].action).toBe('navigate');
      expect(result.steps[1].action).toBe('click');
      expect(result.steps[1].selector).toBe('#login-btn');
      expect(result.steps[2].action).toBe('type');
      expect(result.steps[2].value).toBe('{{username}}');
    });

    test('should parse playbook with preconditions', () => {
      const yaml = `
metadata:
  id: test-playbook
  name: 테스트
  version: "1.0.0"
  category: 기타
  difficulty: 쉬움

preconditions:
  - check: "{{logged_in}} === true"
    message: 로그인이 필요합니다
    action: block

steps:
  - id: step1
    action: navigate
    value: https://example.com
`;

      const result = parser.parse(yaml);

      expect(result.preconditions).toHaveLength(1);
      expect(result.preconditions?.[0].action).toBe('block');
    });

    test('should parse playbook with error handlers', () => {
      const yaml = `
metadata:
  id: test-playbook
  name: 테스트
  version: "1.0.0"
  category: 기타
  difficulty: 쉬움

error_handlers:
  - match: "timeout"
    action: retry
    message: 시간 초과. 다시 시도합니다.
  - match: "element not found"
    action: skip
    message: 요소를 찾을 수 없습니다. 다음 단계로 진행합니다.

steps:
  - id: step1
    action: navigate
    value: https://example.com
`;

      const result = parser.parse(yaml);

      expect(result.error_handlers).toHaveLength(2);
      expect(result.error_handlers?.[0].action).toBe('retry');
      expect(result.error_handlers?.[1].action).toBe('skip');
    });

    test('should parse playbook with conditional steps', () => {
      const yaml = `
metadata:
  id: test-playbook
  name: 테스트
  version: "1.0.0"
  category: 기타
  difficulty: 쉬움

steps:
  - id: step1
    action: condition
    condition: "{{has_budget}} === true"
    then:
      - id: step1-1
        action: click
        selector: "#edit-btn"
    else:
      - id: step1-2
        action: click
        selector: "#create-btn"
`;

      const result = parser.parse(yaml);

      expect(result.steps[0].action).toBe('condition');
      expect(result.steps[0].then).toHaveLength(1);
      expect(result.steps[0].else).toHaveLength(1);
    });

    test('should throw error for invalid YAML', () => {
      const invalidYaml = `
metadata:
  id: test
  invalid yaml content
    nested: wrong
`;

      expect(() => parser.parse(invalidYaml)).toThrow();
    });

    test('should throw error for missing metadata', () => {
      const yaml = `
steps:
  - id: step1
    action: navigate
    value: https://example.com
`;

      expect(() => parser.parse(yaml)).toThrow('metadata');
    });

    test('should throw error for missing steps', () => {
      const yaml = `
metadata:
  id: test-playbook
  name: 테스트
  version: "1.0.0"
  category: 기타
  difficulty: 쉬움
`;

      expect(() => parser.parse(yaml)).toThrow('steps');
    });
  });

  describe('parseFile', () => {
    test('should be defined', () => {
      expect(parser.parseFile).toBeDefined();
    });
  });
});
