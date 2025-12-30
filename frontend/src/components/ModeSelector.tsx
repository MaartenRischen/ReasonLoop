import { motion, AnimatePresence } from 'framer-motion';
import { Users, RefreshCw, Rocket, ChevronRight, Zap, Brain, Sparkles } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';

type Mode = 'council' | 'reasonloop' | 'ultrathink';
type BackendMode = 'generate' | 'critique' | 'council' | 'ultrathink';

interface ModeConfig {
  id: Mode;
  name: string;
  tagline: string;
  description: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  phases: string[];
  features: string[];
  backendMode: BackendMode;
}

const MODES: ModeConfig[] = [
  {
    id: 'council',
    name: 'Council',
    tagline: 'Collective Intelligence',
    description: 'All models answer simultaneously, then vote on the best response. Fast, diverse perspectives.',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
    phases: ['Parallel Query', 'Peer Review', 'Synthesis'],
    features: ['3 perspectives', 'Democratic ranking', 'Single output'],
    backendMode: 'council',
  },
  {
    id: 'reasonloop',
    name: 'ReasonLoop',
    tagline: 'Iterative Refinement',
    description: 'Generate, critique, and refine in a loop until quality threshold is met.',
    icon: RefreshCw,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    glowColor: 'shadow-violet-500/20',
    phases: ['Generate', 'Critique', 'Refine', 'Repeat'],
    features: ['Score-driven', 'Model rotation', 'Deep refinement'],
    backendMode: 'generate',
  },
  {
    id: 'ultrathink',
    name: 'UltraThink',
    tagline: 'Maximum Intelligence',
    description: 'Council synthesis first, then ReasonLoop refinement. The ultimate combination.',
    icon: Rocket,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/20',
    phases: ['Council', '→', 'ReasonLoop'],
    features: ['Best of both', 'Comprehensive', 'Premium quality'],
    backendMode: 'ultrathink',
  },
];

export function ModeSelector() {
  const { config, setConfig, status } = useReasoningStore();
  const isDisabled = status === 'running';

  // Derive current mode from config
  const currentMode: Mode =
    config.mode === 'ultrathink' ? 'ultrathink' :
    config.mode === 'council' ? 'council' :
    config.mode === 'critique' ? 'council' : 'reasonloop';

  const handleModeSelect = (mode: Mode) => {
    if (isDisabled) return;
    const modeConfig = MODES.find(m => m.id === mode);
    if (modeConfig) {
      setConfig({ mode: modeConfig.backendMode });
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
          <Brain className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Reasoning Mode</h3>
          <p className="text-xs text-zinc-500">Choose how AI models collaborate</p>
        </div>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id)}
              disabled={isDisabled}
              className={`
                relative p-4 rounded-xl border text-left transition-all duration-300
                ${isActive
                  ? `${mode.bgColor} ${mode.borderColor} shadow-lg ${mode.glowColor}`
                  : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
                group overflow-hidden
              `}
              whileHover={{ scale: isDisabled ? 1 : 1.02 }}
              whileTap={{ scale: isDisabled ? 1 : 0.98 }}
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeModeIndicator"
                  className={`absolute inset-0 ${mode.bgColor} rounded-xl`}
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Glow Effect */}
              {isActive && (
                <div className={`absolute -inset-1 ${mode.bgColor} blur-xl opacity-50`} />
              )}

              {/* Content */}
              <div className="relative z-10">
                {/* Icon & Name */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    ${isActive ? mode.bgColor : 'bg-zinc-800'}
                    transition-colors duration-300
                  `}>
                    <Icon className={`w-4 h-4 ${isActive ? mode.color : 'text-zinc-400'}`} />
                  </div>
                  <div>
                    <span className={`text-sm font-bold ${isActive ? mode.color : 'text-white'}`}>
                      {mode.name}
                    </span>
                    {mode.id === 'ultrathink' && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 rounded">
                        Best
                      </span>
                    )}
                  </div>
                </div>

                {/* Tagline */}
                <p className={`text-[10px] uppercase tracking-wider mb-2 ${isActive ? mode.color : 'text-zinc-500'}`}>
                  {mode.tagline}
                </p>

                {/* Phase Flow */}
                <div className="flex items-center gap-1 mb-3">
                  {mode.phases.map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className={`
                        text-[9px] px-1.5 py-0.5 rounded
                        ${isActive ? 'bg-white/10 text-white/80' : 'bg-zinc-800 text-zinc-500'}
                      `}>
                        {phase}
                      </span>
                      {idx < mode.phases.length - 1 && phase !== '→' && mode.phases[idx + 1] !== '→' && (
                        <ChevronRight className="w-2.5 h-2.5 text-zinc-600" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Description */}
                <p className={`text-[11px] leading-relaxed ${isActive ? 'text-white/70' : 'text-zinc-500'}`}>
                  {mode.description}
                </p>
              </div>

              {/* Selection Ring */}
              {isActive && (
                <motion.div
                  className={`absolute inset-0 rounded-xl border-2 ${mode.borderColor}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Mode Details Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-zinc-400">How it works</span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {currentMode === 'council' && (
                  <>All 3 models receive your task simultaneously. Each provides an answer, then anonymously reviews and ranks the others. The highest-ranked model synthesizes the final response.</>
                )}
                {currentMode === 'reasonloop' && (
                  <>Model A generates an initial response. Model B critiques it with structured feedback (score, strengths, weaknesses). Model C refines based on the critique. Roles rotate each iteration until the score threshold is met.</>
                )}
                {currentMode === 'ultrathink' && (
                  <>First, the Council phase gathers diverse perspectives and synthesizes them. Then, the ReasonLoop phase iteratively refines that synthesis until the quality threshold is reached. Best of both approaches.</>
                )}
              </p>
            </div>

            {/* Visual Flow Diagram */}
            <div className="shrink-0 p-3 rounded-lg bg-zinc-800/50">
              {currentMode === 'council' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30" />
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30" />
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-400 rotate-90" />
                  <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-500/40 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
              )}
              {currentMode === 'reasonloop' && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                    G
                  </div>
                  <ChevronRight className="w-3 h-3 text-violet-400" />
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                    C
                  </div>
                  <ChevronRight className="w-3 h-3 text-violet-400" />
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
                    R
                  </div>
                  <RefreshCw className="w-4 h-4 text-violet-400 ml-1" />
                </div>
              )}
              {currentMode === 'ultrathink' && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5 p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="text-[8px] text-blue-400">Council</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-amber-400" />
                  <div className="flex flex-col items-center gap-0.5 p-1.5 rounded bg-violet-500/10 border border-violet-500/20">
                    <RefreshCw className="w-3 h-3 text-violet-400" />
                    <span className="text-[8px] text-violet-400">Loop</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
