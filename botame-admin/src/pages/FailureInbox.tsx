import { useState, useEffect } from 'react';
import { PlaybookIssue } from '../../shared/types';


export function FailureInbox() {
    const [issues, setIssues] = useState<PlaybookIssue[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState<PlaybookIssue | null>(null);

    // Analysis State
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ selector: string, confidence: number, description: string } | null>(null);

    // Load issues on mount
    useEffect(() => {
        loadIssues();
    }, []);

    // Reset analysis when issue changes
    useEffect(() => {
        setAnalysisResult(null);
        setAnalyzing(false);
    }, [selectedIssue?.id]);

    const loadIssues = async () => {
        setLoading(true);
        try {
            // Direct invoke via existing bridge
            const data: PlaybookIssue[] = await window.electron.invoke('botame:get-issues', 'open');
            setIssues(data);
        } catch (e) {
            console.error('Failed to load issues', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedIssue) return;
        setAnalyzing(true);
        try {
            const result = await window.electron.invoke('botame:analyze-issue', selectedIssue);
            setAnalysisResult(result);
        } catch (e) {
            console.error(e);
            alert('분석 실패: ' + String(e));
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApplyFix = async () => {
        if (!selectedIssue || !analysisResult) return;

        if (!confirm(`제안된 셀렉터로 플레이북을 수정하시겠습니까?\n\n"${analysisResult.selector}"`)) {
            return;
        }

        try {
            // 1. Update Playbook File
            const patchResult = await window.electron.invoke('botame:apply-fix', selectedIssue.playbookId, selectedIssue.stepIndex, analysisResult.selector);
            if (!patchResult.success) throw new Error(patchResult.error);

            // 2. Mark Issue as Resolved
            await window.electron.invoke('botame:update-issue-status', selectedIssue.id, 'resolved', {
                fixedSelector: analysisResult.selector,
                confidence: analysisResult.confidence
            });

            alert('수정 완료! 이슈가 Resolved 처리되었습니다.');
            loadIssues();
            setSelectedIssue(null);
        } catch (e) {
            console.error(e);
            alert('적용 실패: ' + String(e));
        }
    };

    return (
        <div className="flex h-full">
            {/* Sidebar List */}
            <div className="w-1/3 border-r p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">장애 목록 (Inbox)</h2>
                    <button onClick={loadIssues} className="text-sm bg-gray-100 px-2 py-1 rounded">
                        새로고침
                    </button>
                </div>

                {loading && <p>Loading...</p>}

                <div className="space-y-2">
                    {issues.map(issue => (
                        <div
                            key={issue.id}
                            onClick={() => setSelectedIssue(issue)}
                            className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${selectedIssue?.id === issue.id ? 'border-primary bg-blue-50' : ''}`}
                        >
                            <div className="font-medium text-sm truncate">{issue.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {new Date(issue.timestamp).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Detail View */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                {selectedIssue ? (
                    <div className="bg-white p-6 rounded shadow max-w-4xl mx-auto">
                        <div className="flex justify-between items-start border-b pb-4 mb-4">
                            <div>
                                <h1 className="text-xl font-bold">{selectedIssue.title}</h1>
                                <p className="text-gray-500 text-sm mt-1">ID: {selectedIssue.id}</p>
                            </div>
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                {selectedIssue.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">에러 정보</h3>
                                <div className="bg-gray-100 p-3 rounded text-sm">
                                    <p><span className="font-medium">Type:</span> {selectedIssue.errorType}</p>
                                    <p className="mt-1"><span className="font-medium">Step:</span> {selectedIssue.stepIndex}</p>
                                    <p className="mt-2 text-red-600 break-words">{selectedIssue.description}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">타겟 정보 (Recorded)</h3>
                                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(selectedIssue.elementInfo, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* DOM Snapshot Preview (Simulated) */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">DOM Context (Partial)</h3>
                            <div className="border rounded p-3 h-48 overflow-y-auto bg-gray-50 font-mono text-xs whitespace-pre-wrap">
                                {selectedIssue.domSnapshot ? selectedIssue.domSnapshot.substring(0, 2000) + '...' : 'No Snapshot'}
                            </div>
                        </div>

                        {/* AI Analysis Result */}
                        {analysisResult && (
                            <div className="mb-6 border border-blue-200 bg-blue-50 rounded p-4 animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                                    <span>✨ AI 제안 셀렉터</span>
                                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                                        신뢰도 {Math.round(analysisResult.confidence * 100)}%
                                    </span>
                                </h3>
                                <p className="mt-2 font-mono text-sm bg-white p-2 border rounded text-green-700 font-bold select-all">
                                    {analysisResult.selector}
                                </p>
                                <p className="text-sm text-blue-700 mt-2">
                                    {analysisResult.description}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button className="px-4 py-2 border rounded hover:bg-gray-50">
                                무시 (Ignore)
                            </button>

                            {!analysisResult ? (
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                                    onClick={handleAnalyze}
                                    disabled={analyzing}
                                >
                                    {analyzing ? '분석 중...' : '🤖 AI 분석 및 복구'}
                                </button>
                            ) : (
                                <button
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 font-bold shadow-lg transform hover:scale-105 transition-all"
                                    onClick={handleApplyFix}
                                >
                                    <span>✅ 수정 사항 적용 (Apply Fix)</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <p>왼쪽 목록에서 항목을 선택하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
