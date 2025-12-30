import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, Search, Star, RefreshCw, Zap, MessageSquare, Sparkles, Info } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';

interface Model {
  id: string;
  name: string;
  provider: string;
}

// Simplified model list - will be loaded from API
const POPULAR_MODELS: Model[] = [
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'OpenAI' },
  { id: 'openai/o3', name: 'o3', provider: 'OpenAI' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google' },
  { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'xAI' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
];

interface ModelSlotProps {
  label: string;
  role: string;
  roleIcon: typeof Zap;
  roleColor: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  models: Model[];
  rotationNote: string;
}

function ModelSlot({
  label,
  role,
  roleIcon: RoleIcon,
  roleColor,
  value,
  onChange,
  disabled,
  models,
  rotationNote,
}: ModelSlotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedModel = models.find((m) => m.id === value);
  const displayName = selectedModel?.name || value.split('/').pop() || 'Select model';

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
  );

  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  return (
    <div className="relative">
      {/* Label with Role */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${roleColor}`}>
          <RoleIcon className="w-3 h-3" />
          <span className="text-[10px] font-medium">{role}</span>
        </div>
      </div>

      {/* Selector Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-xl
          bg-zinc-800/50 border border-zinc-700/50
          flex items-center justify-between gap-3
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800 hover:border-zinc-600'}
          ${isOpen ? 'border-amber-500/50 ring-1 ring-amber-500/20' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-[10px] text-zinc-500">{selectedModel?.provider || 'Unknown'}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Rotation Note */}
      <p className="text-[10px] text-zinc-600 mt-1.5 pl-1">{rotationNote}</p>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
              className="
                absolute z-50 top-full mt-2 w-full
                bg-zinc-900 border border-zinc-700
                rounded-xl shadow-2xl shadow-black/50
                overflow-hidden
              "
            >
              {/* Search */}
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="
                      w-full pl-10 pr-4 py-2 rounded-lg
                      bg-zinc-800 border border-zinc-700
                      text-sm text-white placeholder:text-zinc-500
                      focus:outline-none focus:border-amber-500/50
                    "
                    autoFocus
                  />
                </div>
              </div>

              {/* Model List */}
              <div className="max-h-64 overflow-y-auto">
                {Object.entries(groupedModels).map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div className="px-3 py-2 bg-zinc-800/50 text-[10px] text-zinc-500 uppercase tracking-wider font-medium sticky top-0">
                      {provider}
                    </div>
                    {providerModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onChange(model.id);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={`
                          w-full px-4 py-2.5 flex items-center gap-3 text-left
                          transition-colors duration-150
                          ${model.id === value
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'hover:bg-zinc-800 text-white'
                          }
                        `}
                      >
                        <Bot className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm">{model.name}</span>
                        {model.id === value && (
                          <Star className="w-3 h-3 text-amber-400 ml-auto fill-amber-400" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModelTriad() {
  const { config, setConfig, status, currentIteration } = useReasoningStore();
  const isDisabled = status === 'running';

  // Determine which model has which role in current iteration
  const genIdx = currentIteration % 3;
  const critIdx = (currentIteration + 1) % 3;

  const SLOTS = [
    {
      key: 'generator_model',
      label: 'Model A',
      value: config.generator_model,
      role: genIdx === 0 ? 'Generator' : critIdx === 0 ? 'Critic' : 'Refiner',
      roleIcon: genIdx === 0 ? Zap : critIdx === 0 ? MessageSquare : Sparkles,
      roleColor: genIdx === 0 ? 'bg-amber-500/20 text-amber-400' : critIdx === 0 ? 'bg-violet-500/20 text-violet-400' : 'bg-teal-500/20 text-teal-400',
      rotationNote: 'Starts as generator, rotates each iteration',
    },
    {
      key: 'critic_model',
      label: 'Model B',
      value: config.critic_model,
      role: genIdx === 1 ? 'Generator' : critIdx === 1 ? 'Critic' : 'Refiner',
      roleIcon: genIdx === 1 ? Zap : critIdx === 1 ? MessageSquare : Sparkles,
      roleColor: genIdx === 1 ? 'bg-amber-500/20 text-amber-400' : critIdx === 1 ? 'bg-violet-500/20 text-violet-400' : 'bg-teal-500/20 text-teal-400',
      rotationNote: 'Starts as critic, rotates each iteration',
    },
    {
      key: 'refiner_model',
      label: 'Model C',
      value: config.refiner_model,
      role: genIdx === 2 ? 'Generator' : critIdx === 2 ? 'Critic' : 'Refiner',
      roleIcon: genIdx === 2 ? Zap : critIdx === 2 ? MessageSquare : Sparkles,
      roleColor: genIdx === 2 ? 'bg-amber-500/20 text-amber-400' : critIdx === 2 ? 'bg-violet-500/20 text-violet-400' : 'bg-teal-500/20 text-teal-400',
      rotationNote: 'Starts as refiner, rotates each iteration',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Model Selection</h3>
            <p className="text-xs text-zinc-500">Choose 3 models that will rotate roles</p>
          </div>
        </div>

        {/* Rotation Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400">Roles rotate each iteration</span>
        </div>
      </div>

      {/* Model Slots */}
      <div className="grid grid-cols-3 gap-4">
        {SLOTS.map((slot) => (
          <ModelSlot
            key={slot.key}
            label={slot.label}
            role={slot.role}
            roleIcon={slot.roleIcon}
            roleColor={slot.roleColor}
            value={slot.value}
            onChange={(value) => setConfig({ [slot.key]: value })}
            disabled={isDisabled}
            models={POPULAR_MODELS}
            rotationNote={slot.rotationNote}
          />
        ))}
      </div>

      {/* Visual Role Rotation Diagram */}
      <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-400 font-medium">Role Rotation Pattern</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          {[0, 1, 2].map((iterNum) => {
            const gIdx = iterNum % 3;
            const cIdx = (iterNum + 1) % 3;
            return (
              <div key={iterNum} className="flex flex-col items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-medium">Iter {iterNum + 1}</span>
                <div className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center ${gIdx === 0 ? 'bg-amber-500/30 text-amber-400' : gIdx === 1 ? 'bg-violet-500/30 text-violet-400' : 'bg-teal-500/30 text-teal-400'}`}>
                    {['A', 'B', 'C'][gIdx]}
                  </div>
                  <span className="text-[9px] text-zinc-600">→</span>
                  <div className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center ${cIdx === 0 ? 'bg-amber-500/30 text-amber-400' : cIdx === 1 ? 'bg-violet-500/30 text-violet-400' : 'bg-teal-500/30 text-teal-400'}`}>
                    {['A', 'B', 'C'][cIdx]}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-zinc-600">
                  <span>Gen</span>
                  <span>→</span>
                  <span>Crit</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
