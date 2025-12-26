const PROD_API = 'https://reasonloop-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const isProd = import.meta.env.PROD || window.location.hostname !== 'localhost';
const BASE_URL = isProd ? PROD_API : DEV_API;

export const API_BASE = `${BASE_URL}/api`;
export const WS_BASE = `${isProd ? 'wss' : 'ws'}://${isProd ? 'reasonloop-production.up.railway.app' : 'localhost:8000'}/ws`;

export interface ReasoningConfig {
  generator_model?: string;
  critic_model?: string;
  refiner_model?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  score_threshold?: number;
}

export interface ContextFile {
  name: string;
  content: string;
  type: string;
  size: number;
  isBase64?: boolean;
  mimeType?: string;
}

export interface StartReasoningRequest {
  task: string;
  context?: string;
  context_files?: ContextFile[];
  config?: ReasoningConfig;
}

export interface StartReasoningResponse {
  session_id: string;
  status: string;
}

export async function startReasoning(request: StartReasoningRequest): Promise<StartReasoningResponse> {
  const response = await fetch(`${API_BASE}/reasoning/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to start reasoning: ${response.statusText}`);
  }
  return response.json();
}

export async function stopReasoning(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/reasoning/${sessionId}/stop`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to stop reasoning: ${response.statusText}`);
  }
}

export async function retryReasoning(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/reasoning/${sessionId}/retry`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to retry reasoning: ${response.statusText}`);
  }
}

export async function injectFeedback(sessionId: string, feedback: string): Promise<void> {
  const response = await fetch(`${API_BASE}/reasoning/${sessionId}/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
  if (!response.ok) {
    throw new Error(`Failed to inject feedback: ${response.statusText}`);
  }
}

export async function getSession(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/reasoning/${sessionId}`);
  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.statusText}`);
  }
  return response.json();
}

export async function listModels(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }
  const data = await response.json();
  return data.models;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export function createReasoningWebSocket(sessionId: string): WebSocket {
  return new WebSocket(`${WS_BASE}/reasoning/${sessionId}`);
}

export function createRetryWebSocket(sessionId: string): WebSocket {
  return new WebSocket(`${WS_BASE}/reasoning/${sessionId}/retry`);
}

// =============================================================================
// BYOK (Bring Your Own Key) API
// =============================================================================

export interface APIKeyStatus {
  provider: string;
  configured: boolean;
  masked_key: string | null;
}

export interface ProviderUsage {
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  requests: number;
}

export interface ModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  requests: number;
}

export interface UsageResponse {
  providers: ProviderUsage[];
  models: ModelUsage[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  last_updated: string | null;
}

export async function getApiKeys(): Promise<APIKeyStatus[]> {
  const response = await fetch(`${API_BASE}/keys`);
  if (!response.ok) {
    throw new Error(`Failed to get API keys: ${response.statusText}`);
  }
  const data = await response.json();
  return data.keys;
}

export async function setApiKey(provider: string, key: string): Promise<{ status: string; masked_key: string }> {
  const response = await fetch(`${API_BASE}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set API key: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteApiKey(provider: string): Promise<void> {
  const response = await fetch(`${API_BASE}/keys/${provider}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete API key: ${response.statusText}`);
  }
}

export async function getUsage(): Promise<UsageResponse> {
  const response = await fetch(`${API_BASE}/usage`);
  if (!response.ok) {
    throw new Error(`Failed to get usage: ${response.statusText}`);
  }
  return response.json();
}

export async function resetUsage(): Promise<void> {
  const response = await fetch(`${API_BASE}/usage/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset usage: ${response.statusText}`);
  }
}

