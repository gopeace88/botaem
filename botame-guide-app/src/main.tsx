import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Browser mock for testing without Electron
if (typeof window !== 'undefined' && !window.electron) {
  window.electron = {
    invoke: async (channel: string, ...args: unknown[]) => {
      console.log('[Mock IPC]', channel, args);

      // Simulate chat handler responses
      if (channel === 'chat:send') {
        const request = args[0] as { message: string };
        const lowerMessage = request.message.toLowerCase();

        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

        if (lowerMessage.includes('예산') || lowerMessage.includes('budget')) {
          return { message: '예산 관련 업무를 도와드리겠습니다. 예산 등록, 예산 조회, 예산 변경 중 어떤 작업을 원하시나요?', intent: 'ask_help' };
        }
        if (lowerMessage.includes('지출') || lowerMessage.includes('결의')) {
          return { message: '지출 결의 업무를 도와드리겠습니다. 지출 결의서 작성을 시작하시겠습니까?', intent: 'ask_help' };
        }
        if (lowerMessage.includes('도움') || lowerMessage.includes('help') || lowerMessage.includes('안녕')) {
          return { message: '안녕하세요! 보탬e 가이드입니다. 예산 등록, 지출 결의, 정산 보고 등의 업무를 도와드립니다.', intent: 'greeting' };
        }
        return { message: `"${request.message}"에 대해 이해했습니다. 더 구체적인 업무명을 입력해 주세요.`, intent: 'unknown' };
      }

      // Window controls (no-op in browser)
      if (channel.startsWith('window:')) {
        console.log('[Mock] Window control:', channel);
        return;
      }

      // Playbook operations
      if (channel === 'playbook:load') {
        return { success: true };
      }
      if (channel === 'playbook:execute') {
        return { success: true };
      }

      return null;
    },
    on: () => () => {},
    off: () => {},
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
