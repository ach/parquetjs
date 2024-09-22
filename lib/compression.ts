import zlib from 'zlib'
import { compress as zstd_compress, decompress as zstd_decompress } from '@mongodb-js/zstd';
import snappy from 'snappyjs'
import { compress as brotliCompress, decompress as brotliDecompress } from 'brotli-wasm'

type d_identity = (value: ArrayBuffer | Buffer | Uint8Array ) => ArrayBuffer | Buffer | Uint8Array
type d_gzip = (value: ArrayBuffer | Buffer | string ) => Buffer
type d_snappy = (value: ArrayBuffer | Buffer | Uint8Array ) => ArrayBuffer | Buffer | Uint8Array
type d_brotli = (value: Uint8Array ) => Promise<Buffer>

interface PARQUET_COMPRESSION_METHODS {
  [key:string]: {
    deflate: (value: any) => Buffer | Promise<Buffer>
    inflate: (value: any) => Buffer | Promise<Buffer>
  }
}
// LZO compression is disabled. See: https://github.com/LibertyDSNP/parquetjs/issues/18
export const PARQUET_COMPRESSION_METHODS: PARQUET_COMPRESSION_METHODS = {
  'UNCOMPRESSED': {
    deflate: deflate_identity,
    inflate: inflate_identity
  },
  'GZIP': {
    deflate: deflate_gzip,
    inflate: inflate_gzip
  },
  'SNAPPY': {
    deflate: deflate_snappy,
    inflate: inflate_snappy
  },
  'BROTLI': {
    deflate: deflate_brotli,
    inflate: inflate_brotli
  },
  'ZSTD': {
    deflate: deflate_zstd,
    inflate: inflate_zstd
  }
};

/**
 * Deflate a value using compression method `method`
 */
export async function deflate(method: string, value: unknown): Promise<Buffer> {
  if (!(method in PARQUET_COMPRESSION_METHODS)) {
    throw 'invalid compression method: ' + method;
  }

  return PARQUET_COMPRESSION_METHODS[method].deflate(value);
}

function deflate_identity(value: ArrayBuffer | Buffer | Uint8Array) {
  return buffer_from_result(value);
}

function deflate_gzip(value: ArrayBuffer | Buffer | string) {
  return zlib.gzipSync(value);
}

function deflate_snappy(value: ArrayBuffer | Buffer | Uint8Array) {
  const compressedValue = snappy.compress(value);
  return buffer_from_result(compressedValue);
}

async function deflate_brotli(value: Uint8Array) {
  const compressedContent =  await brotliCompress(value/*, {
    mode: 0,
    quality: 8,
    lgwin: 22
  }
  */)

  return Buffer.from(compressedContent);
}


async function deflate_zstd(value: Buffer | Uint8Array): Promise<Buffer> {
  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
    return zstd_compress(Buffer.from(value), 3);
  } else if(value instanceof Buffer) {
    return zstd_compress(value as Buffer, 3);
  }
  throw 'invalid value type';
}

/**
 * Inflate a value using compression method `method`
 */
export async function inflate(method: string, value: unknown): Promise<Buffer> {
  if (!(method in PARQUET_COMPRESSION_METHODS)) {
    throw 'invalid compression method: ' + method;
  }

  return await PARQUET_COMPRESSION_METHODS[method].inflate(value);
}

async function inflate_identity(value: ArrayBuffer | Buffer | Uint8Array): Promise<Buffer> {
  return buffer_from_result(value);
}

async function inflate_gzip(value: Buffer | ArrayBuffer | string) {
  return zlib.gunzipSync(value);
}

function inflate_snappy(value: ArrayBuffer | Buffer | Uint8Array) {
  const uncompressedValue = snappy.uncompress(value);
  return buffer_from_result(uncompressedValue);
}

async function inflate_brotli(value: Uint8Array) {
  const uncompressedContent = await brotliDecompress(value)
  return Buffer.from(uncompressedContent);
}

async function inflate_zstd(value: Buffer | Uint8Array): Promise<Buffer> {
  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
    return zstd_decompress(Buffer.from(value));
  } else if(value instanceof Buffer) {
    return zstd_decompress(value);
  }
  throw 'invalid value type';
}

function buffer_from_result(result: ArrayBuffer | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(result)) {
    return result;
  } else {
    return Buffer.from(result);
  }
}
