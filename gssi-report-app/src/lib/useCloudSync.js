// Live cross-device sync of the report document via Supabase.
//
// Model: one row per user in `public.reports`. On sign-in we reconcile the
// local report with the cloud copy; local edits are debounced up to the cloud;
// a realtime subscription tells other devices to pull the latest.
//
// SAFETY: we NEVER silently overwrite work. If both this device and the cloud
// hold a non-empty — and different — report on sign-in, we surface a conflict
// and let the user choose which to keep. Nothing is replaced until they pick.
//
// Echo suppression: we remember the JSON we last wrote/received and ignore any
// incoming copy that matches it. We re-fetch the full row on a realtime ping
// (rather than trust the broadcast payload) because realtime drops large
// payloads and report documents can be big.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const SAVE_DEBOUNCE_MS = 1200;

// "Has the user actually entered anything?" — used to decide whether loading the
// cloud copy would destroy real local work.
function reportHasContent(r) {
  if (!r || typeof r !== 'object') return false;
  return (
    (Array.isArray(r.scanPhotos) && r.scanPhotos.length > 0) ||
    (Array.isArray(r.targets) && r.targets.length > 0) ||
    (Array.isArray(r.cores) && r.cores.length > 0) ||
    (Array.isArray(r.scanLocations) && r.scanLocations.length > 0) ||
    !!(r.client || r.projectNo || r.siteAddress || r.scanArea || r.diagramImage)
  );
}

export function useCloudSync({ session, report, applyRemote }) {
  // 'off' | 'connecting' | 'synced' | 'saving' | 'error' | 'conflict'
  const [status, setStatus] = useState('off');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [conflict, setConflict] = useState(null); // null | { cloudData }

  const userId = session?.user?.id ?? null;

  const reportRef = useRef(report);
  const applyRemoteRef = useRef(applyRemote);
  const reportIdRef = useRef(null);
  const lastSyncedJsonRef = useRef(null); // JSON we last wrote OR pulled
  const saveTimerRef = useRef(null);
  const channelRef = useRef(null);
  const conflictRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => { reportRef.current = report; }, [report]);
  useEffect(() => { applyRemoteRef.current = applyRemote; }, [applyRemote]);
  useEffect(() => { conflictRef.current = conflict; }, [conflict]);

  // Subscribe to realtime once the initial state is settled.
  const startRealtime = useCallback(() => {
    if (!userId || channelRef.current) return;
    const pull = async () => {
      const id = reportIdRef.current;
      if (!id || conflictRef.current) return;
      const { data, error } = await supabase
        .from('reports').select('data').eq('id', id).single();
      if (error || !data) return;
      const remoteJson = JSON.stringify(data.data ?? {});
      if (remoteJson === lastSyncedJsonRef.current) return; // our echo / no change
      lastSyncedJsonRef.current = remoteJson;
      applyRemoteRef.current?.(data.data ?? {});
      setLastSyncedAt(Date.now());
    };
    channelRef.current = supabase
      .channel(`reports-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports', filter: `owner=eq.${userId}` },
        () => { pull(); },
      )
      .subscribe();
  }, [userId]);

  // ---- Reconcile on sign-in ----
  useEffect(() => {
    cancelledRef.current = false;
    if (!userId) {
      setStatus('off');
      setConflict(null);
      reportIdRef.current = null;
      lastSyncedJsonRef.current = null;
      return;
    }

    const init = async () => {
      setStatus('connecting');
      try {
        const { data: rows, error } = await supabase
          .from('reports')
          .select('id, data')
          .eq('owner', userId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (cancelledRef.current) return;
        if (error) { setStatus('error'); return; }

        const local = reportRef.current;
        const localJson = JSON.stringify(local);

        if (rows && rows.length > 0) {
          reportIdRef.current = rows[0].id;
          const remote = rows[0].data ?? {};
          const remoteJson = JSON.stringify(remote);

          if (remoteJson === localJson) {
            lastSyncedJsonRef.current = remoteJson;            // already in sync
          } else if (!reportHasContent(remote)) {
            lastSyncedJsonRef.current = localJson;             // cloud empty -> push local up
            await supabase.from('reports')
              .update({ data: local, name: local?.projectNo || 'Scan report' })
              .eq('id', reportIdRef.current);
          } else if (!reportHasContent(local)) {
            lastSyncedJsonRef.current = remoteJson;            // local empty -> safe to load cloud
            applyRemoteRef.current?.(remote);
          } else {
            setConflict({ cloudData: remote });               // both have work -> ASK, never overwrite
            setStatus('conflict');
            return;
          }
        } else {
          const { data: created, error: insErr } = await supabase
            .from('reports')
            .insert({ owner: userId, name: local?.projectNo || 'Scan report', data: local })
            .select('id').single();
          if (cancelledRef.current) return;
          if (insErr) { setStatus('error'); return; }
          reportIdRef.current = created.id;
          lastSyncedJsonRef.current = localJson;
        }

        setStatus('synced');
        setLastSyncedAt(Date.now());
        startRealtime();
      } catch {
        if (!cancelledRef.current) setStatus('error');
      }
    };

    init();
    return () => {
      cancelledRef.current = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [userId, startRealtime]);

  // ---- User picks which version to keep when there's a conflict ----
  const resolveConflict = useCallback(async (choice) => {
    const cur = conflictRef.current;
    if (!cur || !reportIdRef.current) return;
    setConflict(null);
    setStatus('connecting');
    try {
      if (choice === 'cloud') {
        lastSyncedJsonRef.current = JSON.stringify(cur.cloudData);
        applyRemoteRef.current?.(cur.cloudData);
      } else {
        const local = reportRef.current;                      // keep this device -> push it up
        lastSyncedJsonRef.current = JSON.stringify(local);
        await supabase.from('reports')
          .update({ data: local, name: local?.projectNo || 'Scan report' })
          .eq('id', reportIdRef.current);
      }
      setStatus('synced');
      setLastSyncedAt(Date.now());
      startRealtime();
    } catch {
      setStatus('error');
    }
  }, [startRealtime]);

  // ---- Push local edits (debounced; paused during a conflict) ----
  useEffect(() => {
    if (!userId || !reportIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (conflictRef.current) return; // don't write until the user resolves
      const snapshot = reportRef.current;
      const json = JSON.stringify(snapshot);
      if (json === lastSyncedJsonRef.current) return; // our echo / no change
      lastSyncedJsonRef.current = json;
      setStatus('saving');
      const { error } = await supabase
        .from('reports')
        .update({ data: snapshot, name: snapshot?.projectNo || 'Scan report' })
        .eq('id', reportIdRef.current);
      setStatus(error ? 'error' : 'synced');
      if (!error) setLastSyncedAt(Date.now());
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [report, userId]);

  return { status, lastSyncedAt, conflict, resolveConflict };
}
