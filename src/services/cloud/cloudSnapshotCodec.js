export const PART_BYTES = 400000;

export function splitSnapshot(text) {
  const bytes = new TextEncoder().encode(text);
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += PART_BYTES) {
    const piece = bytes.subarray(offset, offset + PART_BYTES);
    let binary = '';
    for (let i = 0; i < piece.length; i += 8192) binary += String.fromCharCode(...piece.subarray(i, i + 8192));
    parts.push(btoa(binary));
  }
  return { bytes: bytes.length, parts };
}

export function joinSnapshot(parts, expectedBytes) {
  if (!Number.isInteger(expectedBytes) || expectedBytes < 0) throw new Error('क्लाउड प्रति का आकार अमान्य है।');
  const bytes = new Uint8Array(expectedBytes);
  let offset = 0;
  for (const part of parts) {
    if (typeof part !== 'string' || part.length > 600000) throw new Error('क्लाउड प्रति का भाग अमान्य है।');
    const binary = atob(part);
    if (offset + binary.length > expectedBytes) throw new Error('क्लाउड प्रति का आकार गलत है।');
    for (let i = 0; i < binary.length; i++) bytes[offset++] = binary.charCodeAt(i);
  }
  if (offset !== expectedBytes) throw new Error('क्लाउड प्रति अधूरी है।');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
