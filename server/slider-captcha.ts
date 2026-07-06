import crypto from 'node:crypto';
import { deflateSync } from 'node:zlib';

export type AuthPurpose = 'login' | 'register';

type SliderChallengeRecord = {
  purpose: AuthPurpose;
  targetPct: number;
  expiresAt: number;
};

type SliderTokenRecord = {
  purpose: AuthPurpose;
  expiresAt: number;
};

const sliderChallengeTtlMs = 5 * 60 * 1000;
const sliderTokenTtlMs = 2 * 60 * 1000;
const puzzleImageWidth = 320;
const puzzleImageHeight = 150;
const puzzlePieceSize = 44;
const puzzleTolerancePct = 2.5;

const sliderChallenges = new Map<string, SliderChallengeRecord>();
const sliderTokens = new Map<string, SliderTokenRecord>();

const pngCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(buffer: Uint8Array, width: number, x: number, y: number, rgba: [number, number, number, number]) {
  const offset = (y * width + x) * 4;
  buffer[offset] = rgba[0];
  buffer[offset + 1] = rgba[1];
  buffer[offset + 2] = rgba[2];
  buffer[offset + 3] = rgba[3];
}

function getPixel(buffer: Uint8Array, width: number, x: number, y: number): [number, number, number, number] {
  const offset = (y * width + x) * 4;
  return [buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]];
}

function mixColor(
  color: [number, number, number, number],
  target: [number, number, number, number],
  amount: number
): [number, number, number, number] {
  return [
    clampChannel(color[0] * (1 - amount) + target[0] * amount),
    clampChannel(color[1] * (1 - amount) + target[1] * amount),
    clampChannel(color[2] * (1 - amount) + target[2] * amount),
    clampChannel(color[3] * (1 - amount) + target[3] * amount)
  ];
}

function puzzleMask(localX: number, localY: number, size: number) {
  const inset = size * 0.19;
  const bodyMin = inset;
  const bodyMax = size - inset;
  const tabRadius = inset * 0.9;
  const inBody = localX >= bodyMin && localX <= bodyMax && localY >= bodyMin && localY <= bodyMax;
  const topTab = Math.hypot(localX - size / 2, localY - bodyMin) <= tabRadius && localY <= bodyMin + tabRadius;
  const rightTab =
    Math.hypot(localX - bodyMax, localY - size / 2) <= tabRadius && localX >= bodyMax - tabRadius;
  const bottomCut = Math.hypot(localX - size / 2, localY - bodyMax) <= tabRadius && localY >= bodyMax - tabRadius;
  const leftCut = Math.hypot(localX - bodyMin, localY - size / 2) <= tabRadius && localX <= bodyMin + tabRadius;
  return (inBody || topTab || rightTab) && !bottomCut && !leftCut;
}

function puzzleEdge(localX: number, localY: number, size: number) {
  if (!puzzleMask(localX, localY, size)) return false;
  return (
    !puzzleMask(localX - 1, localY, size) ||
    !puzzleMask(localX + 1, localY, size) ||
    !puzzleMask(localX, localY - 1, size) ||
    !puzzleMask(localX, localY + 1, size)
  );
}

function pngCrc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function rgbaToPngDataUrl(width: number, height: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowOffset + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

function puzzleBackgroundPixel(x: number, y: number, seed: number): [number, number, number, number] {
  const nx = x / puzzleImageWidth;
  const ny = y / puzzleImageHeight;
  const sunX = 0.73 + Math.sin(seed * 0.013) * 0.07;
  const sunY = 0.27 + Math.cos(seed * 0.017) * 0.035;
  const sunDistance = Math.hypot(nx - sunX, ny - sunY);
  const glow = Math.max(0, 1 - sunDistance / 0.44);
  const skyTop: [number, number, number] = [92, 158, 214];
  const skyBottom: [number, number, number] = [250, 205, 154];
  const mist: [number, number, number] = [246, 239, 219];
  const cloudWave = Math.sin((nx * 7.4 + ny * 2.4 + seed * 0.011) * Math.PI) * 0.035;
  const farRidge = 0.54 + Math.sin(nx * 8.2 + seed * 0.021) * 0.08 + Math.cos(nx * 17.4) * 0.025;
  const nearRidge = 0.71 + Math.cos(nx * 10.6 + seed * 0.018) * 0.07 + Math.sin(nx * 21.8) * 0.018;
  const waterLine = 0.82 + Math.sin(nx * 9.5 + seed * 0.016) * 0.025;
  let color: [number, number, number] = [
    skyTop[0] * (1 - ny) + skyBottom[0] * ny,
    skyTop[1] * (1 - ny) + skyBottom[1] * ny,
    skyTop[2] * (1 - ny) + skyBottom[2] * ny
  ];

  if (sunDistance < 0.075) {
    const sunCore = 1 - sunDistance / 0.075;
    color = [
      color[0] * (1 - sunCore) + 255 * sunCore,
      color[1] * (1 - sunCore) + 232 * sunCore,
      color[2] * (1 - sunCore) + 150 * sunCore
    ];
  }

  if (ny > farRidge) {
    const depth = Math.min(1, (ny - farRidge) / 0.42);
    color = [64 + depth * 30, 131 + depth * 38, 143 + depth * 26];
  }

  if (ny > nearRidge) {
    const depth = Math.min(1, (ny - nearRidge) / 0.28);
    color = [38 + depth * 22, 126 + depth * 42, 104 + depth * 20];
  }

  if (ny > waterLine) {
    const waterDepth = Math.min(1, (ny - waterLine) / 0.2);
    const ripple = Math.sin((nx * 28 + seed * 0.019) * Math.PI) * 9 + Math.sin((nx * 70 + ny * 8) * Math.PI) * 3;
    color = [
      39 + waterDepth * 20 + ripple,
      139 + waterDepth * 24 + ripple * 0.3,
      154 + waterDepth * 28 + ripple * 0.5
    ];
  }

  const cloudBand = Math.exp(-Math.pow((ny - 0.34 - cloudWave) / 0.052, 2));
  const cloudBlob =
    Math.max(0, 1 - Math.hypot(nx - 0.22, ny - 0.29) / 0.18) +
    Math.max(0, 1 - Math.hypot(nx - 0.42, ny - 0.25) / 0.16) +
    Math.max(0, 1 - Math.hypot(nx - 0.58, ny - 0.33) / 0.2);
  const treeA = Math.max(0, 1 - Math.hypot(nx - 0.12, ny - 0.72) / 0.055);
  const treeB = Math.max(0, 1 - Math.hypot(nx - 0.9, ny - 0.69) / 0.06);
  const texture = ((x * 17 + y * 31 + seed) % 47 === 0 ? 7 : 0) + Math.sin((x + seed) * 0.11) * 1.6;
  const cloud = Math.min(0.35, cloudBand * 0.22 + cloudBlob * 0.18);
  color = [
    color[0] * (1 - cloud) + mist[0] * cloud + glow * 36 + texture - (treeA + treeB) * 28,
    color[1] * (1 - cloud) + mist[1] * cloud + glow * 26 + texture - (treeA + treeB) * 10,
    color[2] * (1 - cloud) + mist[2] * cloud + glow * 14 + texture - (treeA + treeB) * 32
  ];

  return [clampChannel(color[0]), clampChannel(color[1]), clampChannel(color[2]), 255];
}

function buildPuzzleImages(targetX: number, targetY: number) {
  const seed = crypto.randomInt(0, 100_000);
  const base = new Uint8Array(puzzleImageWidth * puzzleImageHeight * 4);
  for (let y = 0; y < puzzleImageHeight; y += 1) {
    for (let x = 0; x < puzzleImageWidth; x += 1) {
      setPixel(base, puzzleImageWidth, x, y, puzzleBackgroundPixel(x, y, seed));
    }
  }

  const background = new Uint8Array(base);
  const piece = new Uint8Array(puzzlePieceSize * puzzlePieceSize * 4);
  for (let localY = 0; localY < puzzlePieceSize; localY += 1) {
    for (let localX = 0; localX < puzzlePieceSize; localX += 1) {
      const x = targetX + localX;
      const y = targetY + localY;
      if (!puzzleMask(localX, localY, puzzlePieceSize)) {
        setPixel(piece, puzzlePieceSize, localX, localY, [0, 0, 0, 0]);
        continue;
      }

      const original = getPixel(base, puzzleImageWidth, x, y);
      const isEdge = puzzleEdge(localX, localY, puzzlePieceSize);
      const piecePixel = isEdge ? mixColor(original, [255, 255, 255, 255], 0.36) : original;
      const slotPixel = isEdge
        ? mixColor(original, [18, 38, 48, 255], 0.36)
        : mixColor(original, [18, 38, 48, 255], 0.22);
      setPixel(piece, puzzlePieceSize, localX, localY, piecePixel);
      setPixel(background, puzzleImageWidth, x, y, slotPixel);
    }
  }

  return {
    backgroundImage: rgbaToPngDataUrl(puzzleImageWidth, puzzleImageHeight, background),
    pieceImage: rgbaToPngDataUrl(puzzlePieceSize, puzzlePieceSize, piece)
  };
}

function pruneSliderRecords() {
  const now = Date.now();
  for (const [id, challenge] of sliderChallenges) {
    if (challenge.expiresAt <= now) sliderChallenges.delete(id);
  }
  for (const [token, record] of sliderTokens) {
    if (record.expiresAt <= now) sliderTokens.delete(token);
  }
}

export function createSliderChallenge(purpose: AuthPurpose) {
  pruneSliderRecords();
  const challengeId = crypto.randomUUID();
  const targetX = crypto.randomInt(Math.round(puzzleImageWidth * 0.26), puzzleImageWidth - puzzlePieceSize - 18);
  const targetY = crypto.randomInt(18, puzzleImageHeight - puzzlePieceSize - 18);
  const targetPct = (targetX / (puzzleImageWidth - puzzlePieceSize)) * 100;
  const puzzle = buildPuzzleImages(targetX, targetY);
  const expiresAt = Date.now() + sliderChallengeTtlMs;
  sliderChallenges.set(challengeId, { purpose, targetPct, expiresAt });

  return {
    challengeId,
    purpose,
    backgroundImage: puzzle.backgroundImage,
    pieceImage: puzzle.pieceImage,
    imageWidth: puzzleImageWidth,
    imageHeight: puzzleImageHeight,
    pieceTopPct: (targetY / puzzleImageHeight) * 100,
    pieceWidthPct: (puzzlePieceSize / puzzleImageWidth) * 100,
    pieceHeightPct: (puzzlePieceSize / puzzleImageHeight) * 100,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export function verifySliderChallenge(input: { challengeId: string; purpose: AuthPurpose; positionPct: number }) {
  pruneSliderRecords();
  const challenge = sliderChallenges.get(input.challengeId);
  if (!challenge || challenge.purpose !== input.purpose || challenge.expiresAt <= Date.now()) {
    return { ok: false as const, error: '拼图验证已过期，请重试。' };
  }

  sliderChallenges.delete(input.challengeId);
  if (Math.abs(input.positionPct - challenge.targetPct) > puzzleTolerancePct) {
    return { ok: false as const, error: '拼图验证失败，请重试。' };
  }

  const captchaToken = crypto.randomUUID();
  const expiresAt = Date.now() + sliderTokenTtlMs;
  sliderTokens.set(captchaToken, {
    purpose: input.purpose,
    expiresAt
  });
  return {
    ok: true as const,
    captchaToken,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export function verifySliderToken(token: string, purpose: AuthPurpose) {
  pruneSliderRecords();
  const record = sliderTokens.get(token);
  if (!record || record.purpose !== purpose || record.expiresAt <= Date.now()) {
    return false;
  }
  sliderTokens.delete(token);
  return true;
}
