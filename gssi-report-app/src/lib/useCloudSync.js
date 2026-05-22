// Live cross-device sync of the report document via Supabase.
//
// Model: one row per user in `public.reports` (the most recent is "the" report
// for now). On sign-in we load the cloud copy; local edits are debounced up to
// the cloud; a realtime subscription tells other devices to pull the latest.
//
// Echo suppression: we remember the JSON we last wrote/received and ignore any
// incoming copy that matches it, so a device never fights its own save.
//
// We deliberately re-fetch the full row on a realtime ping instead of trusting
// the broadcast payload — realtime drops large payloads, and report documents
// (which still embed photos) can be large.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const SAVE_DEBOUNCE_MS = 1200;

export function useCloudSync({ session, report, applyRemote }) {
  // 'off' | 'connecting' | 'synced' | 'saving' | 'error'
  const [status, setStatus] = useState('off');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const userId = session?.user?.id ?? null;

  const reportRef = useRef(report);
  const applyRemoteRef = useRef(applyRemote);
  const reportIdRef = useRef(null);
  const lastSyncedJsonRef = useRef(null); // JSON we last wrote OR pulled
  const saveTimerRef = useRef(null);

  useEffect(() => { reportRef.current = report; }, [report]);
  useEffect(() => { applyRemoteRef.current = applyRemote; }, [applyRemote]);

  // ---- Connect on sign-in: load or create the cloud row, then subscribe ----
  useEffect(() => {
    if (!userId) {
      setStatus('off');
      reportIdRef.current = null;
      lastSyncedJsonRef.current = null;
      return;
    }

    let cancelled = false;
    let channel = null;

    const pull = async () => {
      const id = reportIdRef.current;
      if (!id) return;
      const { data, error } = await supabase
        .from('reports').select('data').eq('id', id).single();
      if (cancelled || error || !data) return;
      const remoteJson = JSON.stringify(data.data ?? {});
      if (remoteJson === lastSyncedJsonRef.current) return; // our own echo / no change
      lastSyncedJsonRef.current = remoteJson;
      applyRemoteRef.current?.(data.data ?? {});
      setLastSyncedAt(Date.now());
    };

    const init = async () => {
      setStatus('connecting');
      try {
        const { data: rows, error } = await supabase
          .from('reports')
          .select('id, data')
          .eq('owner', userId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (error) { setStatus('error'); return; }

        if (rows && rows.length > 0) {
          reportIdRef.current = rows[0].id;
          const remote = rows[0].data ?? {};
          lastSyncedJsonRef.current = JSON.stringify(remote);
          // Cloud wins on connect, but only if it actually holds a report.
          if (remote && Object.keys(remote).length > 0) {
            applyRemoteRef.current?.(remote);
          }
        } else {
          const local = reportRef.current;
          const { data: created, error: insErr } = await supabase
            .from('reports')
            .insert({ owner: userId, name: local?.projectNo || 'Scan report', data: local })
            .select('id').single();
          if (cancelled) return;
          if (insErr) { setStatus('error'); return; }
          reportIdRef.current = created.id;
          lastSyncedJsonRef.current = JSON.stringify(local);
        }

        setStatus('synced');
        setLastSyncedAt(Date.now());

        channel = supabase
          .channel(`reports-${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reports', filter: `owner=eq.${userId}` },
            () => { pull(); },
          )
          .subscribe();
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    init();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  // ---- Push local edits (debounced) ----
  useEffect(() => {
    if (!userId || !reportIdRef.current) return;
    const currentJson = JSON.stringify(report);
    if (currentJson === lastSyncedJsonRef.current) return; // unchanged or a remote apply

    setStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const snapshot = reportRef.current;
      const json = JSON.stringify(snapshot);
      lastSyncedJsonRef.current = json; // claim it as ours before the write to suppress echo
      const { error } = await supabase
        .from('reports')
        .update({ data: snapshot, name: snapshot?.projectNo || 'Scan report' })
        .eq('id', reportIdRef.current);
      setStatus(error ? 'error' : 'synced');
      if (!error) setLastSyncedAt(Date.now());
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [report, userId]);

  const retry = useCallback(() => {
    if (userId) setStatus((s) => (s === 'error' ? 'connecting' : s));
  }, [userId]);

  return { status, lastSyncedAt, retry };
}
