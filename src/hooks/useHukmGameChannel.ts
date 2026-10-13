import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getGameState } from '@/lib/hukmApi';

interface HukmSignal {
  status: string;
  current_index: number;
}

interface UseHukmGameChannelOptions {
  gameId: string | null;
  tokens?: { host_token?: string; player_token?: string; player_id?: string };
  onState: (state: any) => void;
  enabled?: boolean;
  /** Ustoz klienti lobby va savol holatida 2s polling qiladi (o'yinchilar ro'yxati va javoblar soni yangilanishi uchun) */
  fastPoll?: boolean;
}

const FAST_POLL_MS = 2_000;
const SLOW_POLL_MS = 10_000;
const RECONNECT_DELAY_MS = 300;

export function useHukmGameChannel({ gameId, tokens, onState, enabled = true, fastPoll = false }: UseHukmGameChannelOptions) {
  const [channelError, setChannelError] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const channelRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStateRef = useRef(onState);
  const tokensRef = useRef(tokens);
  const gameIdRef = useRef(gameId);
  const enabledRef = useRef(enabled);
  const fastPollRef = useRef(fastPoll);
  const destroyedRef = useRef(false);

  useEffect(() => { onStateRef.current = onState; }, [onState]);
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { fastPollRef.current = fastPoll; }, [fastPoll]);

  const fetchState = useCallback(async () => {
    const gid = gameIdRef.current;
    if (!gid || !enabledRef.current) return;
    try {
      const state = await getGameState(gid, tokensRef.current);
      if (state?.id) onStateRef.current(state);
    } catch {
      // Tarmoq xatosi — keyinroq urinamiz
    }
  }, []);

  const startPolling = useCallback((forceFast: boolean) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = (forceFast || fastPollRef.current) ? FAST_POLL_MS : SLOW_POLL_MS;
    pollRef.current = setInterval(fetchState, interval);
  }, [fetchState]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const connectChannel = useCallback(() => {
    const gid = gameIdRef.current;
    if (!gid || !enabledRef.current || destroyedRef.current) return;

    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }

    try {
      const channelName = `hukm:${gid}`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'state' }, (msg: any) => {
        const payload: HukmSignal = msg.payload;
        if (!payload?.status) return;
        const delay = Math.random() * 400;
        setTimeout(() => { fetchState(); }, delay);
      });

      channel.subscribe((status: string) => {
        if (destroyedRef.current) return;
        if (status === 'SUBSCRIBED') {
          setChannelError(false);
          setReconnecting(false);
          startPolling(false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelError(true);
          setReconnecting(true);
          startPolling(true);
          setTimeout(() => {
            if (!destroyedRef.current && enabledRef.current) {
              connectChannel();
            }
          }, 3000);
        }
      });

      channelRef.current = channel;
    } catch (err) {
      // Realtime/WebSocket mavjud bo'lmagan muxitda (mas. Telegram iOS WebView)
      // channel() yoki subscribe() tashlaydi — polling'ga tushamiz
      console.warn('[hukm-channel] realtime ulanmadi, polling ishlatiladi:', err);
      setChannelError(true);
      startPolling(true);
    }
  }, [fetchState, startPolling]);

  // visibilitychange — sahifa ko'ringanda darhol holat olib kanalga qaytadan ulanamiz
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !destroyedRef.current && enabledRef.current) {
        fetchState();
        connectChannel();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchState, connectChannel]);

  // Asosiy ulanish
  useEffect(() => {
    destroyedRef.current = false;
    if (!gameId || !enabled) {
      stopPolling();
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
      return;
    }

    // Dastlabki holatni darhol olamiz
    fetchState();
    connectChannel();

    return () => {
      destroyedRef.current = true;
      stopPolling();
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
    };
  }, [gameId, enabled, fetchState, connectChannel, stopPolling]);

  return { channelError, reconnecting };
}
