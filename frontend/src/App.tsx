import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Clock, Coins, Hash, Sparkles, Zap } from 'lucide-react';
import { TaskInput } from './components/TaskInput';
import { ReasoningViewer } from './components/ReasoningViewer';
import { ModelConfig } from './components/ModelConfig';
import { SessionManager } from './components/SessionManager';
import { ContextUpload } from './components/ContextUpload';
import { ApiKeysSettings } from './components/ApiKeysSettings';
import { ModelLeaderboard } from './components/ModelLeaderboard';
import { useReasoningStore } from './stores/reasoningStore';
import { healthCheck } from './lib/api';

function App() {
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('reasonloop-theme');
    return (saved === 'light' ? 'light' : 'dark') as 'dark' | 'light';
  });
  const { status, iterations, wsConnected, sessionId } = useReasoningStore();

  // Apply theme to body
  useEffect(() => {
    document.body.classList.remove('light');
    if (theme === 'light') {
      document.body.classList.add('light');
    }
    localStorage.setItem('reasonloop-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const checkBackend = async () => {
      const connected = await healthCheck();
      setBackendConnected(connected);
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'running' && !startTime) {
      setStartTime(Date.now());
    } else if (status !== 'running') {
      setStartTime(null);
    }
  }, [status, startTime]);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedTokens = iterations.reduce((acc, iter) => {
    const genTokens = iter.generation ? Math.ceil(iter.generation.length / 4) : 0;
    const critTokens = iter.critique?.raw_critique ? Math.ceil(iter.critique.raw_critique.length / 4) : 0;
    return acc + genTokens + critTokens;
  }, 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Premium Header */}
      <header className="relative z-20">
        {/* Gradient border bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber/30 to-transparent" />

        <div className="max-w-[1800px] mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              {/* Animated logo mark */}
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber via-amber-light to-amber flex items-center justify-center shadow-lg shadow-amber/20">
                  <Sparkles className="w-6 h-6 text-background" />
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-amber/20 blur-xl -z-10" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  <span className="gradient-text">Reason</span>
                  <span className="text-text-primary">Loop</span>
                </h1>
                <p className="text-xs text-text-muted font-medium tracking-wide uppercase">
                  Iterative AI Reasoning Engine
                </p>
              </div>
            </div>

            {/* Status Indicators & Theme Toggle */}
            <div className="flex items-center gap-6">
              {/* Connection Status */}
              <div className="flex items-center gap-3">
                {backendConnected === null ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-text-ghost/20">
                    <div className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
                    <span className="text-xs text-text-muted">Connecting...</span>
                  </div>
                ) : backendConnected ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal/10 border border-teal/20">
                    <Wifi className="w-3.5 h-3.5 text-teal" />
                    <span className="text-xs text-teal font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose/10 border border-rose/20">
                    <WifiOff className="w-3.5 h-3.5 text-rose" />
                    <span className="text-xs text-rose font-medium">Offline</span>
                  </div>
                )}

                {wsConnected && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber/10 border border-amber/20">
                    <div className="status-dot status-dot-active" />
                    <span className="text-xs text-amber font-medium">Live</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-border-subtle" />

              {/* Theme Toggle */}
              <div className="flex items-center gap-3">
                <span className="theme-label">{theme}</span>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] mx-auto px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-5">
            {/* Task Input Card - Hero of the sidebar */}
            <div className="card card-glow p-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber/20 to-amber/5 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">New Task</h2>
                  <p className="text-xs text-text-muted">What would you like to reason about?</p>
                </div>
              </div>
              <TaskInput />
            </div>

            {/* Collapsible Sections */}
            <div className="space-y-3 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
              <ContextUpload />
            </div>

            <div className="space-y-3 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
              <ModelConfig />
            </div>

            <div className="space-y-3 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
              <ApiKeysSettings />
            </div>

            <div className="space-y-3 animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
              <ModelLeaderboard />
            </div>

            <div className="space-y-3 animate-fade-in-up stagger-5" style={{ opacity: 0 }}>
              <SessionManager />
            </div>
          </div>

          {/* Main Content - Reasoning Viewer */}
          <div className="lg:col-span-8 xl:col-span-8 animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <div className="card p-6 min-h-[700px] flex flex-col relative overflow-hidden">
              {/* Decorative corner gradient */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber/5 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-teal/5 to-transparent pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <ReasoningViewer />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats Footer - Only when session active */}
      {sessionId && (
        <footer className="relative z-20 animate-fade-in-up">
          {/* Gradient border top */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber/20 to-transparent" />

          <div className="max-w-[1800px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Stats */}
              <div className="flex items-center gap-8">
                {/* Iterations */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
                    <Hash className="w-4 h-4 text-amber" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Iterations</p>
                    <p className="text-lg font-mono font-semibold text-text-primary">
                      {iterations.length}
                    </p>
                  </div>
                </div>

                <div className="w-px h-10 bg-gradient-to-b from-transparent via-border-subtle to-transparent" />

                {/* Elapsed Time */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center group-hover:bg-violet/20 transition-colors">
                    <Clock className="w-4 h-4 text-violet" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Elapsed</p>
                    <p className="text-lg font-mono font-semibold text-text-primary">
                      {formatTime(elapsedTime)}
                    </p>
                  </div>
                </div>

                <div className="w-px h-10 bg-gradient-to-b from-transparent via-border-subtle to-transparent" />

                {/* Tokens */}
                <div className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center group-hover:bg-teal/20 transition-colors">
                    <Coins className="w-4 h-4 text-teal" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Est. Tokens</p>
                    <p className="text-lg font-mono font-semibold text-text-primary">
                      {estimatedTokens.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`
                flex items-center gap-2 px-4 py-2 rounded-full
                ${status === 'running'
                  ? 'bg-amber/10 border border-amber/30'
                  : status === 'completed'
                  ? 'bg-teal/10 border border-teal/30'
                  : status === 'error'
                  ? 'bg-rose/10 border border-rose/30'
                  : 'bg-text-ghost/20 border border-border-subtle'
                }
              `}>
                <div className={`
                  w-2 h-2 rounded-full
                  ${status === 'running'
                    ? 'bg-amber animate-pulse'
                    : status === 'completed'
                    ? 'bg-teal'
                    : status === 'error'
                    ? 'bg-rose'
                    : 'bg-text-muted'
                  }
                `} />
                <span className={`
                  text-sm font-medium capitalize
                  ${status === 'running'
                    ? 'text-amber'
                    : status === 'completed'
                    ? 'text-teal'
                    : status === 'error'
                    ? 'text-rose'
                    : 'text-text-muted'
                  }
                `}>
                  {status}
                </span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Minimal Footer when no session */}
      {!sessionId && (
        <footer className="relative z-20 py-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
          <div className="max-w-[1800px] mx-auto px-8 text-center">
            <p className="text-sm text-text-muted">
              <span className="text-amber">Generate</span>
              <span className="mx-2 text-text-ghost">&rarr;</span>
              <span className="text-rose">Critique</span>
              <span className="mx-2 text-text-ghost">&rarr;</span>
              <span className="text-teal">Refine</span>
              <span className="mx-2 text-text-ghost">&rarr;</span>
              <span className="text-violet">Repeat</span>
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
