import { useState } from 'react';

interface ApiKeySetupProps {
  onComplete: () => void;
}

export function ApiKeySetup({ onComplete }: ApiKeySetupProps) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    anthropic?: 'valid' | 'invalid' | 'pending';
    supabase?: 'valid' | 'invalid' | 'pending';
  }>({});
  const [message, setMessage] = useState('');

  const validateAnthropicKey = (key: string): boolean => {
    return key.startsWith('sk-ant-') && key.length > 20;
  };

  const validateSupabaseKey = (key: string): boolean => {
    return key.startsWith('eyJ') && key.length > 50;
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationStatus({});
    setMessage('');

    // Anthropic key validation
    if (anthropicKey.trim()) {
      const isAnthropicValid = validateAnthropicKey(anthropicKey);
      setValidationStatus(prev => ({
        ...prev,
        anthropic: isAnthropicValid ? 'valid' : 'invalid',
      }));
    }

    // Supabase key validation
    if (supabaseUrl.trim() && supabaseKey.trim()) {
      const isSupabaseValid = validateSupabaseKey(supabaseKey);
      setValidationStatus(prev => ({
        ...prev,
        supabase: isSupabaseValid ? 'valid' : 'invalid',
      }));
    }

    setValidating(false);
  };

  const handleSave = async () => {
    setValidating(true);
    setMessage('');

    try {
      // Store credentials via IPC
      const results = await Promise.allSettled([
        window.electron.invoke('credentials:set', 'anthropic', anthropicKey),
        supabaseUrl && supabaseKey
          ? window.electron.invoke('credentials:set', 'supabase', supabaseKey)
          : Promise.resolve({ success: true }),
      ]);

      const allSuccess = results.every(
        result => result.status === 'fulfilled' && result.value.success
      );

      if (allSuccess) {
        setMessage('API Key가 저장되었습니다!');
        setTimeout(() => onComplete(), 1500);
      } else {
        setMessage('저장에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      setMessage(`오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setValidating(false);
    }
  };

  const canProceed = () => {
    const hasAnthropic = anthropicKey.trim().length > 0;
    const hasSupabase = supabaseUrl.trim().length > 0 && supabaseKey.trim().length > 0;
    return hasAnthropic || hasSupabase;
  };

  const getStatusIcon = (status?: 'valid' | 'invalid' | 'pending') => {
    switch (status) {
      case 'valid':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'invalid':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">환영합니다!</h1>
          <p className="text-gray-600">보탬e 가이드를 시작하기 위해 API Key를 설정해주세요</p>
        </div>

        {/* API Key Inputs */}
        <div className="space-y-6">
          {/* Anthropic API Key */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Anthropic API Key</label>
              <div className="flex items-center gap-2">
                {getStatusIcon(validationStatus.anthropic)}
                <button
                  type="button"
                  onClick={() => setShowKeys(!showKeys)}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {showKeys ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      숨기기
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      표시
                    </>
                  )}
                </button>
              </div>
            </div>
            <input
              type={showKeys ? 'text' : 'password'}
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              AI 가이드 기능에 사용됩니다.{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline"
              >
                Anthropic Console에서 발급받기
              </a>
            </p>
          </div>

          {/* Supabase Credentials */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Supabase Credentials</label>
              {getStatusIcon(validationStatus.supabase)}
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
              <input
                type={showKeys ? 'text' : 'password'}
                value={supabaseKey}
                onChange={e => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              플레이북 다운로드에 사용됩니다 (선택사항)
            </p>
          </div>

          {/* Validation Button */}
          <button
            onClick={handleValidate}
            disabled={validating || !canProceed()}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? '검증 중...' : '유효성 검사'}
          </button>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg text-center ${
                message.includes('성공') || message.includes('저장되었습니다')
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={validating || !canProceed()}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? '저장 중...' : '저장하고 시작하기'}
          </button>

          {/* Skip Link */}
          <button
            onClick={onComplete}
            className="w-full py-3 text-gray-600 hover:text-gray-800 text-sm"
          >
            나중에 설정하기
          </button>
        </div>
      </div>
    </div>
  );
}
