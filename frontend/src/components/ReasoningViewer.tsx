import { useEffect, useRef, useState } from 'react';
import { Copy, Check, RotateCcw, Square, Loader2, MessageSquare, Send, X, PenLine, Sparkles, Trophy, Download, Pause, Play, WifiOff } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';
import { useReasoningWebSocket } from '../hooks/useWebSocket';
import { stopReasoning, startReasoning, injectFeedback, pauseReasoning, resumeReasoning } from '../lib/api';
import { IterationCard } from './IterationCard';
import type { Iteration } from '../stores/reasoningStore';

// Helper to format model name for display
function formatModelName(modelId: string): string {
  if (!modelId) return 'Unknown Model';
  const parts = modelId.split('/');
  return parts.length > 1 ? `${parts[0].toUpperCase()} ${parts[1]}` : modelId;
}

// Generate markdown export of the full reasoning process
function generateMarkdownExport(
  task: string,
  context: string,
  iterations: Iteration[],
  finalOutput: string | null,
  finalScore: number | null
): string {
  const now = new Date().toISOString();
  let md = `# ReasonLoop Session Export\n\n`;
  md += `**Generated:** ${now}\n\n`;
  md += `---\n\n`;

  // Task
  md += `## 📋 Task\n\n`;
  md += `${task}\n\n`;

  // Context (if any)
  if (context) {
    md += `## 📝 Context Provided\n\n`;
    md += `${context}\n\n`;
  }

  md += `---\n\n`;
  md += `## 🔄 Reasoning Process\n\n`;

  // Each iteration (filter out undefined entries from sparse arrays)
  iterations.filter(Boolean).forEach((iteration) => {
    const iterLabel = iteration.number < 0 ? 'Council Phase' : `Iteration ${iteration.number + 1}`;
    md += `### ${iterLabel}\n\n`;

    // Generation
    md += `#### 💡 ${iteration.number < 0 ? 'Council Synthesis' : 'Generation'}\n`;
    md += `**Model:** ${formatModelName(iteration.generation_model)}\n\n`;
    md += `${iteration.generation || ''}\n\n`;

    // Critique
    if (iteration.critique) {
      md += `#### 🔍 Critique & Analysis\n`;
      md += `**Model:** ${formatModelName(iteration.critique_model)}\n`;
      md += `**Score:** ${iteration.critique.score.toFixed(1)}/10\n\n`;

      if (iteration.critique.strengths.length > 0) {
        md += `**Strengths:**\n`;
        iteration.critique.strengths.forEach(s => {
          md += `- ${s}\n`;
        });
        md += `\n`;
      }

      if (iteration.critique.weaknesses.length > 0) {
        md += `**Weaknesses:**\n`;
        iteration.critique.weaknesses.forEach(w => {
          md += `- ${w}\n`;
        });
        md += `\n`;
      }

      if (iteration.critique.suggestions.length > 0) {
        md += `**Suggestions:**\n`;
        iteration.critique.suggestions.forEach(s => {
          md += `- ${s}\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n\n`;
  });

  // Final Output
  if (finalOutput) {
    md += `## 🏆 Final Output\n\n`;
    if (finalScore !== null) {
      md += `**Final Score:** ${finalScore.toFixed(1)}/10\n\n`;
    }
    md += `${finalOutput}\n\n`;
  }

  md += `---\n\n`;
  md += `*Exported from [ReasonLoop](https://github.com/MaartenRischen/ReasonLoop) - AI Reasoning Engine*\n`;

  return md;
}

// Trigger download of markdown file
function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReasoningViewer() {
  const {
    sessionId,
    status,
    iterations,
    finalOutput,
    finalScore,
    task,
    context,
    config,
    needsWebSocket,
    reset,
    setSessionId,
    setStatus,
    clearIterations,
  } = useReasoningStore();

  const [copied, setCopied] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [showInjectInput, setShowInjectInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [injectText, setInjectText] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Network connectivity detection - auto pause/resume
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Auto-resume if was paused due to network
      if (sessionId && status === 'paused') {
        try {
          await resumeReasoning(sessionId);
          setStatus('running');
        } catch (err) {
          console.error('Failed to auto-resume:', err);
        }
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      // Auto-pause if running
      if (sessionId && status === 'running') {
        try {
          await pauseReasoning(sessionId);
          setStatus('paused');
        } catch (err) {
          console.error('Failed to auto-pause:', err);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionId, status, setStatus]);

  const shouldConnectWs = needsWebSocket && (status === 'idle' || status === 'running');
  useReasoningWebSocket(sessionId, shouldConnectWs);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [iterations, finalOutput]);

  useEffect(() => {
    if (status === 'completed' || status === 'stopped') {
      setIsRetrying(false);
    }
  }, [status]);

  const handleCopy = async () => {
    if (finalOutput) {
      await navigator.clipboard.writeText(finalOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const markdown = generateMarkdownExport(task, context, iterations, finalOutput, finalScore);
    const timestamp = new Date().toISOString().slice(0, 10);
    const taskSlug = task.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadMarkdown(markdown, `reasonloop-${taskSlug}-${timestamp}.md`);
  };

  const handleStop = async () => {
    if (sessionId) {
      // Immediately update UI state
      setStatus('stopped');
      try {
        await stopReasoning(sessionId);
      } catch (err) {
        console.error('Failed to stop session:', err);
      }
    }
  };

  const handlePause = async () => {
    if (sessionId) {
      setStatus('paused');
      try {
        await pauseReasoning(sessionId);
      } catch (err) {
        console.error('Failed to pause session:', err);
        setStatus('running'); // Revert on error
      }
    }
  };

  const handleResume = async () => {
    if (sessionId) {
      setStatus('running');
      try {
        await resumeReasoning(sessionId);
      } catch (err) {
        console.error('Failed to resume session:', err);
        setStatus('paused'); // Revert on error
      }
    }
  };

  const handleInjectClick = () => setShowInjectInput(true);

  const handleInjectSubmit = async () => {
    if (!sessionId || !injectText.trim()) return;
    setIsInjecting(true);
    try {
      await injectFeedback(sessionId, injectText.trim());
      setInjectText('');
      setShowInjectInput(false);
    } catch (err) {
      console.error('Failed to inject feedback:', err);
    } finally {
      setIsInjecting(false);
    }
  };

  const handleInjectCancel = () => {
    setShowInjectInput(false);
    setInjectText('');
  };

  const handleRetryClick = () => setShowFeedbackInput(true);

  const handleRetryWithFeedback = async () => {
    if (!task) return;
    setIsRetrying(true);
    setShowFeedbackInput(false);
    setStatus('running');

    const retryContext = `
PREVIOUS ATTEMPT (REJECTED):
${finalOutput}

${feedback ? `USER FEEDBACK:\n${feedback}\n` : 'The user rejected this output without specific feedback. Try a significantly different or improved approach.'}

ORIGINAL CONTEXT:
${context || 'None provided'}
`.trim();

    try {
      clearIterations();
      const response = await startReasoning({
        task: task,
        context: retryContext,
        config: config,
      });
      setSessionId(response.session_id, true);
      setFeedback('');
    } catch (err) {
      console.error('Failed to retry:', err);
      setStatus('error');
      setIsRetrying(false);
    }
  };

  const handleCancelFeedback = () => {
    setShowFeedbackInput(false);
    setFeedback('');
  };

  const handleNewSession = () => {
    setIsRetrying(false);
    setShowFeedbackInput(false);
    setFeedback('');
    reset();
  };

  const getScoreClass = (score: number) => {
    if (score >= 8) return 'score-high';
    if (score >= 6) return 'score-medium';
    return 'score-low';
  };

  // Empty state
  if (!sessionId && iterations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        {/* Decorative icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber/20 to-amber/5 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-amber" />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-amber/10 blur-2xl -z-10" />
        </div>

        <h3 className="text-xl font-semibold text-text-primary mb-2">
          Ready to Reason
        </h3>
        <p className="text-text-muted max-w-md leading-relaxed">
          Enter a task in the panel on the left and click "Start Reasoning" to begin.
          Watch as AI iteratively generates, critiques, and refines responses in real-time.
        </p>

        {/* Process visualization */}
        <div className="flex items-center gap-4 mt-8">
          {['Generate', 'Critique', 'Refine'].map((step, i) => (
            <div key={step} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  ${i === 0 ? 'bg-amber/10 text-amber' : i === 1 ? 'bg-rose/10 text-rose' : 'bg-teal/10 text-teal'}
                `}>
                  <span className="font-mono text-sm font-bold">{i + 1}</span>
                </div>
                <span className="text-xs text-text-muted mt-2">{step}</span>
              </div>
              {i < 2 && (
                <div className="w-8 h-px bg-gradient-to-r from-border-medium to-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet/20 to-violet/5 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Reasoning Process</h2>
            <p className="text-xs text-text-muted">
              {iterations.length} iteration{iterations.length !== 1 ? 's' : ''} completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Network status indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose/10 border border-rose/20 text-rose text-sm">
              <WifiOff className="w-4 h-4" />
              Offline
            </div>
          )}

          {status === 'running' && (
            <>
              <button
                onClick={handleInjectClick}
                disabled={showInjectInput}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber/10 border border-amber/20 text-amber text-sm font-medium hover:bg-amber/15 transition-colors disabled:opacity-50"
              >
                <PenLine className="w-4 h-4" />
                Inject
              </button>
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet/10 border border-violet/20 text-violet text-sm font-medium hover:bg-violet/15 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose/10 border border-rose/20 text-rose text-sm font-medium hover:bg-rose/15 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal/10 border border-teal/20 text-teal text-sm font-medium hover:bg-teal/15 transition-colors"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose/10 border border-rose/20 text-rose text-sm font-medium hover:bg-rose/15 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
          {(status === 'completed' || status === 'stopped' || status === 'error') && (
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-elevated border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-medium hover:text-text-primary transition-colors"
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Iterations List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
        {iterations.filter(Boolean).map((iteration, index, filteredArr) => (
          <IterationCard
            key={`${sessionId}-${iteration.number}`}
            iteration={iteration}
            isLatest={index === filteredArr.length - 1 && status === 'running'}
          />
        ))}

        {/* Running indicator */}
        {status === 'running' && iterations.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-amber animate-spin" />
                <div className="absolute inset-0 bg-amber/20 blur-xl rounded-full" />
              </div>
              <span className="text-text-secondary font-medium">
                {isRetrying ? 'Retrying with new approach...' : 'Initializing reasoning session...'}
              </span>
            </div>
          </div>
        )}

        {/* Paused indicator */}
        {status === 'paused' && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet/10 border border-violet/20">
              <Pause className="w-5 h-5 text-violet" />
              <span className="text-violet font-medium">
                {!isOnline ? 'Paused (offline) - will resume when connection restored' : 'Paused - click Resume to continue'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Inject Feedback Panel */}
      {showInjectInput && status === 'running' && (
        <div className="mt-4 rounded-xl bg-gradient-to-br from-amber/5 to-transparent border border-amber/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="w-5 h-5 text-amber" />
            <span className="font-semibold text-text-primary">Inject Human Feedback</span>
            <button onClick={handleInjectCancel} className="ml-auto p-1 hover:bg-background-tertiary rounded-lg transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Your feedback will influence the next refinement iteration.
          </p>
          <textarea
            value={injectText}
            onChange={(e) => setInjectText(e.target.value)}
            placeholder="e.g., 'Focus more on practical examples' or 'The tone should be more formal'"
            className="w-full h-20 rounded-lg bg-background/60 border border-border-subtle text-text-primary placeholder:text-text-muted px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber/50"
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInjectSubmit}
              disabled={!injectText.trim() || isInjecting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber text-background font-medium text-sm hover:bg-amber-hover transition-colors disabled:opacity-50"
            >
              {isInjecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Inject
            </button>
            <button onClick={handleInjectCancel} className="px-4 py-2 rounded-lg bg-background-tertiary text-text-secondary text-sm hover:text-text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Retry Feedback Panel */}
      {showFeedbackInput && (
        <div className="mt-4 rounded-xl bg-gradient-to-br from-rose/5 to-transparent border border-rose/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-rose" />
            <span className="font-semibold text-text-primary">What should be improved?</span>
            <button onClick={handleCancelFeedback} className="ml-auto p-1 hover:bg-background-tertiary rounded-lg transition-colors">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional: Describe what's wrong or what you'd like to see improved..."
            className="w-full h-24 rounded-lg bg-background/60 border border-border-subtle text-text-primary placeholder:text-text-muted px-3 py-2 text-sm resize-none focus:outline-none focus:border-rose/50"
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleRetryWithFeedback}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose text-white font-medium text-sm hover:bg-rose-light transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {feedback.trim() ? 'Retry with Feedback' : 'Retry Anyway'}
            </button>
            <button onClick={handleCancelFeedback} className="px-4 py-2 rounded-lg bg-background-tertiary text-text-secondary text-sm hover:text-text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Final Output */}
      {(status === 'completed' || status === 'stopped') && finalOutput && !showFeedbackInput && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-teal/10 to-teal/5 border border-teal/20 overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="px-5 py-4 border-b border-teal/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-teal" />
              </div>
              <div>
                <span className="font-semibold text-teal">Final Output</span>
                {finalScore !== null && (
                  <div className={`mt-1 inline-flex ml-3 score-pill ${getScoreClass(finalScore)}`}>
                    {finalScore.toFixed(1)}/10
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 border border-border-subtle text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-teal" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet/10 border border-violet/20 text-violet text-sm font-medium hover:bg-violet/15 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Full Log
              </button>
              <button
                onClick={handleRetryClick}
                disabled={isRetrying}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose/10 border border-rose/20 text-rose text-sm font-medium hover:bg-rose/15 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Not Good Enough
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="rounded-xl bg-background/40 border border-border-subtle p-4 max-h-96 overflow-y-auto">
              <pre className="font-mono text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {finalOutput}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
