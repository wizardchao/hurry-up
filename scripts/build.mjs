import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "dist");
const extensionFiles = [
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "icon16.png",
  "icon48.png",
  "icon128.png"
];
const iconSizes = [16, 48, 128];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const size of iconSizes) {
  const fileName = `icon${size}.png`;
  const iconBuffer = createIcon(size);
  writeFileSync(join(projectRoot, fileName), iconBuffer);
}

for (const file of extensionFiles) {
  copyFileSync(join(projectRoot, file), join(distDir, file));
}

console.log(`Built unpacked extension in ${distDir}`);

function createIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.31;
  const ringRadius = size * 0.26;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1 || 1);
      const v = y / (size - 1 || 1);
      const dx = x - center;
      const dy = y - center;
      const distance = Math.hypot(dx, dy);
      const idx = (y * size + x) * 4;

      let r = 24 + 18 * u + 7 * (1 - v);
      let g = 49 + 20 * u + 19 * (1 - v);
      let b = 72 + 15 * u + 10 * (1 - v);
      const vignette = Math.max(0.76, 1 - distance / (size * 0.9));
      r *= vignette;
      g *= vignette;
      b *= vignette;

      const glow = Math.max(0, 1 - Math.hypot(u - 0.75, v - 0.25) / 0.5);
      r = mix(r, 217, glow * 0.22);
      g = mix(g, 105, glow * 0.18);
      b = mix(b, 65, glow * 0.15);

      const faceDistance = distance / radius;
      if (faceDistance <= 1) {
        const faceMix = 1 - smoothStep(0.78, 1, faceDistance);
        r = mix(r, 247, faceMix);
        g = mix(g, 242, faceMix);
        b = mix(b, 234, faceMix);
      }

      const ringMix = 1 - smoothStep(0.98, 1.04, distance / ringRadius);
      if (ringMix > 0) {
        r = mix(r, 255, ringMix * 0.5);
        g = mix(g, 255, ringMix * 0.45);
        b = mix(b, 255, ringMix * 0.4);
      }

      pixels[idx] = clamp(r);
      pixels[idx + 1] = clamp(g);
      pixels[idx + 2] = clamp(b);
      pixels[idx + 3] = 255;
    }
  }

  drawLine(pixels, size, center - size * 0.02, center - size * 0.02, center, center - size * 0.16, size * 0.055, [217, 105, 65, 255]);
  drawLine(pixels, size, center - size * 0.01, center, center + size * 0.12, center + size * 0.06, size * 0.042, [58, 96, 118, 255]);
  drawCircle(pixels, size, center, center, size * 0.035, [217, 105, 65, 255]);

  return encodePng(size, size, pixels);
}

function drawCircle(pixels, size, cx, cy, radius, color) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius) {
        const idx = (y * size + x) * 4;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = color[3];
      }
    }
  }
}

function drawLine(pixels, size, x0, y0, x1, y1, thickness, color) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - thickness - 1));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1) + thickness + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - thickness - 1));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1) + thickness + 1));
  const segmentLengthSq = (x1 - x0) ** 2 + (y1 - y0) ** 2 || 1;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / segmentLengthSq));
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      const distance = Math.hypot(x - px, y - py);

      if (distance <= thickness) {
        const blend = 1 - smoothStep(thickness * 0.55, thickness, distance);
        const idx = (y * size + x) * 4;
        pixels[idx] = mix(pixels[idx], color[0], blend);
        pixels[idx + 1] = mix(pixels[idx + 1], color[1], blend);
        pixels[idx + 2] = mix(pixels[idx + 2], color[2], blend);
        pixels[idx + 3] = 255;
      }
    }
  }
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    raw.set(rgba.subarray(y * stride, y * stride + stride), rowOffset + 1);
  }

  const chunks = [
    pngChunk("IHDR", ihdrData(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ];

  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
}

function ihdrData(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

function smoothStep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
