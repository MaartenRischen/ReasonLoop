import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Zap, Scale, Sparkles, DollarSign, Loader2, Search, Star, Wand2, Brain, Settings2, Rocket } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';
import { API_BASE } from '../lib/api';

interface TaskAnalysisResponse {
  task_type: string;
  task_summary: string;
  generator: { model_id: string; reason: string };
  critic: { model_id: string; reason: string };
  refiner: { model_id: string; reason: string };
  temperature: number;
  max_iterations: number;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  context_length?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

const DEFAULT_FAVORITES = [
  'anthropic/claude-opus-4.5',
  'x-ai/grok-4',
  'openai/gpt-5.2-pro',
  'google/gemini-3-pro-preview',
];

const loadFavorites = (): Set<string> => {
  try {
    const stored = localStorage.getItem('reasonloop-favorite-models');
    if (stored) return new Set(JSON.parse(stored));
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
  return new Set(DEFAULT_FAVORITES);
};

const saveFavorites = (favorites: Set<string>) => {
  try {
    localStorage.setItem('reasonloop-favorite-models', JSON.stringify([...favorites]));
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
};

const PRESETS = [
  {
    id: 'auto',
    name: 'Auto (Best)',
    icon: Wand2,
    description: 'Auto-select best models for task',
    color: 'teal',
    config: null,
  },
  {
    id: 'fast',
    name: 'Fast & Cheap',
    icon: Zap,
    description: 'Gemini 3 Flash - newest & fast',
    color: 'amber',
    config: {
      generator_model: 'google/gemini-3-flash-preview',
      critic_model: 'google/gemini-3-flash-preview',
      refiner_model: 'google/gemini-3-flash-preview',
      temperature: 1.0,
      max_iterations: 3,
      output_length: 'short' as const,
      mode: 'generate' as const,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: Scale,
    description: 'Sonnet 4.5, GPT-5.2, Gemini 3 Pro',
    color: 'violet',
    config: {
      generator_model: 'anthropic/claude-sonnet-4.5',
      critic_model: 'openai/gpt-5.2',
      refiner_model: 'google/gemini-3-pro-preview',
      temperature: 1.0,
      max_iterations: 5,
      output_length: 'medium' as const,
      mode: 'generate' as const,
    },
  },
  {
    id: 'quality',
    name: 'Maximum Quality',
    icon: Sparkles,
    description: 'Grok 4, Opus 4.5, Gemini 3 Pro',
    color: 'rose',
    config: {
      generator_model: 'x-ai/grok-4',
      critic_model: 'anthropic/claude-opus-4.5',
      refiner_model: 'google/gemini-3-pro-preview',
      temperature: 1.0,
      max_iterations: 6,
      output_length: 'long' as const,
      mode: 'generate' as const,
    },
  },
  {
    id: 'costopt',
    name: 'Cost Optimized',
    icon: DollarSign,
    description: 'Gemini 2.5 Pro - best value flagship',
    color: 'teal',
    config: {
      generator_model: 'google/gemini-2.5-pro',
      critic_model: 'google/gemini-2.5-pro',
      refiner_model: 'google/gemini-2.5-pro',
      temperature: 1.0,
      max_iterations: 5,
      output_length: 'medium' as const,
      mode: 'generate' as const,
    },
  },
];

interface ModelSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  models: Model[];
  isLoading?: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  favorites: Set<string>;
  onToggleFavorite: (modelId: string) => void;
}

function ModelSelect({ label, value, onChange, disabled, models, isLoading, searchTerm, onSearchChange, favorites, onToggleFavorite }: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favoriteModels = filteredModels.filter(m => favorites.has(m.id));
  const nonFavoriteModels = filteredModels.filter(m => !favorites.has(m.id));

  const groupedModels = nonFavoriteModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  const selectedModel = models.find(m => m.id === value);
  const isSelectedFavorite = selectedModel && favorites.has(selectedModel.id);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full bg-background/40 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-amber/50 disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center justify-between transition-all hover:border-border-medium"
      >
        <span className="truncate flex items-center gap-2">
          {isSelectedFavorite && <Star className="w-3.5 h-3.5 text-amber fill-amber" />}
          {isLoading ? 'Loading models...' : (selectedModel?.name || value)}
        </span>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-full bg-background-elevated border border-border-subtle rounded-xl shadow-2xl shadow-black/40 max-h-80 overflow-hidden">
          <div className="p-3 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-background/60 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber/50"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-60">
            {favoriteModels.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-amber bg-amber/5 sticky top-0 flex items-center gap-1.5 font-semibold">
                  <Star className="w-3 h-3 fill-amber" />
                  Favorites
                </div>
                {favoriteModels.map((model) => (
                  <div
                    key={model.id}
                    className={`flex items-center transition-colors ${model.id === value ? 'bg-amber/10' : 'hover:bg-background-tertiary'}`}
                  >
                    <button
                      onClick={() => { onChange(model.id); setIsOpen(false); }}
                      className="flex-1 px-4 py-2.5 text-left"
                    >
                      <div className={`text-sm ${model.id === value ? 'text-amber' : 'text-text-primary'}`}>{model.name}</div>
                      {model.context_length && (
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {(model.context_length / 1000).toFixed(0)}k ctx
                          {model.pricing && ` · $${model.pricing.prompt.toFixed(2)}/$${model.pricing.completion.toFixed(2)} per 1M`}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(model.id); }}
                      className="p-2 hover:bg-background transition-colors"
                    >
                      <Star className="w-4 h-4 text-amber fill-amber" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted bg-background-tertiary/50 sticky top-0 font-medium">
                  {provider}
                </div>
                {providerModels.map((model) => (
                  <div
                    key={model.id}
                    className={`flex items-center transition-colors ${model.id === value ? 'bg-amber/10' : 'hover:bg-background-tertiary'}`}
                  >
                    <button
                      onClick={() => { onChange(model.id); setIsOpen(false); }}
                      className="flex-1 px-4 py-2.5 text-left"
                    >
                      <div className={`text-sm ${model.id === value ? 'text-amber' : 'text-text-primary'}`}>{model.name}</div>
                      {model.context_length && (
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {(model.context_length / 1000).toFixed(0)}k ctx
                          {model.pricing && ` · $${model.pricing.prompt.toFixed(2)}/$${model.pricing.completion.toFixed(2)} per 1M`}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(model.id); }}
                      className="p-2 hover:bg-background transition-colors"
                    >
                      <Star className="w-4 h-4 text-text-ghost hover:text-amber" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {filteredModels.length === 0 && (
              <div className="px-4 py-6 text-sm text-text-muted text-center">No models found</div>
            )}
          </div>
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}

export function ModelConfig() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>('auto');
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TaskAnalysisResponse | null>(null);
  const { config, setConfig, status, task, contextFiles } = useReasoningStore();

  const isDisabled = status === 'running';
  const hasVisionContent = contextFiles.some(f => f.isBase64);

  const analyzeTaskWithLLM = useCallback(async (taskText: string, hasVision: boolean) => {
    if (!taskText.trim() || taskText.length < 10) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/analyze-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskText, has_vision_content: hasVision })
      });
      if (response.ok) {
        const result: TaskAnalysisResponse = await response.json();
        setAnalysisResult(result);
        setConfig({
          generator_model: result.generator.model_id,
          critic_model: result.critic.model_id,
          refiner_model: result.refiner.model_id,
          temperature: result.temperature,
          max_iterations: result.max_iterations
        });
      }
    } catch (err) {
      console.error('Task analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [setConfig]);

  useEffect(() => {
    if (activePreset !== 'auto' || !task.trim()) {
      setAnalysisResult(null);
      return;
    }
    const timer = setTimeout(() => {
      analyzeTaskWithLLM(task, hasVisionContent);
    }, 800);
    return () => clearTimeout(timer);
  }, [task, hasVisionContent, activePreset, analyzeTaskWithLLM]);

  const handleToggleFavorite = (modelId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(modelId)) newFavorites.delete(modelId);
      else newFavorites.add(modelId);
      saveFavorites(newFavorites);
      return newFavorites;
    });
  };

  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await fetch(`${API_BASE}/models`);
        const data = await response.json();
        if (data.models?.length > 0) setModels(data.models);
      } catch (err) {
        console.error('Failed to fetch models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchModels();
  }, []);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.id);
    if (preset.id === 'auto') {
      setAnalysisResult(null);
      if (task.trim() && task.length >= 10) analyzeTaskWithLLM(task, hasVisionContent);
    } else if (preset.config) {
      setAnalysisResult(null);
      setConfig(preset.config);
    }
  };

  const handleModelChange = (key: string, value: string) => {
    setActivePreset(null);
    setConfig({ [key]: value });
  };

  const getPresetColor = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      teal: { bg: 'bg-teal/10', border: 'border-teal/30', text: 'text-teal' },
      amber: { bg: 'bg-amber/10', border: 'border-amber/30', text: 'text-amber' },
      violet: { bg: 'bg-violet/10', border: 'border-violet/30', text: 'text-violet' },
      rose: { bg: 'bg-rose/10', border: 'border-rose/30', text: 'text-rose' },
    };
    return isActive ? colors[color] : { bg: 'bg-background-tertiary/50', border: 'border-border-subtle', text: 'text-text-secondary' };
  };

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-violet" />
          </div>
          <span className="font-semibold text-text-primary">Model Configuration</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Presets Grid */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">Presets</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isActive = activePreset === preset.id;
                const colors = getPresetColor(preset.color, isActive);
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    disabled={isDisabled}
                    className={`
                      p-3 rounded-xl border text-left transition-all
                      ${colors.bg} ${colors.border}
                      ${isActive ? 'ring-1 ring-offset-1 ring-offset-background ' + colors.border : 'hover:border-border-medium'}
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                      <span className={`text-xs font-semibold ${colors.text}`}>{preset.name}</span>
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Auto mode analysis */}
            {activePreset === 'auto' && isAnalyzing && (
              <div className="mt-4 p-4 rounded-xl bg-teal/5 border border-teal/20">
                <div className="flex items-center gap-2 text-teal text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing task with AI...</span>
                </div>
              </div>
            )}
            {activePreset === 'auto' && !isAnalyzing && analysisResult && (
              <div className="mt-4 p-4 rounded-xl bg-teal/5 border border-teal/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal" />
                  <span className="text-sm font-semibold text-teal">{analysisResult.task_type}</span>
                </div>
                <p className="text-xs text-text-muted italic">"{analysisResult.task_summary}"</p>
                <div className="grid gap-2">
                  {[
                    { label: 'Generator', data: analysisResult.generator },
                    { label: 'Critic', data: analysisResult.critic },
                    { label: 'Refiner', data: analysisResult.refiner },
                  ].map(({ label, data }) => (
                    <div key={label} className="flex items-start gap-2 text-[11px]">
                      <span className="text-teal font-medium shrink-0 w-16">{label}:</span>
                      <span className="text-text-secondary">{models.find(m => m.id === data.model_id)?.name || data.model_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activePreset === 'auto' && !isAnalyzing && !analysisResult && !task.trim() && (
              <div className="mt-4 p-3 rounded-xl bg-background-tertiary/50 border border-border-subtle">
                <p className="text-xs text-text-muted text-center">Enter a task to auto-select the best models</p>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Mode</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setActivePreset(null); setConfig({ mode: 'generate' }); }}
                disabled={isDisabled}
                className={`
                  p-3 rounded-xl border text-left transition-all
                  ${config.mode === 'generate'
                    ? 'bg-teal/10 border-teal/30 ring-1 ring-offset-1 ring-offset-background ring-teal/30'
                    : 'bg-background-tertiary/50 border-border-subtle hover:border-border-medium'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className={`text-xs font-semibold ${config.mode === 'generate' ? 'text-teal' : 'text-text-secondary'}`}>
                  Generate & Refine
                </div>
                <p className="text-[9px] text-text-muted mt-1">Create & improve</p>
              </button>
              <button
                onClick={() => { setActivePreset(null); setConfig({ mode: 'critique' }); }}
                disabled={isDisabled}
                className={`
                  p-3 rounded-xl border text-left transition-all
                  ${config.mode === 'critique'
                    ? 'bg-violet/10 border-violet/30 ring-1 ring-offset-1 ring-offset-background ring-violet/30'
                    : 'bg-background-tertiary/50 border-border-subtle hover:border-border-medium'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className={`text-xs font-semibold ${config.mode === 'critique' ? 'text-violet' : 'text-text-secondary'}`}>
                  Critique Only
                </div>
                <p className="text-[9px] text-text-muted mt-1">Analyze, don't rewrite</p>
              </button>
              <button
                onClick={() => { setActivePreset(null); setConfig({ mode: 'ultrathink' }); }}
                disabled={isDisabled}
                className={`
                  p-3 rounded-xl border text-left transition-all
                  ${config.mode === 'ultrathink'
                    ? 'bg-rose/10 border-rose/30 ring-1 ring-offset-1 ring-offset-background ring-rose/30'
                    : 'bg-background-tertiary/50 border-border-subtle hover:border-border-medium'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className={`text-xs font-semibold flex items-center gap-1 ${config.mode === 'ultrathink' ? 'text-rose' : 'text-text-secondary'}`}>
                  <Rocket className="w-3 h-3" />
                  UltraThink
                </div>
                <p className="text-[9px] text-text-muted mt-1">Council + Refine</p>
              </button>
            </div>
            {config.mode === 'ultrathink' && (
              <p className="text-[10px] text-rose/80 mt-2 px-1">
                All 3 models answer → peer review → synthesize → refine loop
              </p>
            )}
          </div>

          {/* Model Selects */}
          <div className="space-y-4">
            <p className="text-[10px] text-text-muted -mb-2">These 3 models rotate roles each iteration</p>
            <ModelSelect
              label="Model A"
              value={config.generator_model}
              onChange={(v) => handleModelChange('generator_model', v)}
              disabled={isDisabled}
              models={models}
              isLoading={isLoadingModels}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
            <ModelSelect
              label="Model B"
              value={config.critic_model}
              onChange={(v) => handleModelChange('critic_model', v)}
              disabled={isDisabled}
              models={models}
              isLoading={isLoadingModels}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
            <ModelSelect
              label="Model C"
              value={config.refiner_model}
              onChange={(v) => handleModelChange('refiner_model', v)}
              disabled={isDisabled}
              models={models}
              isLoading={isLoadingModels}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {/* Output Length */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Output Length per Turn</label>
            <div className="grid grid-cols-3 gap-2">
              {(['short', 'medium', 'long'] as const).map((length) => (
                <button
                  key={length}
                  onClick={() => { setActivePreset(null); setConfig({ output_length: length }); }}
                  disabled={isDisabled}
                  className={`
                    px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${config.output_length === length
                      ? 'bg-amber/10 border-amber/30 text-amber'
                      : 'bg-background-tertiary/50 border-border-subtle text-text-secondary hover:border-border-medium'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {length.charAt(0).toUpperCase() + length.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-ghost mt-1">Short: ~500 words, Medium: ~2000 words, Long: unlimited</p>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Temperature</label>
                <span className="text-sm font-mono font-semibold text-amber">{config.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => { setActivePreset(null); setConfig({ temperature: parseFloat(e.target.value) }); }}
                disabled={isDisabled}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-ghost mt-1">
                <span>0 (Precise)</span>
                <span>2 (Wild)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Max Iterations</label>
                <span className="text-sm font-mono font-semibold text-amber">{config.max_iterations}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={config.max_iterations}
                onChange={(e) => { setActivePreset(null); setConfig({ max_iterations: parseInt(e.target.value) }); }}
                disabled={isDisabled}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-ghost mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Score Threshold</label>
                <span className="text-sm font-mono font-semibold text-amber">{config.score_threshold.toFixed(1)}/10</span>
              </div>
              <input
                type="range"
                min="5"
                max="10"
                step="0.5"
                value={config.score_threshold}
                onChange={(e) => { setActivePreset(null); setConfig({ score_threshold: parseFloat(e.target.value) }); }}
                disabled={isDisabled}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-text-ghost mt-1">
                <span>5 (Easy)</span>
                <span>10 (Perfect)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
