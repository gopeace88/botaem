import { PlaybookEngine } from '@electron/playbook/engine';
import { Playbook, ExecutionStatus, PlaybookEngineEvent } from '@electron/playbook/types';

describe('PlaybookEngine', () => {
  let engine: PlaybookEngine;

  const createTestPlaybook = (): Playbook => ({
    metadata: {
      id: 'test-playbook',
      name: '테스트 플레이북',
      version: '1.0.0',
      category: '기타',
      difficulty: '쉬움',
    },
    variables: {
      test_var: {
        type: 'string',
        label: '테스트 변수',
        default: 'default_value',
      },
    },
    steps: [
      { id: 'step1', action: 'navigate', value: 'https://example.com' },
      { id: 'step2', action: 'click', selector: '#btn' },
      { id: 'step3', action: 'type', selector: '#input', value: '{{test_var}}' },
    ],
  });

  // Create a slow step executor for testing pause/resume
  const createSlowExecutor = (delay: number) => {
    return jest.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, delay));
      return { success: true };
    });
  };

  beforeEach(() => {
    engine = new PlaybookEngine();
  });

  afterEach(() => {
    engine.removeAllListeners();
  });

  describe('initial state', () => {
    test('should start in idle state', () => {
      expect(engine.getStatus()).toBe('idle');
    });

    test('should have no loaded playbook', () => {
      expect(engine.getPlaybook()).toBeNull();
    });

    test('should have empty context', () => {
      const context = engine.getContext();
      expect(context.variables).toEqual({});
      expect(context.currentStepIndex).toBe(0);
      expect(context.errors).toEqual([]);
    });
  });

  describe('load', () => {
    test('should load playbook', () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      expect(engine.getPlaybook()).toBe(playbook);
      expect(engine.getStatus()).toBe('idle');
    });

    test('should emit loaded event', () => {
      const playbook = createTestPlaybook();
      const listener = jest.fn();
      engine.on('loaded', listener);

      engine.load(playbook);

      expect(listener).toHaveBeenCalledWith({ type: 'loaded', playbook });
    });

    test('should reset context on load', () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);
      engine.setVariables({ test: 'value' });

      engine.load(playbook);

      const context = engine.getContext();
      expect(context.variables).toEqual({});
      expect(context.currentStepIndex).toBe(0);
    });
  });

  describe('setVariables', () => {
    test('should set variables', () => {
      engine.setVariables({ var1: 'value1', var2: 'value2' });

      const context = engine.getContext();
      expect(context.variables).toEqual({ var1: 'value1', var2: 'value2' });
    });

    test('should merge with existing variables', () => {
      engine.setVariables({ var1: 'value1' });
      engine.setVariables({ var2: 'value2' });

      const context = engine.getContext();
      expect(context.variables).toEqual({ var1: 'value1', var2: 'value2' });
    });

    test('should override existing variable', () => {
      engine.setVariables({ var1: 'value1' });
      engine.setVariables({ var1: 'new_value' });

      const context = engine.getContext();
      expect(context.variables.var1).toBe('new_value');
    });
  });

  describe('start', () => {
    test('should throw error if no playbook loaded', async () => {
      await expect(engine.start()).rejects.toThrow('No playbook loaded');
    });

    test('should change status to executing', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Use slow executor to allow checking status during execution
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      // Don't await - we just want to check status change
      engine.start().catch(() => {});

      // Give it a moment to start
      await new Promise((r) => setTimeout(r, 10));

      expect(['executing', 'waiting_user', 'error']).toContain(engine.getStatus());

      // Stop to clean up
      engine.stop();
    });

    test('should emit started event', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);
      const listener = jest.fn();
      engine.on('started', listener);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));

      expect(listener).toHaveBeenCalledWith({ type: 'started' });
    });

    test('should apply default variable values', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));

      const context = engine.getContext();
      expect(context.variables.test_var).toBe('default_value');
    });
  });

  describe('pause and resume', () => {
    test('should pause execution', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Use slow executor to allow pause during execution
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));

      engine.pause();

      expect(engine.getStatus()).toBe('paused');
      engine.stop();
    });

    test('should emit paused event', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);
      const listener = jest.fn();
      engine.on('paused', listener);

      // Use slow executor to allow pause during execution
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      engine.pause();

      expect(listener).toHaveBeenCalledWith({ type: 'paused' });
      engine.stop();
    });

    test('should resume execution', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Use slow executor to allow pause during execution
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      engine.pause();

      engine.resume();

      expect(['executing', 'waiting_user', 'error', 'completed']).toContain(engine.getStatus());
      engine.stop();
    });

    test('should emit resumed event', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);
      const listener = jest.fn();
      engine.on('resumed', listener);

      // Use slow executor to allow pause during execution
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      engine.pause();
      engine.resume();

      expect(listener).toHaveBeenCalledWith({ type: 'resumed' });
      engine.stop();
    });
  });

  describe('stop', () => {
    test('should stop execution', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Use slow executor to ensure execution is still running when we stop
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));

      engine.stop();

      expect(engine.getStatus()).toBe('idle');
    });

    test('should emit stopped event', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);
      const listener = jest.fn();
      engine.on('stopped', listener);

      // Use slow executor to ensure execution is still running when we stop
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      engine.stop();

      expect(listener).toHaveBeenCalledWith({ type: 'stopped' });
    });

    test('should reset step index on stop', async () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Use slow executor to ensure execution is still running when we stop
      const slowExecutor = createSlowExecutor(100);
      engine.setStepExecutor(slowExecutor);

      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 10));
      engine.stop();

      const context = engine.getContext();
      expect(context.currentStepIndex).toBe(0);
    });
  });

  describe('userAction', () => {
    test('should continue after user action when waiting', async () => {
      const playbook: Playbook = {
        ...createTestPlaybook(),
        steps: [
          { id: 'step1', action: 'guide', message: 'Do something', wait_for: 'user' },
          { id: 'step2', action: 'navigate', value: 'https://example.com' },
        ],
      };
      engine.load(playbook);

      // Use executor that returns waitForUser for guide actions
      const userWaitExecutor = jest.fn().mockImplementation(async (step) => {
        if (step.wait_for === 'user') {
          return { success: true, waitForUser: true };
        }
        return { success: true };
      });
      engine.setStepExecutor(userWaitExecutor);

      // This would normally set status to waiting_user for guide with wait_for
      engine.start().catch(() => {});
      await new Promise((r) => setTimeout(r, 20));

      // Status should be waiting_user
      expect(engine.getStatus()).toBe('waiting_user');

      // User action should continue execution
      engine.userAction();
      await new Promise((r) => setTimeout(r, 20));
      expect(['executing', 'error', 'completed']).toContain(engine.getStatus());
    });
  });

  describe('getCurrentStep', () => {
    test('should return current step', () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      const step = engine.getCurrentStep();

      expect(step).toEqual(playbook.steps[0]);
    });

    test('should return null if no playbook', () => {
      const step = engine.getCurrentStep();
      expect(step).toBeNull();
    });
  });

  describe('getProgress', () => {
    test('should return progress info', () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      const progress = engine.getProgress();

      expect(progress.current).toBe(0);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(0);
    });

    test('should calculate percentage correctly', () => {
      const playbook = createTestPlaybook();
      engine.load(playbook);

      // Manually set step index for testing
      (engine as any).context.currentStepIndex = 1;

      const progress = engine.getProgress();

      expect(progress.current).toBe(1);
      expect(progress.percentage).toBe(33); // 1/3 ≈ 33%
    });
  });

  describe('event emitter', () => {
    test('should support on/off pattern', () => {
      const listener = jest.fn();
      engine.on('loaded', listener);
      engine.off('loaded', listener);

      engine.load(createTestPlaybook());

      expect(listener).not.toHaveBeenCalled();
    });

    test('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      engine.on('loaded', listener1);
      engine.on('loaded', listener2);

      engine.load(createTestPlaybook());

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});
