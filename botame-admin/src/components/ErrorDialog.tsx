import { useState, useEffect } from 'react';

interface ErrorDialogProps {
  onClose?: () => void;
}

interface ErrorEvent {
  message: string;
  recoverable: boolean;
  code: string;
}

export function ErrorDialog({ onClose }: ErrorDialogProps) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<ErrorEvent | null>(null);

  useEffect(() => {
    const handleError = (...args: unknown[]) => {
      const errorEvent = args[0] as ErrorEvent;
      console.log('[ErrorDialog] Error occurred:', errorEvent);
      setError(errorEvent);
      setShow(true);
    };

    window.electron.on('error:occurred', handleError);

    return () => {
      // Note: Listener stays active
    };
  }, []);

  if (!show || !error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${
          error.recoverable ? 'bg-yellow-500' : 'bg-red-500'
        }`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              {error.recoverable ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-bold text-white">
              {error.recoverable ? '경고' : '오류'}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-800 mb-4">{error.message}</p>

          {/* Error Code */}
          <div className="bg-gray-100 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">에러 코드</span>
              <span className="text-xs font-mono font-semibold text-gray-800">{error.code}</span>
            </div>
          </div>

          {/* Solution */}
          {error.recoverable && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">해결 방법</h3>
              <ul className="text-xs text-blue-800 space-y-1">
                {getSolutionSteps(error.code)}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShow(false);
                onClose?.();
              }}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              확인
            </button>
            
            {error.recoverable && (
              <button
                onClick={() => {
                  setShow(false);
                  onClose?.();
                }}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>

          {/* Copy Logs */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(error, null, 2));
            }}
            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            에러 정보 복사
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get solution steps based on error code
 */
function getSolutionSteps(code: string): JSX.Element[] {
  const solutions: Record<string, string[]> = {
    OFFLINE_ERROR: [
      '인터넷 연결을 확인해주세요',
      '네트워크 케이블을 다시 연결해보세요',
      'WiFi를 끄고 다시 켜보세요',
    ],
    VALIDATION_ERROR: [
      '입력값을 다시 확인해주세요',
      '필수 필드가 모두 채워졌는지 확인하세요',
      '파일 형식이 올바른지 확인하세요',
    ],
    NETWORK_ERROR: [
      '인터넷 연결을 확인해주세요',
      '서비스가 일시적으로 중단되었을 수 있습니다',
      '잠시 후 다시 시도해주세요',
    ],
    AUTH_ERROR: [
      'API Key를 다시 설정해주세요',
      '설정에서 API Key를 확인하세요',
      '새로운 API Key를 발급받으세요',
    ],
    BROWSER_ERROR: [
      '브라우저를 다시 시작해주세요',
      '페이지를 새로고침해보세요',
      '다른 브라우저에서 시도해보세요',
    ],
    PLAYBOOK_ERROR: [
      '플레이북 파일을 다시 확인해주세요',
      '선택자가 올바른지 확인하세요',
      '관리자에게 문의하세요',
    ],
    SELECTOR_ERROR: [
      '선택자를 다시 생성해주세요',
      '자동 고침 기능을 사용해보세요',
      '수동으로 요소를 선택해주세요',
    ],
  };

  const steps = solutions[code] || ['관리자에게 문의하세요', '자세한 내용은 로그를 확인해주세요'];

  return steps.map((step, index) => (
    <li key={index}>{step}</li>
  ));
}
