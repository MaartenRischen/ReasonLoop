import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Check, AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import type { Iteration } from '../stores/reasoningStore';

interface IterationCardProps {
  iteration: Iteration;
  isLatest: boolean;
}

export function IterationCard({ iteration, isLatest }: IterationCardProps) {
  const [expandedSections, setExpandedSections] = useState({
    generation: true,
    critique: true,
  });

  const toggleSection = (section: 'generation' | 'critique') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const getScoreClass = (score: number) => {
    if (score >= 8) return 'score-high';
    if (score >= 6) return 'score-medium';
    return 'score-low';
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-teal';
    if (score >= 6) return 'text-amber';
    return 'text-rose';
  };

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden
        bg-gradient-to-br from-background-tertiary/80 to-background-secondary/60
        backdrop-blur-sm
        border transition-all duration-500 animate-fade-in-up
        ${isLatest
          ? 'border-amber/30 shadow-lg shadow-amber/5'
          : 'border-border-subtle hover:border-border-medium'
        }
      `}
    >
      {/* Active indicator bar */}
      {isLatest && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber via-amber-light to-amber" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Iteration badge */}
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg
              ${isLatest
                ? 'bg-amber/10 border border-amber/20'
                : 'bg-background-elevated border border-border-subtle'
              }
            `}>
              <Sparkles className={`w-3.5 h-3.5 ${isLatest ? 'text-amber' : 'text-text-muted'}`} />
              <span className={`font-mono text-sm font-semibold ${isLatest ? 'text-amber' : 'text-text-secondary'}`}>
                #{iteration.number + 1}
              </span>
            </div>

            {/* Status indicators */}
            {iteration.isGenerating && (
              <div className="flex items-center gap-2 text-amber">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Generating...</span>
              </div>
            )}
            {iteration.isCritiquing && (
              <div className="flex items-center gap-2 text-violet">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Analyzing...</span>
              </div>
            )}
          </div>

          {/* Score badge */}
          {iteration.critique && (
            <div className={`score-pill ${getScoreClass(iteration.critique.score)}`}>
              {iteration.critique.score.toFixed(1)}/10
            </div>
          )}
        </div>

        {/* Generation Section */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection('generation')}
            className="flex items-center gap-2 w-full text-left group mb-3"
          >
            <div className={`
              w-6 h-6 rounded-lg flex items-center justify-center
              transition-colors
              ${expandedSections.generation ? 'bg-amber/10' : 'bg-background-elevated'}
            `}>
              {expandedSections.generation ? (
                <ChevronDown className="w-4 h-4 text-amber" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary" />
              )}
            </div>
            <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
              Generation
            </span>
            {iteration.generation && !iteration.isGenerating && (
              <Check className="w-4 h-4 text-teal ml-auto" />
            )}
          </button>

          {expandedSections.generation && (
            <div className="ml-8">
              <div className="relative rounded-xl bg-background/40 border border-border-subtle overflow-hidden">
                {/* Code-style header */}
                <div className="px-4 py-2 border-b border-border-subtle bg-background-elevated/50 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-teal/60" />
                  </div>
                  <span className="text-[10px] text-text-ghost font-mono uppercase tracking-wider ml-2">Output</span>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto">
                  <pre className="font-mono text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                    {iteration.generation || (
                      <span className="text-text-muted italic">Generating response...</span>
                    )}
                    {iteration.isGenerating && (
                      <span className="inline-block w-2 h-5 bg-amber animate-pulse ml-0.5 rounded-sm" />
                    )}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Critique Section */}
        {(iteration.critique || iteration.isCritiquing) && (
          <div>
            <button
              onClick={() => toggleSection('critique')}
              className="flex items-center gap-2 w-full text-left group mb-3"
            >
              <div className={`
                w-6 h-6 rounded-lg flex items-center justify-center
                transition-colors
                ${expandedSections.critique ? 'bg-violet/10' : 'bg-background-elevated'}
              `}>
                {expandedSections.critique ? (
                  <ChevronDown className="w-4 h-4 text-violet" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary" />
                )}
              </div>
              <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                Critique & Analysis
              </span>
              {iteration.critique && !iteration.isCritiquing && (
                <Check className="w-4 h-4 text-teal ml-auto" />
              )}
            </button>

            {expandedSections.critique && iteration.critique && (
              <div className="ml-8 space-y-3">
                {/* Strengths */}
                {iteration.critique.strengths.length > 0 && (
                  <div className="rounded-xl bg-teal/5 border border-teal/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-teal/10 flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-teal" />
                      <span className="text-xs font-semibold text-teal uppercase tracking-wide">Strengths</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {iteration.critique.strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal mt-2 shrink-0" />
                          <span className="leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weaknesses */}
                {iteration.critique.weaknesses.length > 0 && (
                  <div className="rounded-xl bg-rose/5 border border-rose/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-rose/10 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose" />
                      <span className="text-xs font-semibold text-rose uppercase tracking-wide">Weaknesses</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {iteration.critique.weaknesses.map((w, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose mt-2 shrink-0" />
                          <span className="leading-relaxed">{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {iteration.critique.suggestions.length > 0 && (
                  <div className="rounded-xl bg-amber/5 border border-amber/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-amber/10 flex items-center gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber" />
                      <span className="text-xs font-semibold text-amber uppercase tracking-wide">Suggestions</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {iteration.critique.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber mt-2 shrink-0" />
                          <span className="leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {expandedSections.critique && iteration.isCritiquing && (
              <div className="ml-8">
                <div className="rounded-xl bg-violet/5 border border-violet/10 p-4">
                  <div className="flex items-center gap-2 text-violet">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing response quality...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
