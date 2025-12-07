// Mock electron and fs before imports
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

jest.mock('fs');

import { PlaybookHandler } from '@electron/ipc/playbook.handler';
import { Playbook } from '@electron/playbook/types';
import * as fs from 'fs';
import { ipcMain } from 'electron';

const mockHandle = ipcMain.handle as jest.Mock;
const mockRemoveHandler = ipcMain.removeHandler as jest.Mock;

describe('PlaybookHandler', () => {
  const testPlaybooksDir = '/test/playbooks';
  let handler: PlaybookHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new PlaybookHandler(testPlaybooksDir);
  });

  describe('initialization', () => {
    test('should create instance with directory', () => {
      expect(handler).toBeInstanceOf(PlaybookHandler);
    });
  });

  describe('register', () => {
    test('should register all playbook handlers', () => {
      handler.register();

      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:list',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:load',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:execute',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:pause',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:resume',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:stop',
        expect.any(Function)
      );
      expect(mockHandle).toHaveBeenCalledWith(
        'playbook:userAction',
        expect.any(Function)
      );
    });
  });

  describe('unregister', () => {
    test('should remove all playbook handlers', () => {
      handler.unregister();

      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:list');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:load');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:execute');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:pause');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:resume');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:stop');
      expect(mockRemoveHandler).toHaveBeenCalledWith('playbook:userAction');
    });
  });

  describe('loadPlaybooksFromDir', () => {
    test('should return empty array if directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const playbooks = await handler.loadPlaybooksFromDir();

      expect(playbooks).toEqual([]);
    });

    test('should load playbooks from yaml files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'test.yaml',
        'other.yml',
        'readme.md',
      ]);

      // Return different IDs for each file
      let callCount = 0;
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        callCount++;
        return `
metadata:
  id: test-playbook-${callCount}
  name: Test Playbook ${callCount}
  version: '1.0.0'
  category: 기타
  difficulty: 쉬움
steps:
  - id: step1
    action: navigate
    value: https://example.com
`;
      });

      const playbooks = await handler.loadPlaybooksFromDir();

      expect(playbooks.length).toBe(2);
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPlaybooks', () => {
    test('should return empty array initially', () => {
      const playbooks = handler.getPlaybooks();
      expect(playbooks).toEqual([]);
    });
  });

  describe('IPC handlers', () => {
    test('playbook:list should return playbooks', async () => {
      handler.register();

      const listHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:list'
      )?.[1];

      const result = await listHandler();

      expect(result).toEqual({ playbooks: [] });
    });

    test('playbook:load should return error for unknown playbook', async () => {
      handler.register();

      const loadHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:load'
      )?.[1];

      const result = await loadHandler({}, 'unknown-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('playbook:pause should return success', async () => {
      handler.register();

      const pauseHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:pause'
      )?.[1];

      const result = await pauseHandler();

      expect(result.success).toBe(true);
    });

    test('playbook:resume should return success', async () => {
      handler.register();

      const resumeHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:resume'
      )?.[1];

      const result = await resumeHandler();

      expect(result.success).toBe(true);
    });

    test('playbook:stop should return success', async () => {
      handler.register();

      const stopHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:stop'
      )?.[1];

      const result = await stopHandler();

      expect(result.success).toBe(true);
    });

    test('playbook:userAction should return success', async () => {
      handler.register();

      const userActionHandler = mockHandle.mock.calls.find(
        (call) => call[0] === 'playbook:userAction'
      )?.[1];

      const result = await userActionHandler({}, { clicked: true });

      expect(result.success).toBe(true);
    });
  });
});
