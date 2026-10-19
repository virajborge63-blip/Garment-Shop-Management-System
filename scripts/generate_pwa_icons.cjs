const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image bytes: each scanline has 1 filter byte (0) + width * 4 RGBA bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const r = width / 2;
  const safeRadius = isMaskable ? width * 0.38 : width * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter none

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: Dark navy #0f172a
      let rCol = 15;
      let gCol = 23;
      let bCol = 42;
      let aCol = 255;

      // Outer gold circle accent border
      if (dist >= safeRadius - 6 && dist <= safeRadius) {
        // Gold #f59e0b
        rCol = 245;
        gCol = 158;
        bCol = 11;
      } else if (dist < safeRadius - 6) {
        // Inner gradient towards deep indigo #1e1b4b
        const ratio = dist / safeRadius;
        rCol = Math.round(15 + (30 - 15) * ratio);
        gCol = Math.round(23 + (27 - 23) * ratio);
        bCol = Math.round(42 + (75 - 42) * ratio);

        // Crown / Monogram central badge
        // Crown area: y between cy - r*0.25 and cy + r*0.2
        const ny = (y - cy) / (width * 0.4);
        const nx = (x - cx) / (width * 0.4);

        // Crown shape: 3 points
        const inCrown = (
          ny >= -0.35 && ny <= 0.25 &&
          Math.abs(nx) <= 0.6 &&
          (ny > -0.1 || (Math.abs(nx) < 0.15 && ny > -0.35) || (Math.abs(nx - 0.4) < 0.15 && ny > -0.28) || (Math.abs(nx + 0.4) < 0.15 && ny > -0.28))
        );

        if (inCrown) {
          // Warm amber gold
          rCol = 245;
          gCol = 158;
          bCol = 11;
        }

        // Diamond gem at center
        if (Math.abs(nx) + Math.abs(ny - 0.4) < 0.15) {
          rCol = 251;
          gCol = 191;
          bCol = 36;
        }
      }

      rawData[pxOffset] = rCol;
      rawData[pxOffset + 1] = gCol;
      rawData[pxOffset + 2] = bCol;
      rawData[pxOffset + 3] = aCol;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Generate files
const publicDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. icon.svg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  
  <!-- Outer Gold Ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#gold)" stroke-width="6" opacity="0.85"/>
  <circle cx="256" cy="256" r="198" fill="none" stroke="url(#gold)" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/>

  <!-- Luxury Crown Emblem -->
  <g transform="translate(256, 190) scale(1.1)" filter="url(#glow)">
    <path d="M-80,40 L-95,-35 L-35,-5 L0,-65 L35,-5 L95,-35 L80,40 Z" fill="url(#gold)"/>
    <circle cx="-95" cy="-42" r="10" fill="#fde68a"/>
    <circle cx="0" cy="-72" r="12" fill="#fde68a"/>
    <circle cx="95" cy="-42" r="10" fill="#fde68a"/>
    <circle cx="-35" cy="-10" r="7" fill="#fef08a"/>
    <circle cx="35" cy="-10" r="7" fill="#fef08a"/>
    <rect x="-80" y="44" width="160" height="14" rx="7" fill="url(#gold)"/>
    <!-- Jewels on crown base -->
    <circle cx="-50" cy="51" r="4" fill="#38bdf8"/>
    <circle cx="-25" cy="51" r="4" fill="#f43f5e"/>
    <circle cx="0" cy="51" r="5" fill="#10b981"/>
    <circle cx="25" cy="51" r="4" fill="#f43f5e"/>
    <circle cx="50" cy="51" r="4" fill="#38bdf8"/>
  </g>

  <!-- Monogram & Typography -->
  <text x="256" y="335" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="3">H.M. RAJPAL</text>
  <text x="256" y="375" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="700" font-size="20" fill="url(#gold)" text-anchor="middle" letter-spacing="4">GARMENT SHOP</text>
  <text x="256" y="415" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="600" font-size="14" fill="#94a3b8" text-anchor="middle" letter-spacing="6">ATTENDANCE &amp; PAYROLL</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
console.log('Created public/icon.svg');

// 2. PNG files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
console.log('Created public/pwa-192x192.png');

fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
console.log('Created public/pwa-512x512.png');

fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
console.log('Created public/pwa-maskable-512x512.png');

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
console.log('Created public/apple-touch-icon.png');

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(64, 64, false));
console.log('Created public/favicon.ico');
