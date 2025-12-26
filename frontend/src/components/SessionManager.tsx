import { useState, useEffect } from 'react';
import {
  History,
  Star,
  StarOff,
  Trash2,
  Download,
  FileJson,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Layers,
  ExternalLink
} from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';
import { API_BASE } from '../lib/api';

interface SessionSummary {
  id: string;
  task: string;
  status: string;
  final_score: number | null;
  iteration_count: number;
  created_at: string;
  starred: boolean;
  tags: string[];
}

export function SessionManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const {
    sessionId,
    task,
    context,
    iterations,
    finalOutput,
    finalScore,
    config,
    setTask,
    setContext,
    setSessionId,
    setStatus,
    clearIterations
  } = useReasoningStore();

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchSessions();
    }
  }, [isExpanded]);

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
      setSessions(sessions.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleLoadSession = async (id: string) => {
    if (id === sessionId) return;

    try {
      const response = await fetch(`${API_BASE}/reasoning/${id}`);
      if (!response.ok) throw new Error('Failed to load session');

      const session = await response.json();

      clearIterations();
      setTask(session.task || '');
      setContext(session.context || '');
      setSessionId(session.id, false);
      setStatus(session.status || 'completed');

      const store = useReasoningStore.getState();
      if (session.iterations && session.iterations.length > 0) {
        session.iterations.forEach((iter: any, index: number) => {
          store.startGeneration(index);
          store.completeGeneration(iter.generation || '');
          if (iter.critique) {
            store.completeCritique(iter.critique);
          }
        });
      }

      if (session.final_output) {
        store.completeSession(session.final_output, session.final_score || 0);
      }

      setIsExpanded(false);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const handleExportMarkdown = () => {
    if (!task || !finalOutput) return;

    const markdown = `# ReasonLoop Session

## Task
${task}

${context ? `## Context\n${context}\n` : ''}

## Iterations

${iterations.map((iter, i) => `
### Iteration ${i + 1}

**Generation:**
${iter.generation}

**Critique:** (Score: ${iter.critique?.score?.toFixed(1) || 'N/A'}/10)
${iter.critique?.raw_critique || 'No critique available'}
`).join('\n---\n')}

## Final Output (Score: ${finalScore?.toFixed(1) || 'N/A'}/10)

${finalOutput}

---
*Exported from ReasonLoop*
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reasonloop-${sessionId?.slice(0, 8) || 'session'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const data = {
      sessionId,
      task,
      context,
      config,
      iterations: iterations.map(iter => ({
        number: iter.number,
        generation: iter.generation,
        critique: iter.critique,
      })),
      finalOutput,
      finalScore,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reasonloop-${sessionId?.slice(0, 8) || 'session'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const canExport = task && (finalOutput || iterations.length > 0);

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-text-muted';
    if (score >= 8) return 'text-teal';
    if (score >= 6) return 'text-amber';
    return 'text-rose';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-teal/10 text-teal border-teal/20';
      case 'running':
        return 'bg-amber/10 text-amber border-amber/20';
      case 'error':
        return 'bg-rose/10 text-rose border-rose/20';
      default:
        return 'bg-background-tertiary text-text-muted border-border-subtle';
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center">
            <History className="w-4 h-4 text-violet" />
          </div>
          <span className="font-semibold text-text-primary">Session History</span>
          {sessions.length > 0 && (
            <span className="tag tag-violet">{sessions.length}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Export Current Session */}
          {canExport && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-text-muted" />
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Export Current</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-background-tertiary/50 border border-border-subtle hover:border-violet/30 hover:bg-violet/5 transition-all duration-200 text-sm font-medium text-text-secondary"
                >
                  <FileText className="w-4 h-4 text-violet" />
                  <span>Markdown</span>
                </button>
                <button
                  onClick={handleExportJson}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-background-tertiary/50 border border-border-subtle hover:border-teal/30 hover:bg-teal/5 transition-all duration-200 text-sm font-medium text-text-secondary"
                >
                  <FileJson className="w-4 h-4 text-teal" />
                  <span>JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* Session List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-text-muted" />
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Recent Sessions</label>
              </div>
              <button
                onClick={fetchSessions}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-background-tertiary/50 transition-colors"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px]">Refresh</span>}
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-background-tertiary/50 flex items-center justify-center mx-auto mb-3">
                  <History className="w-6 h-6 text-text-ghost" />
                </div>
                <p className="text-sm text-text-muted">No saved sessions yet</p>
                <p className="text-xs text-text-ghost mt-1">Complete a reasoning task to see it here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleLoadSession(session.id)}
                    className={`
                      group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer
                      ${session.id === sessionId
                        ? 'border-amber/40 bg-amber/5 shadow-sm shadow-amber/10'
                        : 'border-border-subtle bg-background-tertiary/30 hover:border-border-medium hover:bg-background-tertiary/50'
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {session.id === sessionId && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber via-amber-light to-amber rounded-t-xl" />
                    )}

                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-text-primary line-clamp-2 flex-1 font-medium leading-snug">
                        {session.task}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {session.id === sessionId && (
                          <span className="text-[9px] text-amber bg-amber/10 px-1.5 py-0.5 rounded font-medium">ACTIVE</span>
                        )}
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 rounded-lg text-text-ghost hover:text-rose hover:bg-rose/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-text-muted">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.created_at)}
                      </span>
                      <span className="text-text-ghost">•</span>
                      <span className="text-text-muted">{session.iteration_count} iterations</span>
                      {session.final_score && (
                        <>
                          <span className="text-text-ghost">•</span>
                          <span className={`font-mono font-medium ${getScoreColor(session.final_score)}`}>
                            {session.final_score.toFixed(1)}/10
                          </span>
                        </>
                      )}
                      <span className={`
                        ml-auto px-2 py-0.5 rounded-full text-[9px] uppercase font-medium border
                        ${getStatusStyle(session.status)}
                      `}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
