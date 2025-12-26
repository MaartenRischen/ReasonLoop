import { useState, useEffect } from 'react';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Loader2,
  Crown,
  Zap,
  DollarSign,
  Clock,
  Sparkles,
  Brain,
  TrendingUp
} from 'lucide-react';
import { API_BASE } from '../lib/api';

interface LeaderboardModel {
  id: string;
  name: string;
  provider: string;
  tier: 'flagship' | 'mid' | 'budget';
  score: number;
  price: number;
  contextWindow: string;
  strengths: string[];
  color: string;
}

interface LeaderboardData {
  models: LeaderboardModel[];
  lastUpdated: string;
  version: string;
}

// Current LLM landscape as of December 2025
const CURRENT_LEADERBOARD: LeaderboardData = {
  version: '2025-12',
  lastUpdated: new Date().toISOString(),
  models: [
    // Flagship Tier
    {
      id: 'anthropic/claude-opus-4.5',
      name: 'Claude Opus 4.5',
      provider: 'Anthropic',
      tier: 'flagship',
      score: 98,
      price: 5.0,
      contextWindow: '200K',
      strengths: ['Reasoning', 'Coding', 'Creative Writing', 'Analysis'],
      color: 'text-orange-400'
    },
    {
      id: 'openai/gpt-5.2-pro',
      name: 'GPT-5.2 Pro',
      provider: 'OpenAI',
      tier: 'flagship',
      score: 97,
      price: 15.0,
      contextWindow: '256K',
      strengths: ['Math', 'Coding', 'Reasoning', 'Multi-modal'],
      color: 'text-teal'
    },
    {
      id: 'google/gemini-3-pro-preview',
      name: 'Gemini 3 Pro',
      provider: 'Google',
      tier: 'flagship',
      score: 95,
      price: 2.0,
      contextWindow: '2M',
      strengths: ['Long Context', 'Multi-modal', 'Speed', 'Cost'],
      color: 'text-blue-400'
    },
    {
      id: 'x-ai/grok-4',
      name: 'Grok 4',
      provider: 'xAI',
      tier: 'flagship',
      score: 94,
      price: 5.0,
      contextWindow: '256K',
      strengths: ['Real-time Info', 'Reasoning', 'Unfiltered'],
      color: 'text-slate-300'
    },
    // Mid Tier
    {
      id: 'anthropic/claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      provider: 'Anthropic',
      tier: 'mid',
      score: 92,
      price: 3.0,
      contextWindow: '200K',
      strengths: ['Balance', 'Coding', 'Speed'],
      color: 'text-orange-400'
    },
    {
      id: 'openai/gpt-5.2',
      name: 'GPT-5.2',
      provider: 'OpenAI',
      tier: 'mid',
      score: 91,
      price: 1.75,
      contextWindow: '128K',
      strengths: ['General Purpose', 'Coding', 'Speed'],
      color: 'text-teal'
    },
    {
      id: 'google/gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'Google',
      tier: 'mid',
      score: 90,
      price: 1.25,
      contextWindow: '1M',
      strengths: ['Value', 'Long Context', 'Speed'],
      color: 'text-blue-400'
    },
    {
      id: 'openai/gpt-4.1',
      name: 'GPT-4.1',
      provider: 'OpenAI',
      tier: 'mid',
      score: 88,
      price: 2.0,
      contextWindow: '1M',
      strengths: ['Long Context', 'Reliability', 'Coding'],
      color: 'text-teal'
    },
    // Budget Tier
    {
      id: 'google/gemini-3-flash-preview',
      name: 'Gemini 3 Flash',
      provider: 'Google',
      tier: 'budget',
      score: 85,
      price: 0.5,
      contextWindow: '1M',
      strengths: ['Speed', 'Cost', 'Long Context'],
      color: 'text-blue-400'
    },
    {
      id: 'anthropic/claude-haiku-4.5',
      name: 'Claude Haiku 4.5',
      provider: 'Anthropic',
      tier: 'budget',
      score: 82,
      price: 1.0,
      contextWindow: '200K',
      strengths: ['Speed', 'Cost', 'Reliability'],
      color: 'text-orange-400'
    },
    {
      id: 'openai/gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
      provider: 'OpenAI',
      tier: 'budget',
      score: 80,
      price: 0.4,
      contextWindow: '128K',
      strengths: ['Speed', 'Cost', 'Reliability'],
      color: 'text-teal'
    },
  ]
};

const loadLeaderboard = (): LeaderboardData => {
  try {
    const stored = localStorage.getItem('reasonloop-model-leaderboard');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load leaderboard:', e);
  }
  return CURRENT_LEADERBOARD;
};

const saveLeaderboard = (data: LeaderboardData) => {
  try {
    localStorage.setItem('reasonloop-model-leaderboard', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save leaderboard:', e);
  }
};

export function ModelLeaderboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>(() => loadLeaderboard());
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  useEffect(() => {
    saveLeaderboard(leaderboard);
  }, [leaderboard]);

  const handleUltrathinkUpdate = async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const response = await fetch(`${API_BASE}/leaderboard/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          setLeaderboard({
            models: data.models,
            lastUpdated: new Date().toISOString(),
            version: data.version || new Date().toISOString().slice(0, 7)
          });
          setUpdateResult('Leaderboard updated with latest rankings!');
        } else {
          setUpdateResult('No updates available.');
        }
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      console.error('Leaderboard update failed:', err);
      setLeaderboard({
        ...CURRENT_LEADERBOARD,
        lastUpdated: new Date().toISOString()
      });
      setUpdateResult('Using built-in rankings');
    } finally {
      setIsUpdating(false);
      setTimeout(() => setUpdateResult(null), 3000);
    }
  };

  const flagshipModels = leaderboard.models.filter(m => m.tier === 'flagship');
  const midModels = leaderboard.models.filter(m => m.tier === 'mid');
  const budgetModels = leaderboard.models.filter(m => m.tier === 'budget');

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const renderModelRow = (model: LeaderboardModel, rank: number, isFirst: boolean = false) => (
    <div
      key={model.id}
      className={`
        group flex items-center gap-3 p-3 rounded-xl transition-all duration-200
        ${isFirst
          ? 'bg-gradient-to-r from-amber/10 to-transparent border border-amber/20'
          : 'hover:bg-background-tertiary/50 border border-transparent'
        }
      `}
    >
      {/* Rank Badge */}
      <div className={`
        w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
        ${rank === 1 ? 'bg-amber/20 text-amber' :
          rank === 2 ? 'bg-text-muted/20 text-text-secondary' :
          rank === 3 ? 'bg-orange-900/30 text-orange-400' :
          'bg-background-tertiary text-text-muted'
        }
      `}>
        {rank}
      </div>

      {/* Model Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${model.color}`}>{model.name}</span>
          {isFirst && <Crown className="w-3.5 h-3.5 text-amber" />}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {model.strengths.slice(0, 2).map((s) => (
            <span key={s} className="text-[9px] text-text-ghost bg-background-tertiary/50 px-1.5 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right shrink-0 space-y-0.5">
        <div className="flex items-center gap-1.5 justify-end">
          <Brain className="w-3 h-3 text-amber" />
          <span className="text-sm font-mono font-bold text-amber">{model.score}</span>
        </div>
        <div className="text-[10px] text-text-muted font-mono">
          ${model.price}/M
        </div>
      </div>
    </div>
  );

  const TierSection = ({
    icon: Icon,
    title,
    color,
    bgColor,
    models,
    startRank
  }: {
    icon: any;
    title: string;
    color: string;
    bgColor: string;
    models: LeaderboardModel[];
    startRank: number;
  }) => (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${bgColor}`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-xs font-semibold ${color} uppercase tracking-wide`}>
          {title}
        </span>
        <span className="text-[10px] text-text-ghost ml-auto">{models.length} models</span>
      </div>
      <div className="space-y-1">
        {models.map((m, i) => renderModelRow(m, startRank + i, startRank + i === 1))}
      </div>
    </div>
  );

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber" />
          </div>
          <span className="font-semibold text-text-primary">Model Leaderboard</span>
          <span className="tag tag-amber">{leaderboard.version}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Update Button & Info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-background-tertiary/30 border border-border-subtle">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              <span>Updated: {formatDate(leaderboard.lastUpdated)}</span>
            </div>
            <button
              onClick={handleUltrathinkUpdate}
              disabled={isUpdating}
              className={`
                flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200
                ${isUpdating
                  ? 'bg-violet/10 text-violet border border-violet/30'
                  : 'bg-teal/10 text-teal border border-teal/30 hover:bg-teal/20'
                }
              `}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ultrathinking...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Update Rankings</span>
                </>
              )}
            </button>
          </div>

          {/* Update Result */}
          {updateResult && (
            <div className="p-3 rounded-xl bg-teal/10 border border-teal/30 text-xs text-teal text-center font-medium animate-fade-in-up">
              {updateResult}
            </div>
          )}

          {/* Tier Sections */}
          <TierSection
            icon={Crown}
            title="Flagship"
            color="text-amber"
            bgColor="bg-amber/5"
            models={flagshipModels}
            startRank={1}
          />

          <TierSection
            icon={Sparkles}
            title="Mid-Tier"
            color="text-violet"
            bgColor="bg-violet/5"
            models={midModels}
            startRank={flagshipModels.length + 1}
          />

          <TierSection
            icon={Zap}
            title="Budget"
            color="text-teal"
            bgColor="bg-teal/5"
            models={budgetModels}
            startRank={flagshipModels.length + midModels.length + 1}
          />

          {/* Legend */}
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-center gap-6 text-[10px] text-text-ghost">
              <div className="flex items-center gap-1.5">
                <Brain className="w-3 h-3" />
                <span>Intelligence (1-100)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                <span>$ per 1M tokens</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
