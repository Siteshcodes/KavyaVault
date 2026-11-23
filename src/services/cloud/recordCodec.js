import { splitSnapshot, joinSnapshot } from './cloudSnapshotCodec.js';

export const MAX_RECORD_BYTES = 40 * 1024 * 1024;
export async function digestText(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function encodeRecord(record) {
  const text = JSON.stringify(record);
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_RECORD_BYTES) throw new Error('यह अभिलेख 40 MB से बड़ा है। इसे स्थानीय बैकअप में सुरक्षित रखें। / Record exceeds the cloud limit.');
  const parts = bytes > 350000 ? splitSnapshot(text).parts : [];
  return { bytes, sha256: await digestText(text), inline: parts.length ? '' : text, parts };
}

export async function decodeRecord(meta, parts = []) {
  const text = meta.parts ? joinSnapshot(parts, meta.bytes) : meta.inline;
  if (typeof text !== 'string' || new TextEncoder().encode(text).length !== meta.bytes || await digestText(text) !== meta.sha256) throw new Error('क्लाउड अभिलेख की अखंडता जाँच विफल हुई। / Cloud record integrity failed.');
  return JSON.parse(text);
}
