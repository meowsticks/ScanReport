// Photo storage for cloud sync.
//
// Photos are uploaded to the Supabase `scan-photos` bucket and referenced by
// URL in the synced document, so the cloud copy stays tiny (text + links) and
// images are fetched once and cached — far cheaper on storage and egress than
// embedding base64 in every synced row.
//
// The LOCAL report keeps each photo's `dataUrl` as well, so the app still shows
// images and exports the PDF offline. Only the CLOUD copy is stripped to links.

import { supabase } from './supabase';

const BUCKET = 'scan-photos';

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadDataUrl(path, dataUrl) {
  const blob = await dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return publicUrl(path);
}

// Build the cloud copy: drop embedded base64 for any image that already lives
// in storage. Images not yet uploaded keep their base64 so they still appear
// (they'll be slimmed on the next successful sync).
export function toCloudDoc(report) {
  const scanPhotos = (report.scanPhotos || []).map((p) => {
    if (p.storagePath || p.url) {
      const { dataUrl, ...rest } = p;
      return rest;
    }
    return p;
  });
  const scanLocations = (report.scanLocations || []).map((l) => {
    if (l.photoPath || l.photoUrl) {
      const { photo, ...rest } = l;
      return rest;
    }
    return l;
  });
  const out = { ...report, scanPhotos, scanLocations };
  if (report.diagramImagePath) out.diagramImage = null;
  return out;
}

// Upload any images that aren't in storage yet. Returns the updated local
// report (storage path + url added, dataUrl kept) and whether anything changed.
export async function ensureUploaded(report, userId, reportId) {
  let changed = false;

  const scanPhotos = await Promise.all(
    (report.scanPhotos || []).map(async (p) => {
      if (p.dataUrl && !p.storagePath) {
        try {
          const path = `${userId}/${reportId}/${p.id}.jpg`;
          const url = await uploadDataUrl(path, p.dataUrl);
          changed = true;
          return { ...p, storagePath: path, url };
        } catch {
          return p; // leave as base64; retried on the next save
        }
      }
      return p;
    }),
  );

  const scanLocations = await Promise.all(
    (report.scanLocations || []).map(async (l) => {
      if (l.photo && !l.photoPath) {
        try {
          const path = `${userId}/${reportId}/loc-${l.id}.jpg`;
          const url = await uploadDataUrl(path, l.photo);
          changed = true;
          return { ...l, photoPath: path, photoUrl: url };
        } catch {
          return l;
        }
      }
      return l;
    }),
  );

  let diagramImagePath = report.diagramImagePath;
  let diagramImageUrl = report.diagramImageUrl;
  if (report.diagramImage && !report.diagramImagePath) {
    try {
      const path = `${userId}/${reportId}/diagram.jpg`;
      diagramImageUrl = await uploadDataUrl(path, report.diagramImage);
      diagramImagePath = path;
      changed = true;
    } catch { /* keep base64 */ }
  }

  if (!changed) return { report, changed: false };
  return {
    changed: true,
    report: { ...report, scanPhotos, scanLocations, diagramImagePath, diagramImageUrl },
  };
}
