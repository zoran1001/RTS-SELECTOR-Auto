// 文件名和路径工具

/**
 * 获取文件扩展名
 * @param fileName 文件名
 * @returns 扩展名（不含点）
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * 检查文件是否是支持的图片格式
 * @param fileName 文件名
 * @returns 是否支持
 */
export function isSupportedImageFormat(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
}

/**
 * 生成输出文件名
 * @param sku SKU
 * @param format 格式
 * @returns 文件名
 */
export function generateOutputFileName(sku: string, format: string): string {
  const normalizedSku = sku.toUpperCase().replace(/\s+/g, '').trim();
  const ext = format.toLowerCase().replace('jpeg', 'jpg');
  return `${normalizedSku}.${ext}`;
}

/**
 * 确保路径使用正斜杠
 * @param path 路径
 * @returns 规范化后的路径
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
