// CRC-32 (IEEE 802.3, the checksum of ZIP and PNG). Pure.

const TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC-32 of `bytes`. Pass the result of a previous call as `previous` to checksum data in chunks.
 */
export function crc32(bytes: Uint8Array, previous = 0): number {
  let crc = ~previous >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (TABLE[(crc ^ (bytes[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}
