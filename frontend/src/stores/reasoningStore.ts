import { create } from 'zustand';

export interface CritiqueResult {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  score: number;
  raw_critique: string;
}

export interface Iteration {
  number: number;
  generation: string;
  generation_model: string;
  critique: CritiqueResult | null;
  critique_model: string;
  isGenerating: boolean;
  isCritiquing: boolean;
}

export interface ReasoningConfig {
  generator_model: string;
  critic_model: string;
  refiner_model: string;
  temperature: number;
  max_tokens: number;
  max_iterations: number;
  score_threshold: number;
  output_length: 'short' | 'medium' | 'long';
  mode: 'generate' | 'critique' | 'council' | 'ultrathink';
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

export interface ContextFile {
  name: string;
  content: string;
  type: string;
  size: number;
  isBase64?: boolean;
  mimeType?: string;
}

export interface ReasoningState {
  // Session state
  sessionId: string | null;
  task: string;
  context: string;
  contextFiles: ContextFile[];
  status: SessionStatus;

  // Iterations
  iterations: Iteration[];
  currentIteration: number;

  // Final output
  finalOutput: string | null;
  finalScore: number | null;

  // Streaming state
  streamingContent: string;
  streamingType: 'generation' | 'critique' | null;

  // Config
  config: ReasoningConfig;

  // WebSocket
  wsConnected: boolean;
  needsWebSocket: boolean;  // True when actively running, false when viewing history

  // Actions
  setTask: (task: string) => void;
  setContext: (context: string) => void;
  setContextFiles: (files: ContextFile[]) => void;
  setConfig: (config: Partial<ReasoningConfig>) => void;
  setSessionId: (id: string | null, needsWebSocket?: boolean) => void;
  setStatus: (status: SessionStatus) => void;
  setWsConnected: (connected: boolean) => void;
  setNeedsWebSocket: (needs: boolean) => void;
  clearIterations: () => void;

  // Iteration actions
  startGeneration: (iteration: number) => void;
  appendGenerationChunk: (chunk: string) => void;
  completeGeneration: (content: string) => void;
  startCritique: () => void;
  appendCritiqueChunk: (chunk: string) => void;
  completeCritique: (critique: CritiqueResult) => void;
  completeIteration: (content: string, score: number, critique: CritiqueResult) => void;
  completeSession: (output: string, score: number) => void;

  // Reset
  reset: () => void;
}

// Helper to get rotated models for an iteration (must match backend logic)
function getRotatedModels(config: ReasoningConfig, iteration: number): { generator: string; critic: string } {
  const models = [config.generator_model, config.critic_model, config.refiner_model];
  const genIdx = iteration % 3;
  const criticIdx = (iteration + 1) % 3;
  return { generator: models[genIdx], critic: models[criticIdx] };
}

const defaultConfig: ReasoningConfig = {
  generator_model: 'anthropic/claude-3.7-sonnet',  // Will be overridden by Auto mode
  critic_model: 'openai/o3',
  refiner_model: 'anthropic/claude-opus-4.5',
  temperature: 1.0,
  max_tokens: 32000,
  max_iterations: 5,
  score_threshold: 8.0,
  output_length: 'long',
  mode: 'generate',
};

export const useReasoningStore = create<ReasoningState>((set, get) => ({
  // Initial state
  sessionId: null,
  task: '',
  context: '',
  contextFiles: [],
  status: 'idle',
  iterations: [],
  currentIteration: 0,
  finalOutput: null,
  finalScore: null,
  streamingContent: '',
  streamingType: null,
  config: defaultConfig,
  wsConnected: false,
  needsWebSocket: false,

  // Actions
  setTask: (task) => set({ task }),
  setContext: (context) => set({ context }),
  setContextFiles: (contextFiles) => set({ contextFiles }),
  setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
  setSessionId: (id, needsWebSocket = true) => set({ sessionId: id, needsWebSocket }),
  setStatus: (status) => set({ status }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setNeedsWebSocket: (needs) => set({ needsWebSocket: needs }),
  clearIterations: () => set({ iterations: [], currentIteration: 0, finalOutput: null, finalScore: null }),

  startGeneration: (iteration) => {
    const iterations = [...get().iterations];
    const config = get().config;
    // Get rotated models for this iteration
    const rotated = getRotatedModels(config, iteration);

    // Ensure we have an iteration object
    if (!iterations[iteration]) {
      iterations[iteration] = {
        number: iteration,
        generation: '',
        generation_model: rotated.generator,  // Use rotated generator
        critique: null,
        critique_model: rotated.critic,  // Use rotated critic
        isGenerating: true,
        isCritiquing: false,
      };
    } else {
      iterations[iteration].isGenerating = true;
    }
    set({
      iterations,
      currentIteration: iteration,
      streamingContent: '',
      streamingType: 'generation',
      status: 'running',
    });
  },

  appendGenerationChunk: (chunk) => {
    const streamingContent = get().streamingContent + chunk;
    const iterations = [...get().iterations];
    const current = get().currentIteration;
    if (iterations[current]) {
      iterations[current].generation = streamingContent;
    }
    set({ streamingContent, iterations });
  },

  completeGeneration: (content) => {
    const iterations = [...get().iterations];
    const current = get().currentIteration;
    if (iterations[current]) {
      iterations[current].generation = content;
      iterations[current].isGenerating = false;
    }
    set({
      iterations,
      streamingContent: '',
      streamingType: null,
    });
  },

  startCritique: () => {
    const iterations = [...get().iterations];
    const current = get().currentIteration;
    if (iterations[current]) {
      iterations[current].isCritiquing = true;
    }
    set({
      iterations,
      streamingContent: '',
      streamingType: 'critique',
    });
  },

  appendCritiqueChunk: (chunk) => {
    set({ streamingContent: get().streamingContent + chunk });
  },

  completeCritique: (critique) => {
    const iterations = [...get().iterations];
    const current = get().currentIteration;
    if (iterations[current]) {
      iterations[current].critique = critique;
      iterations[current].isCritiquing = false;
    }
    set({
      iterations,
      streamingContent: '',
      streamingType: null,
    });
  },

  completeIteration: (content, _score, critique) => {
    const iterations = [...get().iterations];
    const current = get().currentIteration;
    if (iterations[current]) {
      iterations[current].generation = content;
      iterations[current].critique = critique;
      iterations[current].isGenerating = false;
      iterations[current].isCritiquing = false;
    }
    set({ iterations });
  },

  completeSession: (output, score) => {
    set({
      finalOutput: output,
      finalScore: score,
      status: 'completed',
      streamingContent: '',
      streamingType: null,
    });
  },

  reset: () => set({
    sessionId: null,
    task: '',
    context: '',
    contextFiles: [],
    status: 'idle',
    iterations: [],
    currentIteration: 0,
    finalOutput: null,
    finalScore: null,
    streamingContent: '',
    streamingType: null,
    wsConnected: false,
    needsWebSocket: false,
  }),
}));
