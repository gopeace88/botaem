import { useState, useEffect } from 'react';
import { useSupabaseStore } from '../../stores/supabase.store';
import { usePlaybookStore } from '../../stores/playbook.store';

interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const {
    connected,
    url,
    anonKey,
    isLoading,
    remotePlaybooks,
    setCredentials,
    configure,
    uploadAllPlaybooks,
    listRemotePlaybooks,
    downloadPlaybook,
    deleteRemotePlaybook,
  } = useSupabaseStore();

  const { playbooks, loadPlaybooks } = usePlaybookStore();
  const [localUrl, setLocalUrl] = useState(url);
  const [localKey, setLocalKey] = useState(anonKey);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPlaybooks();
    if (connected) {
      listRemotePlaybooks();
    }
  }, [connected]);

  const handleSaveConfig = async () => {
    setCredentials(localUrl, localKey);
    const success = await configure();
    if (success) {
      setMessage('Supabase 연결 성공!');
      listRemotePlaybooks();
    } else {
      setMessage('연결 실패. URL과 키를 확인하세요.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleUploadAll = async () => {
    const result = await uploadAllPlaybooks();
    setMessage(result.message);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDownload = async (id: string) => {
    const result = await downloadPlaybook(id);
    setMessage(result.message);
    if (result.success) {
      loadPlaybooks();
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteRemote = async (id: string, name: string) => {
    if (confirm(`"${name}" 원격 플레이북을 삭제하시겠습니까?`)) {
      const result = await deleteRemotePlaybook(id);
      setMessage(result.message);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-muted rounded" aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M10 4L6 8L10 12" strokeWidth="1.5" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Supabase Settings</h1>
        <span
          className={`ml-auto px-2 py-1 text-xs rounded ${
            connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {connected ? 'Connected' : 'Not Connected'}
        </span>
      </div>

      {/* Message */}
      {message && (
        <div className="mx-6 mt-4 p-3 bg-blue-50 text-blue-800 rounded text-sm">{message}</div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Supabase Configuration */}
        <section className="border rounded-lg p-4">
          <h2 className="font-medium mb-4">Supabase Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Supabase URL</label>
              <input
                type="url"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                Anon Key (public)
              </label>
              <input
                type="password"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                className="w-full px-3 py-2 border rounded text-sm font-mono"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={isLoading || !localUrl || !localKey}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Save & Connect'}
            </button>
          </div>
        </section>

        {/* Sync Section */}
        {connected && (
          <>
            <section className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">Local Playbooks ({playbooks.length})</h2>
                <button
                  onClick={handleUploadAll}
                  disabled={isLoading || playbooks.length === 0}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                >
                  Upload All to Supabase
                </button>
              </div>
              {playbooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No local playbooks</p>
              ) : (
                <ul className="space-y-2">
                  {playbooks.map((pb) => (
                    <li key={pb.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">{pb.name}</span>
                      <span className="text-xs text-muted-foreground">{pb.category}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium">Remote Playbooks ({remotePlaybooks.length})</h2>
                <button
                  onClick={() => listRemotePlaybooks()}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded text-sm"
                >
                  Refresh
                </button>
              </div>
              {remotePlaybooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No remote playbooks</p>
              ) : (
                <ul className="space-y-2">
                  {remotePlaybooks.map((pb) => (
                    <li
                      key={pb.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded"
                    >
                      <div>
                        <span className="text-sm font-medium">{pb.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(pb.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(pb.id)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteRemote(pb.id, pb.name)}
                          disabled={isLoading}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Database Setup Hint */}
        {!connected && (
          <section className="border rounded-lg p-4 bg-yellow-50">
            <h2 className="font-medium mb-2">Database Setup Required</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create the following table in your Supabase project:
            </p>
            <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto">
{`CREATE TABLE playbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty TEXT,
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  steps JSONB NOT NULL,
  metadata JSONB NOT NULL,
  yaml_content TEXT
);

-- Enable RLS
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (adjust for production)
CREATE POLICY "Allow all" ON playbooks
  FOR ALL USING (true);`}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
