// SKU 规范化处理

/**
 * 规范化 SKU
 * - 转换为大写
 * - 去除空格
 * @param sku 原始 SKU
 * @returns 规范化后的 SKU
 */
export function normalizeSku(sku: string): string {
  if (!sku || typeof sku !== 'string') {
    return '';
  }
  return sku.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * 检查 SKU 是否有效
 * @param sku SKU 字符串
 * @returns 是否有效
 */
export function isValidSku(sku: string): boolean {
  const normalized = normalizeSku(sku);
  return normalized.length > 0;
}

/**
 * 在文件名中查找 SKU
 * @param fileName 文件名
 * @param sku SKU
 * @returns 是否匹配
 */
export function matchSkuInFileName(fileName: string, sku: string): boolean {
  const normalizedFileName = normalizeSku(fileName);
  const normalizedSku = normalizeSku(sku);
  return normalizedFileName.includes(normalizedSku);
}
