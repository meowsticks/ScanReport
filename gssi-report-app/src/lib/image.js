// Downscale + JPEG-compress an uploaded image before we store it.
//
// Camera photos are often 3–8 MB each. Embedding them at full size bloats the
// report, slows saving/sync, and (once synced) drives up cloud storage cost.
// Capping the long edge at ~1600px and encoding JPEG ~0.72 keeps photos sharp
// enough for a report while cutting size by roughly 10x.

const MAX_DIM = 1600;
const QUALITY = 0.72;

export async function compressImage(file, { maxDim = MAX_DIM, quality = QUALITY } = {}) {
  try {
    const dataUrl = await readAsDataURL(file);
    return await downscale(dataUrl, maxDim, quality);
  } catch {
    // Never block an upload on a compression failure — fall back to the original.
    try { return await readAsDataURL(file); } catch { return null; }
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downscale(dataUrl, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longEdge = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, maxDim / longEdge);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', quality);
      // Keep whichever is smaller (re-encoding a tiny image can grow it).
      resolve(out && out.length < dataUrl.length ? out : dataUrl);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
