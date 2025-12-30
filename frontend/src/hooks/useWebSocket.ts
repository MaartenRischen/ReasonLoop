import { useEffect, useRef, useCallback } from 'react';
import { useReasoningStore } from '../stores/reasoningStore';
import type { CritiqueResult } from '../stores/reasoningStore';
import { createReasoningWebSocket } from '../lib/api';

interface ReasoningEvent {
  type: string;
  session_id: string;
  iteration: number;
  content: string;
  score?: number;
  critique?: CritiqueResult;
  timestamp: string;
}

export function useReasoningWebSocket(sessionId: string | null, shouldConnect: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const connectedSessionRef = useRef<string | null>(null);
  const isIntentionalCloseRef = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const connect = useCallback((sid: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return; // Already connected or connecting
    }

    console.log('Connecting WebSocket for session:', sid);
    isIntentionalCloseRef.current = false;

    const ws = createReasoningWebSocket(sid);
    wsRef.current = ws;
    connectedSessionRef.current = sid;

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      useReasoningStore.getState().setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: ReasoningEvent = JSON.parse(event.data);
        console.log('WS Event:', data.type);

        const currentStore = useReasoningStore.getState();

        switch (data.type) {
          case 'session_started':
            currentStore.setStatus('running');
            break;

          case 'generation_start':
            currentStore.startGeneration(data.iteration);
            break;

          case 'generation_chunk':
            currentStore.appendGenerationChunk(data.content);
            break;

          case 'generation_complete':
            currentStore.completeGeneration(data.content);
            break;

          case 'critique_start':
            currentStore.startCritique();
            break;

          case 'critique_chunk':
            currentStore.appendCritiqueChunk(data.content);
            break;

          case 'critique_complete':
            if (data.critique) {
              currentStore.completeCritique(data.critique);
            }
            break;

          case 'iteration_complete':
            if (data.critique && data.score !== undefined) {
              currentStore.completeIteration(data.content, data.score, data.critique);
            }
            break;

          case 'session_complete':
            currentStore.completeSession(data.content, data.score || 0);
            // Intentionally close after completion
            isIntentionalCloseRef.current = true;
            break;

          case 'session_stopped':
            currentStore.setStatus('stopped');
            isIntentionalCloseRef.current = true;
            break;

          case 'session_paused':
            currentStore.setStatus('paused');
            break;

          case 'session_resumed':
            currentStore.setStatus('running');
            break;

          case 'session_error':
            console.error('Session error:', data.content);
            currentStore.setStatus('error');
            isIntentionalCloseRef.current = true;
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed, code:', event.code, 'reason:', event.reason);
      useReasoningStore.getState().setWsConnected(false);

      // Attempt reconnect if not intentional and session is still running
      const store = useReasoningStore.getState();
      if (!isIntentionalCloseRef.current &&
          store.status === 'running' &&
          connectedSessionRef.current === sid &&
          reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        console.log(`Reconnecting (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
        setTimeout(() => connect(sid), 1000 * reconnectAttempts.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !shouldConnect) {
      // Clean up if session is cleared or we shouldn't connect
      if (wsRef.current) {
        isIntentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
      connectedSessionRef.current = null;
      return;
    }

    // Don't reconnect if already connected to this session
    if (connectedSessionRef.current === sessionId &&
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if connecting to a different session
    if (wsRef.current && connectedSessionRef.current !== sessionId) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Reset reconnect attempts for new session
    reconnectAttempts.current = 0;
    connect(sessionId);

    return () => {
      // Only clean up on unmount, not on re-renders
      // The WebSocket will be cleaned up when sessionId changes or becomes null
    };
  }, [sessionId, shouldConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up WebSocket');
      isIntentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
}
