// Minimal ZIP writer: the STORE method (no compression), CRC-32, UTF-8 names. Pure.
import { crc32 } from "./crc32.js";

export interface ZipEntry {
  /** Path inside the archive, `/` separated and without a leading slash. */
  name: string;
  data: Uint8Array;
}

export interface ZipOptions {
  /** Modification time stored for every entry (now by default). */
  date?: Date;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const VERSION = 20;
/** Bit 11: names are UTF-8. */
const UTF8_FLAG = 0x0800;

/** MS-DOS date and time fields (local time, 2 second resolution, years 1980 to 2107). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Builds a ZIP archive holding `entries` uncompressed. Limited to 65535 entries and 4 GiB. */
export function createZip(entries: readonly ZipEntry[], options: ZipOptions = {}): Uint8Array {
  if (entries.length > 0xffff)
    throw new RangeError("A ZIP without ZIP64 holds at most 65535 entries");
  const encoder = new TextEncoder();
  const stamp = dosDateTime(options.date ?? new Date());
  const names = entries.map((entry) => encoder.encode(entry.name));

  let total = 22;
  entries.forEach((entry, index) => {
    const nameLength = (names[index] as Uint8Array).length;
    total += 30 + nameLength + entry.data.length + 46 + nameLength;
  });
  if (total > 0xffffffff) throw new RangeError("A ZIP without ZIP64 is limited to 4 GiB");

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (value: number) => {
    view.setUint16(at, value, true);
    at += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(at, value, true);
    at += 4;
  };
  const bytes = (value: Uint8Array) => {
    out.set(value, at);
    at += value.length;
  };

  const offsets: number[] = [];
  const checksums: number[] = [];
  entries.forEach((entry, index) => {
    const name = names[index] as Uint8Array;
    const checksum = crc32(entry.data);
    offsets.push(at);
    checksums.push(checksum);
    u32(LOCAL_SIGNATURE);
    u16(VERSION);
    u16(UTF8_FLAG);
    u16(0);
    u16(stamp.time);
    u16(stamp.date);
    u32(checksum);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(name.length);
    u16(0);
    bytes(name);
    bytes(entry.data);
  });

  const centralStart = at;
  entries.forEach((entry, index) => {
    const name = names[index] as Uint8Array;
    u32(CENTRAL_SIGNATURE);
    u16(VERSION);
    u16(VERSION);
    u16(UTF8_FLAG);
    u16(0);
    u16(stamp.time);
    u16(stamp.date);
    u32(checksums[index] as number);
    u32(entry.data.length);
    u32(entry.data.length);
    u16(name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(offsets[index] as number);
    bytes(name);
  });

  const centralSize = at - centralStart;
  u32(END_SIGNATURE);
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(centralSize);
  u32(centralStart);
  u16(0);
  return out;
}
