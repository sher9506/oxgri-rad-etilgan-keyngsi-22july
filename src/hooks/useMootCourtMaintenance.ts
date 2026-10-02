import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Moot Court maintenance rejimi hook.
 * Uchta usul bilan yangilab turadi:
 *   a) Supabase Realtime obuna
 *   b) 15 soniyada polling
 *   c) visibilitychange — tab qaytadan ko'rinsa darhol tekshirish
 *
 * Returns:
 *   - maintenance: boolean — rejim yoqilganmi
 *   - loading: boolean — birinchi tekshiruv tugamaguncha true
 */
export function useMootCourtMaintenance() {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('value')
        .eq('key', 'MOOT_COURT_MAINTENANCE')
        .maybeSingle();

      if (error) {
        if (mountedRef.current) setMaintenance(true);
        return;
      }

      if (mountedRef.current) {
        setMaintenance(data?.value === 'true');
      }
    } catch {
      if (mountedRef.current) setMaintenance(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();

    // a) Realtime obuna
    const channel = supabase
      .channel('moot-court-maintenance')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
          filter: 'key=eq.MOOT_COURT_MAINTENANCE',
        },
        () => { check(); }
      )
      .subscribe();

    // b) Polling — 15 soniyada
    const pollInterval = setInterval(check, 15000);

    // c) visibilitychange
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [check]);

  return { maintenance, loading };
}
