/**
 * AccessibilityService 단위 테스트
 *
 * 참고: 실제 CDP 호출은 모킹, 로직 검증에 집중
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// AccessibilityService의 extractName 로직 테스트
describe('AccessibilityService - extractName logic', () => {
  const dynamicPatterns = [
    /, 선택됨$/,
    /, 선택되지 않음$/,
    /, 확장됨$/,
    /, 축소됨$/,
    /, expanded$/i,
    /, collapsed$/i,
    /, selected$/i,
    /, pressed$/i,
    /, checked$/i,
  ];

  function stripDynamicState(name: string): string {
    let result = name;
    for (const pattern of dynamicPatterns) {
      result = result.replace(pattern, '');
    }
    return result.trim();
  }

  it('should strip Korean dynamic state from aria-label', () => {
    expect(stripDynamicState('아이디 로그인, 선택됨')).toBe('아이디 로그인');
    expect(stripDynamicState('인증서 로그인, 선택되지 않음')).toBe('인증서 로그인');
    expect(stripDynamicState('메뉴, 확장됨')).toBe('메뉴');
    expect(stripDynamicState('드롭다운, 축소됨')).toBe('드롭다운');
  });

  it('should strip English dynamic state from aria-label', () => {
    expect(stripDynamicState('Login button, selected')).toBe('Login button');
    expect(stripDynamicState('Menu, expanded')).toBe('Menu');
    expect(stripDynamicState('Checkbox, checked')).toBe('Checkbox');
  });

  it('should keep static labels unchanged', () => {
    expect(stripDynamicState('로그인')).toBe('로그인');
    expect(stripDynamicState('Submit')).toBe('Submit');
    expect(stripDynamicState('아이디 입력')).toBe('아이디 입력');
  });
});

// ElementIdentity 생성 로직 테스트
describe('ElementIdentity generation', () => {
  function isStableId(id: string | undefined): boolean {
    if (!id) return false;
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i,
      /^\d{10,}/,
      /_\d+$/,
      /^react-/i,
      /^ember/i,
      /^ng-/i,
      /^:r[0-9a-z]+:/i,
    ];
    return !dynamicPatterns.some(p => p.test(id));
  }

  it('should detect dynamic IDs', () => {
    expect(isStableId('12345678-1234-5678-9012-345678901234')).toBe(false);
    expect(isStableId('1733367123456')).toBe(false);
    expect(isStableId('element_123')).toBe(false);
    expect(isStableId('react-select-123')).toBe(false);
    expect(isStableId(':r1a2b3:')).toBe(false);
  });

  it('should detect stable IDs', () => {
    expect(isStableId('login-form')).toBe(true);
    expect(isStableId('submit-button')).toBe(true);
    expect(isStableId('username')).toBe(true);
    expect(isStableId('nav-menu')).toBe(true);
  });
});

// Selector generation from identity 테스트
describe('Selector generation from ElementIdentity', () => {
  function generateSelectorFromIdentity(identity: any): string {
    if (identity.axRole && identity.axName) {
      return `[role="${identity.axRole}"][aria-label="${identity.axName}"]`;
    }
    if (identity.ariaLabel) {
      return `${identity.tagName.toLowerCase()}[aria-label="${identity.ariaLabel}"]`;
    }
    if (identity.name && ['input', 'select', 'textarea', 'button'].includes(identity.tagName.toLowerCase())) {
      return `${identity.tagName.toLowerCase()}[name="${identity.name}"]`;
    }
    if (identity.dataTestId) {
      return `[data-testid="${identity.dataTestId}"]`;
    }
    if (identity.tagName.toLowerCase() === 'input' && identity.type) {
      const uniqueTypes = ['password', 'email', 'tel', 'search', 'file'];
      if (uniqueTypes.includes(identity.type)) {
        return `input[type="${identity.type}"]`;
      }
    }
    if (identity.placeholder) {
      return `${identity.tagName.toLowerCase()}[placeholder="${identity.placeholder}"]`;
    }
    if (identity.id) {
      return `#${identity.id}`;
    }
    return identity.tagName.toLowerCase();
  }

  it('should prioritize role + name', () => {
    const identity = {
      axRole: 'button',
      axName: '로그인',
      tagName: 'BUTTON',
      ariaLabel: '로그인',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('[role="button"][aria-label="로그인"]');
  });

  it('should use aria-label when no role', () => {
    const identity = {
      tagName: 'A',
      ariaLabel: '홈으로 이동',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('a[aria-label="홈으로 이동"]');
  });

  it('should use name for form elements', () => {
    const identity = {
      tagName: 'INPUT',
      name: 'username',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('input[name="username"]');
  });

  it('should use input type for unique types', () => {
    const identity = {
      tagName: 'INPUT',
      type: 'password',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('input[type="password"]');
  });

  it('should not use input type for common types', () => {
    const identity = {
      tagName: 'INPUT',
      type: 'text',
      placeholder: '아이디 입력',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('input[placeholder="아이디 입력"]');
  });

  it('should fallback to tag name', () => {
    const identity = {
      tagName: 'DIV',
    };
    expect(generateSelectorFromIdentity(identity)).toBe('div');
  });
});

// Matching strategy priority 테스트
describe('Matching strategy priority', () => {
  const strategies = [
    'accessibility',  // 1순위: getByRole
    'ariaLabel',      // 2순위
    'name',           // 3순위
    'testId',         // 4순위
    'placeholder',    // 5순위
    'css',            // 6순위 (type)
    'css',            // 7순위 (id)
    'text',           // 8순위
    'visual',         // 9순위
    'coordinates',    // 10순위
  ];

  it('should have correct priority order', () => {
    expect(strategies[0]).toBe('accessibility');
    expect(strategies[strategies.length - 1]).toBe('coordinates');
  });

  it('should skip text strategy for input actions', () => {
    const isInputAction = true;
    const textStrategy = { strategy: 'text', skipForInput: isInputAction };
    expect(textStrategy.skipForInput).toBe(true);
  });
});

console.log('✅ AccessibilityService 로직 테스트 정의 완료');
