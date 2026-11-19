export function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB1_READ_WRITE_TOKEN;
}
