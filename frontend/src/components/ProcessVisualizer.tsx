import { motion } from 'framer-motion';
import { Users, MessageSquare, Sparkles, RefreshCw, Check, Loader2, Zap, Brain, ArrowRight } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';

type Phase =
  | 'idle'
  | 'council_querying'
  | 'council_reviewing'
  | 'council_synthesizing'
  | 'generating'
  | 'critiquing'
  | 'refining'
  | 'complete';

interface PhaseConfig {
  label: string;
  description: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
}

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  idle: {
    label: 'Ready',
    description: 'Waiting to start',
    icon: Brain,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-800',
  },
  council_querying: {
    label: 'Querying Models',
    description: 'All 3 models answering in parallel',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  council_reviewing: {
    label: 'Peer Review',
    description: 'Models evaluating each other\'s responses',
    icon: MessageSquare,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  council_synthesizing: {
    label: 'Synthesizing',
    description: 'Best model creating unified answer',
    icon: Sparkles,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  generating: {
    label: 'Generating',
    description: 'Creating response',
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  critiquing: {
    label: 'Critiquing',
    description: 'Analyzing response quality',
    icon: MessageSquare,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
  },
  refining: {
    label: 'Refining',
    description: 'Improving based on feedback',
    icon: RefreshCw,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
  },
  complete: {
    label: 'Complete',
    description: 'Reasoning finished',
    icon: Check,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
  },
};

function getCurrentPhase(
  status: string,
  iterations: any[],
  _config: any
): Phase {
  if (status === 'idle') return 'idle';
  if (status === 'completed') return 'complete';

  const currentIter = iterations[iterations.length - 1];
  if (!currentIter) return 'generating';

  // Check for council phase (iteration -1)
  if (currentIter.number === -1) {
    if (currentIter.isGenerating) return 'council_synthesizing';
    return 'council_querying';
  }

  if (currentIter.isGenerating) return 'generating';
  if (currentIter.isCritiquing) return 'critiquing';
  if (currentIter.critique && !currentIter.isGenerating) return 'refining';

  return 'generating';
}

export function ProcessVisualizer() {
  const { status, iterations, config, currentIteration, finalScore } = useReasoningStore();

  const phase = getCurrentPhase(status, iterations, config);
  const phaseConfig = PHASE_CONFIG[phase];
  const Icon = phaseConfig.icon;

  const isCouncilMode = config.mode === 'ultrathink' || config.mode === 'critique';
  const isReasonLoopMode = config.mode === 'generate' || config.mode === 'ultrathink';

  // Calculate progress
  const totalIterations = config.max_iterations;
  const currentIterNum = Math.max(0, currentIteration);
  const progress = status === 'completed' ? 100 : (currentIterNum / totalIterations) * 100;

  return (
    <div className="space-y-4">
      {/* Current Phase Display */}
      <div className="relative overflow-hidden rounded-xl bg-zinc-900/80 border border-zinc-800 p-4">
        {/* Animated Background */}
        {status === 'running' && (
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${
                phase.startsWith('council') ? 'rgb(59, 130, 246)' :
                phase === 'generating' ? 'rgb(251, 191, 36)' :
                phase === 'critiquing' ? 'rgb(167, 139, 250)' :
                'rgb(45, 212, 191)'
              } 0%, transparent 70%)`,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <div className="relative z-10">
          {/* Phase Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className={`w-12 h-12 rounded-xl ${phaseConfig.bgColor} flex items-center justify-center`}
                animate={status === 'running' ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {status === 'running' ? (
                  <Loader2 className={`w-6 h-6 ${phaseConfig.color} animate-spin`} />
                ) : (
                  <Icon className={`w-6 h-6 ${phaseConfig.color}`} />
                )}
              </motion.div>
              <div>
                <h3 className={`text-lg font-semibold ${phaseConfig.color}`}>
                  {phaseConfig.label}
                </h3>
                <p className="text-sm text-zinc-500">{phaseConfig.description}</p>
              </div>
            </div>

            {/* Score Badge */}
            {finalScore !== null && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30">
                <span className="text-xs text-teal-400 uppercase tracking-wider">Final Score</span>
                <span className="text-2xl font-bold font-mono text-teal-400">
                  {finalScore.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Process Flow Visualization */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50">
            {/* Council Phase Nodes */}
            {isCouncilMode && (
              <>
                <ProcessNode
                  label="Query"
                  isActive={phase === 'council_querying'}
                  isComplete={['council_reviewing', 'council_synthesizing', 'generating', 'critiquing', 'refining', 'complete'].includes(phase)}
                  color="blue"
                />
                <ProcessConnector isActive={phase === 'council_reviewing'} />
                <ProcessNode
                  label="Review"
                  isActive={phase === 'council_reviewing'}
                  isComplete={['council_synthesizing', 'generating', 'critiquing', 'refining', 'complete'].includes(phase)}
                  color="blue"
                />
                <ProcessConnector isActive={phase === 'council_synthesizing'} />
                <ProcessNode
                  label="Synthesize"
                  isActive={phase === 'council_synthesizing'}
                  isComplete={['generating', 'critiquing', 'refining', 'complete'].includes(phase)}
                  color="blue"
                />
                {isReasonLoopMode && (
                  <>
                    <div className="mx-2 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30">
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </div>
                  </>
                )}
              </>
            )}

            {/* ReasonLoop Phase Nodes */}
            {isReasonLoopMode && (
              <>
                <ProcessNode
                  label="Generate"
                  isActive={phase === 'generating'}
                  isComplete={['critiquing', 'refining', 'complete'].includes(phase)}
                  color="amber"
                />
                <ProcessConnector isActive={phase === 'critiquing'} />
                <ProcessNode
                  label="Critique"
                  isActive={phase === 'critiquing'}
                  isComplete={['refining', 'complete'].includes(phase)}
                  color="violet"
                />
                <ProcessConnector isActive={phase === 'refining'} />
                <ProcessNode
                  label="Refine"
                  isActive={phase === 'refining'}
                  isComplete={phase === 'complete'}
                  color="teal"
                />
                {currentIterNum < totalIterations - 1 && status === 'running' && (
                  <div className="ml-2 flex items-center gap-1 text-zinc-500">
                    <RefreshCw className="w-3 h-3" />
                    <span className="text-[10px]">Loop</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress Bar */}
          {isReasonLoopMode && status === 'running' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">
                  Iteration {currentIterNum + 1} of {totalIterations}
                </span>
                <span className="text-xs text-zinc-500">
                  Target: {config.score_threshold}/10
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 via-violet-500 to-teal-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessNode({
  label,
  isActive,
  isComplete,
  color,
}: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  color: 'blue' | 'amber' | 'violet' | 'teal';
}) {
  const colors = {
    blue: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      glow: 'shadow-blue-500/30',
    },
    amber: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/30',
    },
    violet: {
      bg: 'bg-violet-500/20',
      border: 'border-violet-500/50',
      text: 'text-violet-400',
      glow: 'shadow-violet-500/30',
    },
    teal: {
      bg: 'bg-teal-500/20',
      border: 'border-teal-500/50',
      text: 'text-teal-400',
      glow: 'shadow-teal-500/30',
    },
  };

  const c = colors[color];

  return (
    <motion.div
      className={`
        relative px-3 py-1.5 rounded-lg border transition-all duration-300
        ${isActive ? `${c.bg} ${c.border} shadow-lg ${c.glow}` :
          isComplete ? `${c.bg} ${c.border}` :
          'bg-zinc-800/50 border-zinc-700'}
      `}
      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
    >
      <span className={`text-xs font-medium ${isActive || isComplete ? c.text : 'text-zinc-500'}`}>
        {label}
      </span>
      {isComplete && !isActive && (
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${c.bg} border ${c.border} flex items-center justify-center`}>
          <Check className={`w-2 h-2 ${c.text}`} />
        </div>
      )}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-current opacity-50"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ borderColor: 'currentColor' }}
        />
      )}
    </motion.div>
  );
}

function ProcessConnector({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex-1 min-w-[20px] max-w-[40px] h-0.5 bg-zinc-700 relative overflow-hidden rounded-full">
      {isActive && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-violet-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}
