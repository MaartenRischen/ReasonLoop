import { useState, useEffect } from 'react';
import {
  Key,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  Zap
} from 'lucide-react';
import {
  getApiKeys,
  setApiKey,
  deleteApiKey,
  getUsage,
  resetUsage
} from '../lib/api';

// Define interfaces locally to avoid import issues
interface APIKeyStatus {
  provider: string;
  configured: boolean;
  masked_key: string | null;
}

interface ProviderUsage {
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  requests: number;
}

interface ModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  requests: number;
}

interface UsageResponse {
  providers: ProviderUsage[];
  models: ModelUsage[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  last_updated: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  placeholder: string;
  icon: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models - creative & analytical',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    placeholder: 'sk-ant-...',
    icon: '🧠'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, o1, o3 - general intelligence',
    color: 'text-teal',
    bgColor: 'bg-teal/10',
    borderColor: 'border-teal/30',
    placeholder: 'sk-...',
    icon: '⚡'
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini - fast & cost-effective',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    placeholder: 'AIza...',
    icon: '🔮'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Fallback for all models',
    color: 'text-violet',
    bgColor: 'bg-violet/10',
    borderColor: 'border-violet/30',
    placeholder: 'sk-or-...',
    icon: '🌐'
  }
];

export function ApiKeysSettings() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [keys, setKeys] = useState<APIKeyStatus[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [keysData, usageData] = await Promise.all([
        getApiKeys(),
        getUsage()
      ]);
      setKeys(keysData);
      setUsage(usageData);
    } catch (err) {
      console.error('Failed to fetch BYOK data:', err);
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchData();
    }
  }, [isExpanded]);

  const handleSaveKey = async (provider: string) => {
    if (!newKey.trim()) return;

    setSavingProvider(provider);
    try {
      await setApiKey(provider, newKey.trim());
      setEditingProvider(null);
      setNewKey('');
      await fetchData();
    } catch (err) {
      console.error('Failed to save key:', err);
      setError(`Failed to save ${provider} key`);
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    setSavingProvider(provider);
    try {
      await deleteApiKey(provider);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete key:', err);
      setError(`Failed to delete ${provider} key`);
    } finally {
      setSavingProvider(null);
    }
  };

  const handleResetUsage = async () => {
    if (!confirm('Are you sure you want to reset all usage statistics?')) return;
    try {
      await resetUsage();
      await fetchData();
    } catch (err) {
      console.error('Failed to reset usage:', err);
    }
  };

  const getKeyStatus = (providerId: string): APIKeyStatus | undefined => {
    return keys.find(k => k.provider === providerId);
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
  };

  const configuredCount = keys.filter(k => k.configured).length;

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-amber" />
          </div>
          <span className="font-semibold text-text-primary">API Keys & Usage</span>
          {configuredCount > 0 && (
            <span className="tag tag-teal">{configuredCount} active</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-rose text-sm p-3 bg-rose/10 border border-rose/20 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Provider Keys */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-text-muted" />
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Provider Keys</label>
              </div>
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-background-tertiary/50 transition-colors"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid gap-3">
              {PROVIDERS.map((provider) => {
                const status = getKeyStatus(provider.id);
                const isEditing = editingProvider === provider.id;
                const isSaving = savingProvider === provider.id;

                return (
                  <div
                    key={provider.id}
                    className={`
                      relative overflow-hidden rounded-xl border transition-all duration-300
                      ${status?.configured
                        ? `${provider.bgColor} ${provider.borderColor}`
                        : 'bg-background-tertiary/30 border-border-subtle hover:border-border-medium'
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {status?.configured && (
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${provider.bgColor.replace('/10', '')}`} />
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${provider.bgColor} flex items-center justify-center text-lg`}>
                            {provider.icon}
                          </div>
                          <div>
                            <span className={`font-medium text-sm ${provider.color}`}>
                              {provider.name}
                            </span>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {provider.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {status?.configured ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                              <span className="text-[10px] text-teal font-medium">Active</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-text-ghost" />
                              <span className="text-[10px] text-text-muted">Not set</span>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex gap-2 mt-3">
                          <div className="relative flex-1">
                            <input
                              type={showKey ? 'text' : 'password'}
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                              placeholder={provider.placeholder}
                              className="input-base w-full text-xs pr-9"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={() => handleSaveKey(provider.id)}
                            disabled={!newKey.trim() || isSaving}
                            className="p-2.5 bg-teal text-background rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setEditingProvider(null); setNewKey(''); setShowKey(false); }}
                            className="p-2.5 border border-border-subtle rounded-lg hover:bg-background-tertiary transition-colors"
                          >
                            <X className="w-4 h-4 text-text-muted" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle/50">
                          <span className="text-xs font-mono text-text-muted">
                            {status?.configured ? status.masked_key : '••••••••••••'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingProvider(provider.id); setNewKey(''); }}
                              className={`text-xs font-medium ${provider.color} hover:underline`}
                            >
                              {status?.configured ? 'Update' : 'Add Key'}
                            </button>
                            {status?.configured && (
                              <button
                                onClick={() => handleDeleteKey(provider.id)}
                                disabled={isSaving}
                                className="text-xs text-rose hover:underline"
                              >
                                {isSaving ? '...' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Usage Statistics */}
          {usage && (usage.providers.length > 0 || usage.total_cost > 0) && (
            <div className="space-y-4 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-amber" />
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Usage Stats</label>
                </div>
                <button
                  onClick={handleResetUsage}
                  className="text-[10px] text-rose hover:underline font-medium"
                >
                  Reset All
                </button>
              </div>

              {/* Total Summary Card */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber/10 to-amber/5 border border-amber/20 p-4">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber" />
                      <span className="text-sm font-medium text-amber">Total Usage</span>
                    </div>
                    <span className="text-2xl font-mono font-bold text-amber">
                      {formatCost(usage.total_cost)}
                    </span>
                  </div>
                  <div className="flex gap-6 text-xs text-text-muted">
                    <div>
                      <span className="text-text-ghost">Input:</span>
                      <span className="ml-1 font-mono text-text-secondary">{formatTokens(usage.total_input_tokens)}</span>
                    </div>
                    <div>
                      <span className="text-text-ghost">Output:</span>
                      <span className="ml-1 font-mono text-text-secondary">{formatTokens(usage.total_output_tokens)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Provider Usage */}
              {usage.providers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium">By Provider</label>
                  <div className="space-y-1.5">
                    {usage.providers.map((provider) => {
                      const info = PROVIDERS.find(p => p.id === provider.provider);
                      return (
                        <div
                          key={provider.provider}
                          className="flex items-center justify-between p-3 rounded-xl bg-background-tertiary/30 border border-border-subtle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{info?.icon || '🔧'}</span>
                            <span className={`text-xs font-medium ${info?.color || 'text-text-secondary'}`}>
                              {info?.name || provider.provider}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-text-muted">{provider.requests} requests</span>
                            <span className="font-mono font-medium text-text-primary">{formatCost(provider.cost)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-Model Usage (top 5) */}
              {usage.models.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Top Models</label>
                  <div className="space-y-1.5">
                    {usage.models
                      .sort((a, b) => b.cost - a.cost)
                      .slice(0, 5)
                      .map((model) => (
                        <div
                          key={model.model}
                          className="flex items-center justify-between p-3 rounded-xl bg-background-tertiary/30 border border-border-subtle"
                        >
                          <span className="text-xs text-text-secondary truncate max-w-[160px] font-mono" title={model.model}>
                            {model.model.split('/').pop()}
                          </span>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-text-muted">{model.requests} req</span>
                            <span className="font-mono font-medium text-text-primary">{formatCost(model.cost)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {usage.last_updated && (
                <p className="text-[10px] text-text-ghost text-center pt-2">
                  Last updated: {new Date(usage.last_updated).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Empty State */}
          {(!usage || (usage.providers.length === 0 && usage.total_cost === 0)) && keys.some(k => k.configured) && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-background-tertiary/50 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-text-ghost" />
              </div>
              <p className="text-sm text-text-muted">No usage recorded yet</p>
              <p className="text-xs text-text-ghost mt-1">Start a reasoning session to see statistics</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
