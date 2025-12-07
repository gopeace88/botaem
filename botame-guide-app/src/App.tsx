import React, { useEffect, useCallback, useRef, useState } from 'react';
import { ChatContainer } from '@/components/chat';
import { RecordingPanel } from '@/components/recording';
import { useChatStore } from '@/stores/chat.store';
import { usePlaybookStore } from '@/stores/playbook.store';
import { useRecordingStore } from '@/stores/recording.store';
import { QuickReply, PlaybookSuggestion } from '@/types/chat.types';

function App() {
  const {
    messages,
    isTyping,
    startSession,
    sendUserMessage,
    sendAssistantMessage,
    sendSuggestionMessage,
    sendQuickReplyMessage,
    setTyping,
  } = useChatStore();

  const { status: playbookStatus, setStatus } = usePlaybookStore();
  const { state: recordingState } = useRecordingStore();
  const isWaitingForUser = useRef(false);
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);

  // Initialize session on mount
  useEffect(() => {
    startSession();

    // Welcome message
    setTimeout(() => {
      sendAssistantMessage('안녕하세요! 보탬e 가이드 어시스턴트입니다. 무엇을 도와드릴까요?');
      sendSuggestionMessage('자주 사용하는 기능을 선택하세요:', [
        {
          playbookId: 'budget-register',
          title: '예산 등록',
          description: '신규 예산을 등록합니다',
          category: '교부관리',
          difficulty: '쉬움',
          estimatedTime: '5분',
        },
        {
          playbookId: 'expense-register',
          title: '지출 결의',
          description: '지출 결의서를 작성합니다',
          category: '집행관리',
          difficulty: '보통',
          estimatedTime: '10분',
        },
      ]);
    }, 500);
  }, []);

  // Subscribe to playbook events
  useEffect(() => {
    // Handle waiting for user input
    const unsubWaitingUser = window.electron.on('playbook:waiting-user', (data: unknown) => {
      const event = data as { message?: string; stepIndex?: number };
      isWaitingForUser.current = true;
      setStatus('paused');

      // Show step message with confirmation button
      sendQuickReplyMessage(
        event.message || '다음 단계를 진행하시겠습니까?',
        [
          { id: 'confirm', label: '확인', value: 'confirm' },
          { id: 'cancel', label: '취소', value: 'cancel' },
        ]
      );
    });

    // Handle playbook completed
    const unsubCompleted = window.electron.on('playbook:completed', () => {
      isWaitingForUser.current = false;
      setStatus('idle');
      sendAssistantMessage('플레이북이 완료되었습니다!');
    });

    // Handle playbook error
    const unsubError = window.electron.on('playbook:error', (data: unknown) => {
      const event = data as { error?: { message?: string } };
      isWaitingForUser.current = false;
      setStatus('idle');
      sendAssistantMessage(`오류가 발생했습니다: ${event.error?.message || '알 수 없는 오류'}`);
    });

    // Handle step changes
    const unsubStepChanged = window.electron.on('playbook:step-changed', (data: unknown) => {
      const event = data as { step?: { message?: string }; stepIndex?: number };
      if (event.step?.message && !isWaitingForUser.current) {
        sendAssistantMessage(event.step.message);
      }
    });

    return () => {
      unsubWaitingUser();
      unsubCompleted();
      unsubError();
      unsubStepChanged();
    };
  }, [sendAssistantMessage, sendQuickReplyMessage, setStatus]);

  // Handle sending message
  const handleSendMessage = useCallback(async (message: string) => {
    sendUserMessage(message);
    setTyping(true);

    try {
      // Send to backend via IPC
      const response = await window.electron.invoke('chat:send', { message });
      setTyping(false);

      if (response && typeof response === 'object' && 'message' in response) {
        const chatResponse = response as { message: string; suggestions?: PlaybookSuggestion[] };

        // If response has suggestions, use sendSuggestionMessage to properly render them
        if (chatResponse.suggestions && chatResponse.suggestions.length > 0) {
          sendSuggestionMessage(chatResponse.message, chatResponse.suggestions);
        } else {
          sendAssistantMessage(chatResponse.message);
        }
      }
    } catch (error) {
      setTyping(false);
      sendAssistantMessage('죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [sendUserMessage, setTyping, sendAssistantMessage, sendSuggestionMessage]);

  // Handle quick reply click
  const handleQuickReplyClick = useCallback(async (reply: QuickReply) => {
    // If waiting for playbook user input, handle it differently
    if (isWaitingForUser.current) {
      isWaitingForUser.current = false;

      if (reply.value === 'confirm') {
        // User confirmed - continue playbook execution
        sendUserMessage('확인');
        await window.electron.invoke('playbook:userAction', { action: 'confirm' });
      } else if (reply.value === 'cancel') {
        // User cancelled - stop playbook
        sendUserMessage('취소');
        await window.electron.invoke('playbook:stop');
        sendAssistantMessage('플레이북 실행이 취소되었습니다.');
      }
      return;
    }

    // Normal quick reply - send as chat message
    handleSendMessage(reply.value);
  }, [handleSendMessage, sendUserMessage, sendAssistantMessage]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(async (suggestion: PlaybookSuggestion) => {
    sendUserMessage(`${suggestion.title} 시작`);
    setTyping(true);

    try {
      await window.electron.invoke('playbook:load', suggestion.playbookId);
      await window.electron.invoke('playbook:execute');
      setTyping(false);
      sendAssistantMessage(`${suggestion.title}을(를) 시작합니다. 화면의 안내를 따라주세요.`);
    } catch (error) {
      setTyping(false);
      sendAssistantMessage('플레이북을 시작하는 중 오류가 발생했습니다.');
    }
  }, [sendUserMessage, setTyping, sendAssistantMessage]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title Bar (Frameless window controls) */}
      <header className="flex items-center justify-between h-10 px-4 bg-primary text-primary-foreground select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="text-sm font-medium">보탬e 가이드</span>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* Recording Button */}
          <button
            onClick={() => setShowRecordingPanel(!showRecordingPanel)}
            className={`w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded ${
              recordingState === 'recording' ? 'text-red-400 animate-pulse' : ''
            }`}
            aria-label="녹화"
            title="플레이북 녹화"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="7" cy="7" r="6" fill={recordingState === 'recording' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={() => window.electron.invoke('window:minimize')}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"
            aria-label="최소화"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.electron.invoke('window:maximize')}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"
            aria-label="최대화"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={() => window.electron.invoke('window:close')}
            className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded"
            aria-label="닫기"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content - Chat or Recording Panel */}
      <main className="flex-1 overflow-hidden">
        {showRecordingPanel ? (
          <RecordingPanel onClose={() => setShowRecordingPanel(false)} />
        ) : (
          <ChatContainer
            messages={messages}
            onSendMessage={handleSendMessage}
            onQuickReplyClick={handleQuickReplyClick}
            onSuggestionClick={handleSuggestionClick}
            isTyping={isTyping}
            disabled={playbookStatus === 'executing'}
            placeholder="메시지를 입력하세요..."
          />
        )}
      </main>

      {/* Status Bar */}
      <footer className="h-6 px-4 flex items-center justify-between text-xs text-muted-foreground border-t">
        <span>v1.0.0</span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${playbookStatus === 'executing' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
          {playbookStatus === 'executing' ? '실행 중' : '대기'}
        </span>
      </footer>
    </div>
  );
}

export default App;
