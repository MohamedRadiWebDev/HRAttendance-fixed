const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value, true);
};

const writeUint32 = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value, true);
};

export type ZipInput = { name: string; data: Uint8Array };

export const createZip = (files: ZipInput[]) => {
  const fileRecords: {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  let offset = 0;
  const localFileChunks: Uint8Array[] = [];

  files.forEach((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const header = new ArrayBuffer(30);
    const view = new DataView(header);
    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint32(view, 14, crc);
    writeUint32(view, 18, data.length);
    writeUint32(view, 22, data.length);
    writeUint16(view, 26, nameBytes.length);
    writeUint16(view, 28, 0);
    const headerBytes = new Uint8Array(header);
    localFileChunks.push(headerBytes, nameBytes, data);
    fileRecords.push({ nameBytes, data, crc, offset });
    offset += headerBytes.length + nameBytes.length + data.length;
  });

  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  fileRecords.forEach((record) => {
    const header = new ArrayBuffer(46);
    const view = new DataView(header);
    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint16(view, 14, 0);
    writeUint32(view, 16, record.crc);
    writeUint32(view, 20, record.data.length);
    writeUint32(view, 24, record.data.length);
    writeUint16(view, 28, record.nameBytes.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, record.offset);
    const headerBytes = new Uint8Array(header);
    centralChunks.push(headerBytes, record.nameBytes);
    centralSize += headerBytes.length + record.nameBytes.length;
  });

  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, fileRecords.length);
  writeUint16(endView, 10, fileRecords.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);
  const endBytes = new Uint8Array(end);

  const totalSize = offset + centralSize + endBytes.length;
  const result = new Uint8Array(totalSize);
  let cursor = 0;
  [...localFileChunks, ...centralChunks, endBytes].forEach((chunk) => {
    result.set(chunk, cursor);
    cursor += chunk.length;
  });
  return result;
};

const readUint16 = (view: DataView, offset: number) => view.getUint16(offset, true);
const readUint32 = (view: DataView, offset: number) => view.getUint32(offset, true);

export const parseZip = (data: Uint8Array) => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ملف النسخة الاحتياطية غير صالح.");

  const centralDirOffset = readUint32(view, eocdOffset + 16);
  const centralDirSize = readUint32(view, eocdOffset + 12);
  let cursor = centralDirOffset;
  const end = centralDirOffset + centralDirSize;
  const files: Record<string, Uint8Array> = {};

  while (cursor < end) {
    const signature = readUint32(view, cursor);
    if (signature !== 0x02014b50) break;
    const nameLength = readUint16(view, cursor + 28);
    const extraLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localOffset = readUint32(view, cursor + 42);
    const nameStart = cursor + 46;
    const nameBytes = data.slice(nameStart, nameStart + nameLength);
    const name = textDecoder.decode(nameBytes);

    const localSig = readUint32(view, localOffset);
    if (localSig !== 0x04034b50) throw new Error("ملف النسخة الاحتياطية غير صالح.");
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressedSize = readUint32(view, localOffset + 18);
    const fileData = data.slice(dataStart, dataStart + compressedSize);
    files[name] = fileData;

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
};

export const encodeText = (text: string) => textEncoder.encode(text);
export const decodeText = (data: Uint8Array) => textDecoder.decode(data);
