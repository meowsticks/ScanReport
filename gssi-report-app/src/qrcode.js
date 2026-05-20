// Tiny pure-JS QR encoder — no dependencies.
// Implements QR Code (version 1-10, byte mode, ECC level M).
// Lifted from the standalone qr_generator.jsx so the report can stamp a QR
// on the cover without pulling in an npm dependency.

const QRGen = (() => {
  // Galois field tables for Reed-Solomon
  const EXP = new Uint8Array(256);
  const LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    EXP[255] = EXP[0];
  })();

  const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[(LOG[a] + LOG[b]) % 255];

  const rsGeneratorPoly = (degree) => {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  };

  const rsEncode = (data, eccLen) => {
    const gen = rsGeneratorPoly(eccLen);
    const result = [...data, ...new Array(eccLen).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const coef = result[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          result[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return result.slice(data.length);
  };

  // Version capacity table for ECC level M, byte mode (data codewords)
  const VERSION_CAPACITY_M = [
    null, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
    251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
    711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370,
    1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331,
  ];

  // ECC blocks for level M (version, total ecc). Versions 1-10 for short URLs.
  const ECC_M = {
    1:  { total: 10, blocks: 1 },
    2:  { total: 16, blocks: 1 },
    3:  { total: 26, blocks: 1 },
    4:  { total: 18, blocks: 2 },
    5:  { total: 24, blocks: 2 },
    6:  { total: 16, blocks: 4 },
    7:  { total: 18, blocks: 4 },
    8:  { total: 22, blocks: 4 },
    9:  { total: 22, blocks: 5 },
    10: { total: 26, blocks: 5 },
  };

  const pickVersion = (dataLen) => {
    for (let v = 1; v <= 10; v++) {
      if (VERSION_CAPACITY_M[v] >= dataLen) return v;
    }
    return null;
  };

  // Convert string to data codewords (byte mode)
  const encodeData = (text, version) => {
    const bytes = new TextEncoder().encode(text);
    const bits = [];
    // Mode indicator: byte mode = 0100
    bits.push(0, 1, 0, 0);
    // Character count indicator (8 bits for version 1-9, 16 bits for 10+)
    const ccBits = version < 10 ? 8 : 16;
    for (let i = ccBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
    // Data
    for (const b of bytes) {
      for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    }
    // Terminator (up to 4 bits of 0)
    const capacityBits = VERSION_CAPACITY_M[version] * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Convert to bytes
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    // Pad bytes: alternating 0xEC, 0x11
    const pad = [0xEC, 0x11];
    let p = 0;
    while (codewords.length < VERSION_CAPACITY_M[version]) {
      codewords.push(pad[p % 2]);
      p++;
    }
    return codewords;
  };

  const buildMatrix = (version) => {
    const size = 17 + version * 4;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    // Finder patterns
    const placeFinder = (r, c) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const inFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          if (inFinder) {
            const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
            const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
            matrix[rr][cc] = (onBorder || inCenter) ? 1 : 0;
          } else {
            matrix[rr][cc] = 0;
          }
          reserved[rr][cc] = true;
        }
      }
    };
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
      reserved[6][i] = true;
      reserved[i][6] = true;
    }

    // Dark module
    matrix[size - 8][8] = 1;
    reserved[size - 8][8] = true;

    // Reserve format info areas
    for (let i = 0; i < 9; i++) {
      if (matrix[8][i] === null) reserved[8][i] = true;
      if (matrix[i][8] === null) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }

    // Alignment pattern (version 2+)
    if (version >= 2) {
      const positions = {
        2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
        6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
      }[version];
      for (const r of positions) {
        for (const cc of positions) {
          if (reserved[r][cc]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const onEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2;
              const center = dr === 0 && dc === 0;
              matrix[r + dr][cc + dc] = (onEdge || center) ? 1 : 0;
              reserved[r + dr][cc + dc] = true;
            }
          }
        }
      }
    }

    return { matrix, reserved, size };
  };

  const placeData = (matrix, reserved, size, bits) => {
    let bitIdx = 0;
    let dir = -1; // -1 = up, 1 = down
    let col = size - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const row = dir === -1 ? size - 1 - i : i;
        for (let c = 0; c < 2; c++) {
          const cc = col - c;
          if (!reserved[row][cc]) {
            matrix[row][cc] = bitIdx < bits.length ? bits[bitIdx] : 0;
            bitIdx++;
          }
        }
      }
      dir = -dir;
      col -= 2;
    }
  };

  const maskFn = (mask) => {
    const fns = [
      (r, c) => (r + c) % 2 === 0,
      (r) => r % 2 === 0,
      (r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
      (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
      (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
    ];
    return fns[mask];
  };

  const applyMask = (matrix, reserved, size, mask) => {
    const fn = maskFn(mask);
    const result = matrix.map(row => [...row]);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && fn(r, c)) {
          result[r][c] = result[r][c] ^ 1;
        }
      }
    }
    return result;
  };

  // Format info for ECC level M with mask
  const FORMAT_INFO = {
    0: 0x5412, 1: 0x5125, 2: 0x5E7C, 3: 0x5B4B,
    4: 0x45F9, 5: 0x40CE, 6: 0x4F97, 7: 0x4AA0,
  };

  const placeFormat = (matrix, size, mask) => {
    const bits = FORMAT_INFO[mask];
    for (let i = 0; i < 15; i++) {
      const bit = (bits >> i) & 1;
      // Top-left
      if (i < 6) matrix[i][8] = bit;
      else if (i === 6) matrix[7][8] = bit;
      else if (i === 7) matrix[8][8] = bit;
      else if (i === 8) matrix[8][7] = bit;
      else matrix[8][14 - i] = bit;
      // Around bottom-left and top-right
      if (i < 8) matrix[size - 1 - i][8] = bit;
      else matrix[8][size - 15 + i] = bit;
    }
  };

  const evaluateMask = (matrix, size) => {
    let penalty = 0;
    // Rule 1: rows/cols of same color
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (matrix[r][c] === matrix[r][c - 1]) run++;
        else { if (run >= 5) penalty += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (matrix[r][c] === matrix[r - 1][c]) run++;
        else { if (run >= 5) penalty += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }
    return penalty;
  };

  const generate = (text) => {
    const bytes = new TextEncoder().encode(text);
    const version = pickVersion(bytes.length + 2);
    if (!version) throw new Error('Text too long');

    const codewords = encodeData(text, version);
    const ecc = ECC_M[version];
    const eccCodewords = rsEncode(codewords, ecc.total);
    const allCodewords = [...codewords, ...eccCodewords];

    // Convert to bit array
    const bits = [];
    for (const cw of allCodewords) {
      for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
    }

    // Build matrix
    const { matrix, reserved, size } = buildMatrix(version);
    placeData(matrix, reserved, size, bits);

    // Try all 8 masks, pick lowest penalty
    let best = null;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const masked = applyMask(matrix, reserved, size, mask);
      placeFormat(masked, size, mask);
      const penalty = evaluateMask(masked, size);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = masked;
      }
    }

    return best;
  };

  return { generate };
})();

export default QRGen;
