// Live cross-device sync of the report document via Supabase.
//
// Photos live in Supabase Storage; the synced row holds only text + links, so
// it stays tiny and cheap (see photoStorage.js). The LOCAL report keeps base64
// for offline display and PDF — only the CLOUD copy is stripped to links.
//
// SAFETY: we never silently overwrite work. If this device and the cloud both
// hold a non-empty, different report on sign-in, we surface a conflict and let
// the user choose. Echo suppression compares the cloud-shaped JSON we last
// wrote/received. Realtime pings trigger a full re-fetch (payloads can be big).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { ensureUploaded, toCloudDoc } from './photoStorage';

const SAVE_DEBOUNCE_MS = 1200;

function reportHasContent(r) {
  if (!r || typeof r !== 'object') return false;
  return (
    (Array.isArray(r.scanPhotos) && r.scanPhotos.length > 0) ||
    (Array.isArray(r.targets) && r.targets.length > 0) ||
    (Array.isArray(r.cores) && r.cores.length > 0) ||
    (Array.isArray(r.scanLocations) && r.scanLocations.length > 0) ||
    !!(r.client || r.projectNo || r.siteAddress || r.scanArea || r.diagramImage || r.diagramImageUrl)
  );
}

export function useCloudSync({ session, report, applyRemote }) {
  // 'off' | 'connecting' | 'synced' | 'saving' | 'error' | 'conflict'
  const [status, setStatus] = useState('off');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [conflict, setConflict] = useState(null);

  const userId = session?.user?.id ?? null;

  const reportRef = useRef(report);
  const applyRemoteRef = useRef(applyRemote);
  const reportIdRef = useRef(null);
  const lastSyncedJsonRef = useRef(null); // cloud-shaped JSON we last wrote/received
  const saveTimerRef = useRef(null);
  const channelRef = useRef(null);
  const conflictRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => { reportRef.current = report; }, [report]);
  useEffect(() => { applyRemoteRef.current = applyRemote; }, [applyRemote]);
  useEffect(() => { conflictRef.current = conflict; }, [conflict]);

  // Upload any new photos, then write the slim cloud document. Returns error|null.
  const pushLocal = useCallback(async (localReport) => {
    const id = reportIdRef.current;
    if (!id || !userId) return null;
    let working = localReport;
    try {
      const { report: uploaded, changed } = await ensureUploaded(localReport, userId, id);
      if (changed) { working = uploaded; applyRemoteRef.current?.(uploaded); }
    } catch { /* fall back to embedding base64 in the doc */ }
    const cloudDoc = toCloudDoc(working);
    lastSyncedJsonRef.current = JSON.stringify(cloudDoc);
    const { error } = await supabase
      .from('reports')
      .update({ data: cloudDoc, name: cloudDoc?.projectNo || 'Scan report' })
      .eq('id', id);
    return error || null;
  }, [userId]);

  const startRealtime = useCallback(() => {
    if (!userId || channelRef.current) return;
    const pull = async () => {
      const id = reportIdRef.current;
      if (!id || conflictRef.current) return;
      const { data, error } = await supabase
        .from('reports').select('data').eq('id', id).single();
      if (error || !data) return;
      const remoteJson = JSON.stringify(data.data ?? {});
      if (remoteJson === lastSyncedJsonRef.current) return;
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
        const localCloudJson = JSON.stringify(toCloudDoc(local));

        if (rows && rows.length > 0) {
          reportIdRef.current = rows[0].id;
          const remote = rows[0].data ?? {};
          const remoteJson = JSON.stringify(remote);

          if (remoteJson === localCloudJson) {
            lastSyncedJsonRef.current = remoteJson;            // already in sync
          } else if (!reportHasContent(remote)) {
            await pushLocal(local);                            // cloud empty -> push local up
          } else if (!reportHasContent(local)) {
            lastSyncedJsonRef.current = remoteJson;            // local empty -> load cloud
            applyRemoteRef.current?.(remote);
          } else {
            setConflict({ cloudData: remote });                // both differ -> ask
            setStatus('conflict');
            return;
          }
        } else {
          const { data: created, error: insErr } = await supabase
            .from('reports')
            .insert({ owner: userId, name: local?.projectNo || 'Scan report', data: {} })
            .select('id').single();
          if (cancelledRef.current) return;
          if (insErr) { setStatus('error'); return; }
          reportIdRef.current = created.id;
          await pushLocal(local);
        }

        if (cancelledRef.current) return;
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
  }, [userId, startRealtime, pushLocal]);

  // ---- User picks which version to keep on conflict ----
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
        await pushLocal(reportRef.current);
      }
      setStatus('synced');
      setLastSyncedAt(Date.now());
      startRealtime();
    } catch {
      setStatus('error');
    }
  }, [pushLocal, startRealtime]);

  // ---- Push local edits (debounced; paused during a conflict) ----
  useEffect(() => {
    if (!userId || !reportIdRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (conflictRef.current) return;
      const cloudJson = JSON.stringify(toCloudDoc(reportRef.current));
      if (cloudJson === lastSyncedJsonRef.current) return; // our echo / no change
      setStatus('saving');
      const error = await pushLocal(reportRef.current);
      setStatus(error ? 'error' : 'synced');
      if (!error) setLastSyncedAt(Date.now());
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [report, userId, pushLocal]);

  return { status, lastSyncedAt, conflict, resolveConflict };
}
