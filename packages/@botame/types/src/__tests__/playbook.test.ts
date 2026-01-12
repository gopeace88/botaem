import { describe, it, expect } from 'vitest';
import { Playbook, PlaybookStep } from '../playbook';

describe('Playbook Types', () => {
  it('should create valid playbook step', () => {
    const step: PlaybookStep = {
      id: 'step-1',
      action: 'click',
      selector: '[data-testid="submit"]',
      message: 'Click submit button',
    };
    expect(step.id).toBe('step-1');
    expect(step.action).toBe('click');
  });

  it('should create valid playbook', () => {
    const playbook: Playbook = {
      metadata: {
        id: 'pb-1',
        name: 'Test Playbook',
        version: '1.0.0',
      },
      steps: [{
        id: 'step-1',
        action: 'navigate',
        value: 'https://example.com',
      }],
    };
    expect(playbook.metadata.id).toBe('pb-1');
    expect(playbook.steps.length).toBe(1);
  });
});