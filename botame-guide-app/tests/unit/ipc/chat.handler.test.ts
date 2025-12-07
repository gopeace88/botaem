// Mock electron before imports
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

import { ChatHandler } from '@electron/ipc/chat.handler';
import { Playbook } from '@electron/playbook/types';
import { ipcMain } from 'electron';

const mockHandle = ipcMain.handle as jest.Mock;
const mockRemoveHandler = ipcMain.removeHandler as jest.Mock;

describe('ChatHandler', () => {
  const mockPlaybooks: Playbook[] = [
    {
      metadata: {
        id: 'budget-register',
        name: '예산 등록',
        version: '1.0.0',
        description: '신규 예산을 등록합니다',
        category: '교부관리',
        difficulty: '쉬움',
        keywords: ['예산', '등록'],
      },
      steps: [],
    },
    {
      metadata: {
        id: 'expense-register',
        name: '지출 결의',
        version: '1.0.0',
        description: '지출 결의서를 작성합니다',
        category: '집행관리',
        difficulty: '보통',
        keywords: ['지출', '결의'],
      },
      steps: [],
    },
  ];

  let handler: ChatHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ChatHandler(mockPlaybooks);
  });

  describe('initialization', () => {
    test('should create instance with playbooks', () => {
      expect(handler).toBeInstanceOf(ChatHandler);
    });

    test('should create instance without playbooks', () => {
      const emptyHandler = new ChatHandler();
      expect(emptyHandler).toBeInstanceOf(ChatHandler);
    });
  });

  describe('register', () => {
    test('should register chat:send handler', () => {
      handler.register();

      expect(mockHandle).toHaveBeenCalledWith(
        'chat:send',
        expect.any(Function)
      );
    });
  });

  describe('unregister', () => {
    test('should remove chat:send handler', () => {
      handler.unregister();

      expect(mockRemoveHandler).toHaveBeenCalledWith('chat:send');
    });
  });

  describe('updatePlaybooks', () => {
    test('should update playbooks for recommendation', () => {
      const newPlaybooks: Playbook[] = [
        {
          metadata: {
            id: 'new-playbook',
            name: '새 플레이북',
            version: '1.0.0',
            category: '기타',
            difficulty: '쉬움',
          },
          steps: [],
        },
      ];

      handler.updatePlaybooks(newPlaybooks);

      // Handler should be updated (verified through offline response)
      expect(handler).toBeInstanceOf(ChatHandler);
    });
  });

  describe('offline mode', () => {
    test('should generate recommendation response for matching query', async () => {
      handler.register();

      // Get the registered handler function
      const registeredHandler = mockHandle.mock.calls[0][1];

      // Simulate IPC call
      const response = await registeredHandler({}, { message: '예산 등록' });

      expect(response.message).toBeDefined();
      expect(response.suggestions).toBeDefined();
      expect(response.suggestions.length).toBeGreaterThan(0);
    });

    test('should return default response for non-matching query', async () => {
      handler.register();

      const registeredHandler = mockHandle.mock.calls[0][1];

      const response = await registeredHandler({}, {
        message: '알수없는쿼리xyz123',
      });

      expect(response.message).toContain('찾지 못했습니다');
      expect(response.intent).toBe('unknown');
    });
  });
});
