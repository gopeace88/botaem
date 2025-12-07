import { act, renderHook } from '@testing-library/react';
import { usePlaybookStore } from '@/stores/playbook.store';
import { Playbook, ExecutionStatus } from '@electron/playbook/types';

describe('PlaybookStore', () => {
  const mockPlaybook: Playbook = {
    metadata: {
      id: 'test-playbook',
      name: '테스트 플레이북',
      version: '1.0.0',
      category: '기타',
      difficulty: '쉬움',
    },
    steps: [
      { id: 'step1', action: 'navigate', value: 'https://example.com' },
      { id: 'step2', action: 'click', selector: '#btn' },
    ],
  };

  beforeEach(() => {
    const { result } = renderHook(() => usePlaybookStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('initial state', () => {
    test('should start with no playbook', () => {
      const { result } = renderHook(() => usePlaybookStore());
      expect(result.current.playbook).toBeNull();
    });

    test('should start in idle status', () => {
      const { result } = renderHook(() => usePlaybookStore());
      expect(result.current.status).toBe('idle');
    });

    test('should start at step 0', () => {
      const { result } = renderHook(() => usePlaybookStore());
      expect(result.current.currentStepIndex).toBe(0);
    });

    test('should have empty variables', () => {
      const { result } = renderHook(() => usePlaybookStore());
      expect(result.current.variables).toEqual({});
    });
  });

  describe('loadPlaybook', () => {
    test('should load playbook', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
      });

      expect(result.current.playbook).toEqual(mockPlaybook);
    });

    test('should reset step index when loading', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setCurrentStepIndex(5);
        result.current.loadPlaybook(mockPlaybook);
      });

      expect(result.current.currentStepIndex).toBe(0);
    });

    test('should set status to idle when loading', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setStatus('executing');
        result.current.loadPlaybook(mockPlaybook);
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('execution status', () => {
    test('should update status', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setStatus('executing');
      });

      expect(result.current.status).toBe('executing');
    });

    test('should support all status values', () => {
      const { result } = renderHook(() => usePlaybookStore());
      const statuses: ExecutionStatus[] = [
        'idle',
        'executing',
        'paused',
        'waiting_user',
        'completed',
        'error',
      ];

      for (const status of statuses) {
        act(() => {
          result.current.setStatus(status);
        });
        expect(result.current.status).toBe(status);
      }
    });
  });

  describe('step management', () => {
    test('should update current step index', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.setCurrentStepIndex(1);
      });

      expect(result.current.currentStepIndex).toBe(1);
    });

    test('should get current step', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
      });

      expect(result.current.getCurrentStep()).toEqual(mockPlaybook.steps[0]);
    });

    test('should return null for current step when no playbook', () => {
      const { result } = renderHook(() => usePlaybookStore());
      expect(result.current.getCurrentStep()).toBeNull();
    });

    test('should move to next step', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.nextStep();
      });

      expect(result.current.currentStepIndex).toBe(1);
    });

    test('should move to previous step', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.setCurrentStepIndex(1);
        result.current.previousStep();
      });

      expect(result.current.currentStepIndex).toBe(0);
    });

    test('should not go below 0', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.previousStep();
      });

      expect(result.current.currentStepIndex).toBe(0);
    });
  });

  describe('variables', () => {
    test('should set variables', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setVariables({ name: 'Test', amount: 1000 });
      });

      expect(result.current.variables).toEqual({ name: 'Test', amount: 1000 });
    });

    test('should merge variables', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setVariables({ name: 'Test' });
        result.current.setVariables({ amount: 1000 });
      });

      expect(result.current.variables).toEqual({ name: 'Test', amount: 1000 });
    });

    test('should clear variables', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.setVariables({ name: 'Test' });
        result.current.clearVariables();
      });

      expect(result.current.variables).toEqual({});
    });
  });

  describe('progress', () => {
    test('should calculate progress', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.setCurrentStepIndex(1);
      });

      const progress = result.current.getProgress();
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(2);
      expect(progress.percentage).toBe(50);
    });

    test('should return 0% when no playbook', () => {
      const { result } = renderHook(() => usePlaybookStore());

      const progress = result.current.getProgress();
      expect(progress.percentage).toBe(0);
    });
  });

  describe('reset', () => {
    test('should reset all state', () => {
      const { result } = renderHook(() => usePlaybookStore());

      act(() => {
        result.current.loadPlaybook(mockPlaybook);
        result.current.setStatus('executing');
        result.current.setCurrentStepIndex(1);
        result.current.setVariables({ test: 'value' });
        result.current.reset();
      });

      expect(result.current.playbook).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.variables).toEqual({});
    });
  });
});
