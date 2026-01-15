import { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateNotificationProps {
  onClose?: () => void;
}

export function UpdateNotification({ onClose }: UpdateNotificationProps) {
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Listen for update events
    const handleUpdateAvailable = (...args: unknown[]) => {
      const info = args[0] as UpdateInfo;
      console.log('[UpdateNotification] Update available:', info);
      setUpdateInfo(info);
      setShow(true);
      setMessage('새 버전이 사용 가능합니다!');
    };

    const handleUpdateDownloaded = (...args: unknown[]) => {
      const info = args[0] as UpdateInfo;
      console.log('[UpdateNotification] Update downloaded:', info);
      setUpdateDownloaded(true);
      setDownloading(false);
      setMessage('업데이트가 다운로드되었습니다. 재시작하여 설치하세요.');
    };

    const handleDownloadProgress = (...args: unknown[]) => {
      const progressInfo = args[0] as { percent: number };
      setProgress(Math.round(progressInfo.percent));
    };

    const handleUpdateError = (...args: unknown[]) => {
      const error = args[0] as string;
      console.error('[UpdateNotification] Update error:', error);
      setMessage(`업데이트 오류: ${error}`);
      setDownloading(false);
    };

    // Note: Listeners stay active for the app lifetime
    window.electron.on('autoupdate:update-available', handleUpdateAvailable);
    window.electron.on('autoupdate:update-downloaded', handleUpdateDownloaded);
    window.electron.on('autoupdate:download-progress', handleDownloadProgress);
    window.electron.on('autoupdate:update-error', handleUpdateError);

    // Check for updates on mount
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const result = await window.electron.invoke('autoupdate:check');
      if (result.updateAvailable) {
        setShow(true);
      }
    } catch (error) {
      console.error('[UpdateNotification] Check failed:', error);
    }
  };

  const downloadUpdate = async () => {
    setDownloading(true);
    setMessage('업데이트 다운로드 중...');
    setProgress(0);

    try {
      const result = await window.electron.invoke('autoupdate:download');
      if (result.success) {
        setMessage('다운로드 완료!');
      } else {
        setMessage(result.message);
        setDownloading(false);
      }
    } catch (error) {
      console.error('[UpdateNotification] Download failed:', error);
      setMessage('다운로드 실패');
      setDownloading(false);
    }
  };

  const installAndRestart = async () => {
    try {
      await window.electron.invoke('autoupdate:install');
    } catch (error) {
      console.error('[UpdateNotification] Install failed:', error);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-white rounded-lg shadow-xl border-2 border-blue-500 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-white font-semibold">업데이트 available</span>
          </div>
          <button
            onClick={() => {
              setShow(false);
              onClose?.();
            }}
            className="text-white hover:bg-white/20 rounded p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {updateInfo && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900">
                버전 {updateInfo.version}이(가) 사용 가능합니다
              </p>
              {updateInfo.releaseDate && (
                <p className="text-xs text-gray-500 mt-1">
                  릴리스: {new Date(updateInfo.releaseDate).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mb-3 p-2 rounded text-sm ${
              message.includes('오류') || message.includes('실패')
                ? 'bg-red-50 text-red-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {message}
            </div>
          )}

          {/* Progress Bar */}
          {downloading && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>다운로드 중...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!updateDownloaded && !downloading && (
              <>
                <button
                  onClick={downloadUpdate}
                  disabled={downloading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  지금 업데이트
                </button>
                <button
                  onClick={() => {
                    setShow(false);
                    onClose?.();
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  나중에
                </button>
              </>
            )}

            {updateDownloaded && (
              <button
                onClick={installAndRestart}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg shadow transition-all"
              >
                재시작하여 설치
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
