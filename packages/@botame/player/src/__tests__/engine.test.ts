import { describe, it, expect, vi } from 'vitest';
import { PlaybookEngine } from '../engine';
import { Playbook, ExecutionContext } from '@botame/types';

describe('PlaybookEngine', () => {
  it('should load playbook', () => {
    const engine = new PlaybookEngine();
    const playbook: Playbook = {
      metadata: { id: 'pb-1', name: 'Test', version: '1.0.0' },
      steps: [{
        id: 'step-1',
        action: 'navigate',
        value: 'https://example.com',
      }],
    };
    engine.load(playbook);
    expect(engine.getStatus()).toBe('idle');
  });
});