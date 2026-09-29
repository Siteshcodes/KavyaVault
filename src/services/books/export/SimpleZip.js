/**
 * काव्यकलश (KavyaVault) — SimpleZip Pure JS ZIP Container (SimpleZip.js)
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Lightweight, zero-dependency, specification-compliant ZIP archive builder.
 *
 * Guarantees:
 * - 100% pure JavaScript (runs in Node.js and any modern browser).
 * - Exact EPUB 3 compliance: mimetype stored uncompressed at offset 0.
 * - Standard IEEE 802.3 CRC-32 checksums.
 * - UTF-8 filename encoding (bit 11 set).
 * - Self-validating: provides static `readEntries()` inspector for tests.
 */

// Precomputed CRC-32 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

/**
 * Calculates standard CRC-32 of a byte buffer
 * @param {Uint8Array} bytes
 * @returns {number} 32-bit unsigned integer
 */
export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Encodes a string to UTF-8 Uint8Array
 * @param {string} str
 * @returns {Uint8Array}
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class SimpleZip {
  constructor() {
    this.entries = [];
  }

  /**
   * Adds a file to the ZIP archive
   * @param {string} name - Path inside ZIP (e.g. 'mimetype', 'META-INF/container.xml')
   * @param {string|Uint8Array} content - File payload
   * @param {Object} [options={}]
   * @param {boolean} [options.store=true] - Store uncompressed (always true for mimetype)
   * @param {Date} [options.date] - Optional modification timestamp
   */
  addFile(name, content, options = {}) {
    const cleanName = String(name).replace(/\\/g, '/');
    let data;
    if (typeof content === 'string') {
      data = textEncoder.encode(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else if (content && content.buffer) {
      data = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      data = new Uint8Array(0);
    }

    const date = options.date instanceof Date ? options.date : new Date();

    this.entries.push({
      name: cleanName,
      data,
      date,
      store: options.store !== false
    });
  }

  /**
   * Generates the binary ZIP buffer
   * @returns {Uint8Array}
   */
  generate() {
    const localHeaders = [];
    const cdHeaders = [];
    let currentOffset = 0;

    for (const entry of this.entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const dataBytes = entry.data;
      const fileCrc = crc32(dataBytes);
      const uncompSize = dataBytes.length;
      const compSize = uncompSize; // STORE method

      // DOS timestamp
      const year = entry.date.getFullYear();
      const month = entry.date.getMonth() + 1;
      const day = entry.date.getDate();
      const hours = entry.date.getHours();
      const minutes = entry.date.getMinutes();
      const seconds = entry.date.getSeconds();

      const dosDate = ((year - 1980) << 9) | (month << 5) | day;
      const dosTime = (hours << 11) | (minutes << 5) | (seconds >> 1);

      // --- Local File Header (30 bytes + name + data) ---
      const lfh = new Uint8Array(30 + nameBytes.length + dataBytes.length);
      const lfhView = new DataView(lfh.buffer, lfh.byteOffset, lfh.byteLength);

      lfhView.setUint32(0, 0x04034b50, true); // Signature PK\x03\x04
      lfhView.setUint16(4, 20, true);         // Version needed: 2.0
      lfhView.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 bit 11)
      lfhView.setUint16(8, 0, true);          // Compression method: 0 (STORE)
      lfhView.setUint16(10, dosTime, true);
      lfhView.setUint16(12, dosDate, true);
      lfhView.setUint32(14, fileCrc, true);
      lfhView.setUint32(18, compSize, true);
      lfhView.setUint32(22, uncompSize, true);
      lfhView.setUint16(26, nameBytes.length, true);
      lfhView.setUint16(28, 0, true);         // Extra field length: 0 (crucial for mimetype)

      lfh.set(nameBytes, 30);
      lfh.set(dataBytes, 30 + nameBytes.length);

      localHeaders.push(lfh);

      // --- Central Directory Header (46 bytes + name) ---
      const cdh = new Uint8Array(46 + nameBytes.length);
      const cdhView = new DataView(cdh.buffer, cdh.byteOffset, cdh.byteLength);

      cdhView.setUint32(0, 0x02014b50, true); // Signature PK\x01\x02
      cdhView.setUint16(4, 0x003F, true);     // Version made by: Unix/spec
      cdhView.setUint16(6, 20, true);         // Version needed: 2.0
      cdhView.setUint16(8, 0x0800, true);     // Flags (UTF-8)
      cdhView.setUint16(10, 0, true);         // Method: 0 (STORE)
      cdhView.setUint16(12, dosTime, true);
      cdhView.setUint16(14, dosDate, true);
      cdhView.setUint32(16, fileCrc, true);
      cdhView.setUint32(20, compSize, true);
      cdhView.setUint32(24, uncompSize, true);
      cdhView.setUint16(28, nameBytes.length, true);
      cdhView.setUint16(30, 0, true);         // Extra field length
      cdhView.setUint16(32, 0, true);         // File comment length
      cdhView.setUint16(34, 0, true);         // Disk number start
      cdhView.setUint16(36, 0, true);         // Internal attributes
      cdhView.setUint32(38, 0, true);         // External attributes
      cdhView.setUint32(42, currentOffset, true); // Offset of local header

      cdh.set(nameBytes, 46);
      cdHeaders.push(cdh);

      currentOffset += lfh.length;
    }

    const cdOffset = currentOffset;
    let cdSize = 0;
    for (const cdh of cdHeaders) {
      cdSize += cdh.length;
    }

    // --- End of Central Directory Record (22 bytes) ---
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);

    eocdView.setUint32(0, 0x06054b50, true); // Signature PK\x05\x06
    eocdView.setUint16(4, 0, true);          // Disk number
    eocdView.setUint16(6, 0, true);          // Start disk
    eocdView.setUint16(8, this.entries.length, true);  // Entries on this disk
    eocdView.setUint16(10, this.entries.length, true); // Total entries
    eocdView.setUint32(12, cdSize, true);    // Size of central directory
    eocdView.setUint32(16, cdOffset, true);  // Offset of CD
    eocdView.setUint16(20, 0, true);         // Comment length

    // Assemble final contiguous buffer
    const totalLength = cdOffset + cdSize + eocd.length;
    const finalBuffer = new Uint8Array(totalLength);

    let offset = 0;
    for (const lfh of localHeaders) {
      finalBuffer.set(lfh, offset);
      offset += lfh.length;
    }
    for (const cdh of cdHeaders) {
      finalBuffer.set(cdh, offset);
      offset += cdh.length;
    }
    finalBuffer.set(eocd, offset);

    return finalBuffer;
  }

  /**
   * Inspector utility: parses entries from a ZIP buffer
   * Allows automated tests to inspect generated EPUB archives without third-party libraries
   * @param {Uint8Array} zipBytes
   * @returns {Array<{name: string, size: number, crc: number, data: Uint8Array, text: string}>}
   */
  static readEntries(zipBytes) {
    if (!zipBytes || !(zipBytes instanceof Uint8Array)) {
      throw new Error('अमान्य ZIP बाइट्स।');
    }

    const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
    const entries = [];
    let pos = 0;

    while (pos < zipBytes.length - 4) {
      const sig = view.getUint32(pos, true);
      if (sig === 0x04034b50) {
        // Local file header
        const compMethod = view.getUint16(pos + 8, true);
        const crc = view.getUint32(pos + 14, true);
        const compSize = view.getUint32(pos + 18, true);
        const uncompSize = view.getUint32(pos + 22, true);
        const nameLen = view.getUint16(pos + 26, true);
        const extraLen = view.getUint16(pos + 28, true);

        const nameBytes = zipBytes.subarray(pos + 30, pos + 30 + nameLen);
        const name = textDecoder.decode(nameBytes);

        const dataStart = pos + 30 + nameLen + extraLen;
        const data = zipBytes.subarray(dataStart, dataStart + compSize);
        let text = '';
        try {
          text = textDecoder.decode(data);
        } catch {
          text = '';
        }

        entries.push({
          name,
          compMethod,
          crc,
          size: uncompSize,
          data,
          text
        });

        pos = dataStart + compSize;
      } else {
        // Reached central directory or end
        break;
      }
    }

    return entries;
  }
}
