import { useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';
import { startReasoning } from '../lib/api';

export function TaskInput() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { task, context, contextFiles, setTask, setSessionId, status, config } = useReasoningStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim() || isSubmitting || status === 'running') return;

    setIsSubmitting(true);
    try {
      const response = await startReasoning({
        task: task.trim(),
        context: context.trim() || undefined,
        context_files: contextFiles.length > 0 ? contextFiles : undefined,
        config,
      });
      // Set session ID and immediately set status to running
      // (WebSocket will confirm with session_started event)
      setSessionId(response.session_id, true);
      useReasoningStore.getState().setStatus('running');
    } catch (err) {
      console.error('Failed to start reasoning:', err);
      useReasoningStore.getState().setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = !task.trim() || isSubmitting || status === 'running';
  const charCount = task.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Textarea Container */}
      <div className="relative">
        <div
          className={`
            relative rounded-xl transition-all duration-300
            ${isFocused
              ? 'ring-2 ring-amber/30 shadow-lg shadow-amber/10'
              : ''
            }
          `}
        >
          <textarea
            id="task"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Describe your task or question in detail...

Examples:
• Write a compelling product description for a new AI tool
• Analyze the pros and cons of remote work policies
• Create a step-by-step guide for learning machine learning
• Explain quantum computing to a 10-year-old"
            className={`
              w-full h-48 resize-none rounded-xl
              bg-background/60 backdrop-blur-sm
              border border-border-subtle
              text-text-primary placeholder:text-text-muted
              px-4 py-4 text-[15px] leading-relaxed
              focus:outline-none focus:border-amber/50
              transition-all duration-300
              ${status === 'running' ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            disabled={status === 'running'}
          />

          {/* Character count */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span className={`
              text-xs font-mono transition-colors
              ${charCount > 0 ? 'text-text-muted' : 'text-text-ghost'}
            `}>
              {charCount > 0 && `${charCount} chars`}
            </span>
          </div>
        </div>
      </div>

      {/* Context indicator */}
      {context && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal/5 border border-teal/20">
          <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          <span className="text-xs text-teal">Context attached from uploaded files</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isDisabled}
        className={`
          w-full relative overflow-hidden
          flex items-center justify-center gap-3
          py-4 px-6 rounded-xl
          font-semibold text-base
          transition-all duration-300
          ${isDisabled
            ? 'bg-background-tertiary text-text-muted cursor-not-allowed'
            : 'bg-gradient-to-r from-amber via-amber-light to-amber text-background shadow-lg shadow-amber/25 hover:shadow-amber/40 hover:scale-[1.02] active:scale-[0.98]'
          }
        `}
      >
        {/* Shimmer effect */}
        {!isDisabled && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        )}

        {isSubmitting || status === 'running' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{status === 'running' ? 'Reasoning in progress...' : 'Initializing...'}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Start Reasoning</span>
            <Send className="w-4 h-4 ml-1" />
          </>
        )}
      </button>

      {/* Keyboard hint */}
      {!isDisabled && (
        <p className="text-center text-xs text-text-ghost">
          Press <kbd className="px-1.5 py-0.5 rounded bg-background-tertiary text-text-muted font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-background-tertiary text-text-muted font-mono text-[10px]">Enter</kbd> to submit
        </p>
      )}
    </form>
  );
}
