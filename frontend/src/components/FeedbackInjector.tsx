import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, Send, X, Lightbulb, AlertCircle, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';
import { API_BASE } from '../lib/api';

const QUICK_FEEDBACK = [
  { icon: ThumbsUp, label: 'Good direction', text: 'This is heading in the right direction, keep refining this approach.' },
  { icon: ThumbsDown, label: 'Wrong direction', text: 'This approach isn\'t working. Try a completely different angle.' },
  { icon: Lightbulb, label: 'More depth', text: 'Go deeper on this topic. Add more specific details and examples.' },
  { icon: AlertCircle, label: 'Missing key point', text: 'You\'re missing an important consideration. Think about what\'s been overlooked.' },
];

export function FeedbackInjector() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status, sessionId } = useReasoningStore();
  const isRunning = status === 'running';

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!feedback.trim() || !sessionId || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`${API_BASE}/reasoning/${sessionId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });

      if (response.ok) {
        setLastSent(feedback.trim());
        setFeedback('');
        // Keep panel open to show confirmation
        setTimeout(() => setLastSent(null), 3000);
      }
    } catch (err) {
      console.error('Failed to inject feedback:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickFeedback = (text: string) => {
    setFeedback(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  // Don't render if not running
  if (!isRunning) return null;

  return (
    <>
      {/* Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="
              fixed bottom-6 right-6 z-50
              w-14 h-14 rounded-full
              bg-gradient-to-br from-amber-500 to-amber-600
              shadow-lg shadow-amber-500/30
              flex items-center justify-center
              hover:shadow-xl hover:shadow-amber-500/40
              hover:scale-105
              transition-all duration-200
              group
            "
          >
            <MessageSquarePlus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />

            {/* Pulse Ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-400"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Tooltip */}
            <div className="
              absolute right-full mr-3 px-3 py-1.5 rounded-lg
              bg-zinc-900 border border-zinc-700 shadow-lg
              whitespace-nowrap opacity-0 group-hover:opacity-100
              pointer-events-none transition-opacity duration-200
            ">
              <span className="text-sm text-white">Inject Feedback</span>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-zinc-900 border-r border-t border-zinc-700 rotate-45" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Feedback Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2 }}
            className="
              fixed bottom-6 right-6 z-50
              w-[420px] rounded-2xl
              bg-zinc-900/95 backdrop-blur-xl
              border border-zinc-700/50
              shadow-2xl shadow-black/50
              overflow-hidden
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <MessageSquarePlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Human Feedback</h3>
                  <p className="text-xs text-zinc-500">Guide the reasoning process</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {lastSent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-teal-500/10 border-b border-teal-500/20"
                >
                  <div className="px-5 py-3 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <ThumbsUp className="w-3 h-3 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs text-teal-400 font-medium mb-1">Feedback injected</p>
                      <p className="text-xs text-zinc-400 line-clamp-2">{lastSent}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Feedback Options */}
            <div className="px-5 py-4 border-b border-zinc-800/50">
              <p className="text-xs text-zinc-500 mb-3">Quick feedback</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_FEEDBACK.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuickFeedback(item.text)}
                      className="
                        flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-zinc-800/50 border border-zinc-700/50
                        hover:bg-zinc-800 hover:border-zinc-600
                        transition-all duration-200 text-left group
                      "
                    >
                      <Icon className="w-4 h-4 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                      <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Feedback Input */}
            <div className="p-5">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your guidance for the AI..."
                  rows={3}
                  className="
                    w-full px-4 py-3 pr-12 rounded-xl
                    bg-zinc-800/50 border border-zinc-700/50
                    text-sm text-white placeholder:text-zinc-500
                    focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30
                    resize-none transition-all duration-200
                  "
                />
                <button
                  onClick={handleSend}
                  disabled={!feedback.trim() || isSending}
                  className="
                    absolute bottom-3 right-3
                    w-8 h-8 rounded-lg
                    bg-amber-500 hover:bg-amber-400
                    disabled:bg-zinc-700 disabled:cursor-not-allowed
                    flex items-center justify-center
                    transition-all duration-200
                  "
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2 text-right">
                Press ⌘+Enter to send
              </p>
            </div>

            {/* Info Footer */}
            <div className="px-5 py-3 bg-zinc-800/30 border-t border-zinc-800/50">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400/60 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Your feedback will be incorporated in the next refinement iteration.
                  Use this to steer the AI toward better results.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
