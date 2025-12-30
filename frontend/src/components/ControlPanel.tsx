import { motion } from 'framer-motion';
import { Settings2, Gauge, Target, Thermometer, FileText, Info } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';

export function ControlPanel() {
  const { config, setConfig, status } = useReasoningStore();
  const isDisabled = status === 'running';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
          <Settings2 className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Quality Controls</h3>
          <p className="text-xs text-zinc-500">Fine-tune reasoning parameters</p>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Max Iterations */}
        <ControlSlider
          icon={Gauge}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          label="Max Iterations"
          description="Maximum refinement cycles"
          value={config.max_iterations}
          min={1}
          max={10}
          step={1}
          displayValue={config.max_iterations.toString()}
          onChange={(value) => setConfig({ max_iterations: value })}
          disabled={isDisabled}
          marks={[1, 3, 5, 7, 10]}
        />

        {/* Score Threshold */}
        <ControlSlider
          icon={Target}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
          label="Score Threshold"
          description="Target quality score (1-10)"
          value={config.score_threshold}
          min={5}
          max={10}
          step={0.5}
          displayValue={`${config.score_threshold.toFixed(1)}/10`}
          onChange={(value) => setConfig({ score_threshold: value })}
          disabled={isDisabled}
          marks={[5, 6, 7, 8, 9, 10]}
        />

        {/* Temperature */}
        <ControlSlider
          icon={Thermometer}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          label="Temperature"
          description="Creativity vs consistency"
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          displayValue={config.temperature.toFixed(1)}
          onChange={(value) => setConfig({ temperature: value })}
          disabled={isDisabled}
          marks={[0, 0.5, 1, 1.5, 2]}
          leftLabel="Precise"
          rightLabel="Creative"
        />

        {/* Output Length */}
        <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center`}>
              <FileText className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div>
              <span className="text-xs font-medium text-white">Output Length</span>
              <p className="text-[10px] text-zinc-500">Per iteration</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['short', 'medium', 'long'] as const).map((length) => {
              const isActive = config.output_length === length;
              const wordCount = length === 'short' ? '~500' : length === 'medium' ? '~2000' : 'Full';

              return (
                <button
                  key={length}
                  onClick={() => setConfig({ output_length: length })}
                  disabled={isDisabled}
                  className={`
                    px-3 py-2 rounded-lg text-center transition-all duration-200
                    ${isActive
                      ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400'
                      : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <span className="text-xs font-medium capitalize">{length}</span>
                  <span className="block text-[9px] text-zinc-500 mt-0.5">{wordCount} words</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="p-3 rounded-lg bg-zinc-800/20 border border-zinc-800/50 flex items-start gap-2">
        <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          <strong className="text-zinc-400">Tip:</strong> Higher score thresholds produce better results but take longer.
          For quick tasks, use 6-7. For important work, use 8-9.
        </p>
      </div>
    </div>
  );
}

interface ControlSliderProps {
  icon: typeof Gauge;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
  disabled: boolean;
  marks?: number[];
  leftLabel?: string;
  rightLabel?: string;
}

function ControlSlider({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  description,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
  disabled,
  marks,
  leftLabel,
  rightLabel,
}: ControlSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          <div>
            <span className="text-xs font-medium text-white">{label}</span>
            <p className="text-[10px] text-zinc-500">{description}</p>
          </div>
        </div>
        <span className="text-sm font-mono font-bold text-amber-400">{displayValue}</span>
      </div>

      {/* Slider Track */}
      <div className="relative mt-2">
        <div className="h-2 rounded-full bg-zinc-700/50 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
            style={{ width: `${percentage}%` }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          />
        </div>

        {/* Input Range */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="
            absolute inset-0 w-full h-full opacity-0 cursor-pointer
            disabled:cursor-not-allowed
          "
        />

        {/* Custom Thumb */}
        <motion.div
          className="
            absolute top-1/2 -translate-y-1/2 w-4 h-4
            bg-white rounded-full shadow-md shadow-black/30
            border-2 border-amber-400
            pointer-events-none
          "
          style={{ left: `calc(${percentage}% - 8px)` }}
          initial={false}
          animate={{ left: `calc(${percentage}% - 8px)` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        />

        {/* Marks */}
        {marks && (
          <div className="absolute top-4 left-0 right-0 flex justify-between">
            {marks.map((mark) => {
              const markPercent = ((mark - min) / (max - min)) * 100;
              return (
                <div
                  key={mark}
                  className="text-[9px] text-zinc-600 absolute -translate-x-1/2"
                  style={{ left: `${markPercent}%` }}
                >
                  {mark}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Left/Right Labels */}
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between mt-5 text-[10px] text-zinc-500">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
