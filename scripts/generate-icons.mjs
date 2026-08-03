import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function calculateCrc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = calculateCrc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Build raw scanlines (1 byte filter per line + 4 bytes per pixel RGBA)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const bgR = 0x0f, bgG = 0x17, bgB = 0x2a; // Slate #0f172a
  const logoR = 0x25, logoG = 0x63, logoB = 0xeb; // Blue #2563eb
  const textR = 0xff, textG = 0xff, textB = 0xff; // White

  // Create badge area in center (padding 15% from edges)
  const pad = Math.floor(size * 0.15);
  const radius = Math.floor(size * 0.1);

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Inside badge box?
      const inX = x >= pad && x < width - pad;
      const inY = y >= pad && y < height - pad;

      if (inX && inY) {
        // Corner radius calculation
        let drawBadge = true;
        const left = pad + radius;
        const right = width - pad - radius;
        const top = pad + radius;
        const bottom = height - pad - radius;

        if (x < left && y < top) {
          if ((x - left) ** 2 + (y - top) ** 2 > radius ** 2) drawBadge = false;
        } else if (x > right && y < top) {
          if ((x - right) ** 2 + (y - top) ** 2 > radius ** 2) drawBadge = false;
        } else if (x < left && y > bottom) {
          if ((x - left) ** 2 + (y - bottom) ** 2 > radius ** 2) drawBadge = false;
        } else if (x > right && y > bottom) {
          if ((x - right) ** 2 + (y - bottom) ** 2 > radius ** 2) drawBadge = false;
        }

        if (drawBadge) {
          // Draw "TASS" stylized text block inside badge box center
          const centerY = height / 2;
          const barHeight = Math.floor(size * 0.12);
          const barWidth = Math.floor(size * 0.4);
          const barLeft = (width - barWidth) / 2;

          // Simple horizontal accent bar representing TASS logo mark
          if (Math.abs(y - centerY) < barHeight / 2 && x >= barLeft && x < barLeft + barWidth) {
            r = textR; g = textG; b = textB;
          } else {
            r = logoR; g = logoG; b = logoB;
          }
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512));
console.log('Successfully generated icon-192.png and icon-512.png');
