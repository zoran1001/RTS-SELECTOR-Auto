import { Product, MatchResult, ProductStatus } from '@/types';
import { googleDriveService } from './googleDriveService';
import { loggingService } from './loggingService';

/**
 * 图片匹配服务
 * 负责根据 SKU 从 Google Drive 匹配图片
 */
export class ImageMatchingService {
  /**
   * 为产品列表匹配图片
   */
  async matchImagesForProducts(products: Product[]): Promise<Product[]> {
    const logging = loggingService;

    await logging.info(`Starting image matching for ${products.length} products`);

    // 提取所有 SKU
    const skuList = products.map((p) => p.sku);

    // 批量匹配
    const matchResults = await googleDriveService.matchImagesBySku(skuList);

    // 创建 SKU -> 匹配结果 的映射
    const matchMap = new Map<string, MatchResult>();
    for (const result of matchResults) {
      matchMap.set(result.sku, result);
    }

    // 更新产品数据
    const updatedProducts: Product[] = [];

    for (const product of products) {
      const matchResult = matchMap.get(product.sku);

      if (!matchResult) {
        // 没有匹配结果
        updatedProducts.push({
          ...product,
          status: ProductStatus.MISSING_IMAGE,
          errorMessage: 'No matching result found',
        });
        await logging.warn(`No match result for SKU ${product.sku}`, undefined, product.sku);
      } else {
        switch (matchResult.status) {
          case 'unique_match':
            updatedProducts.push({
              ...product,
              matchedImagePaths: matchResult.imagePaths,
            });
            await logging.info(`Unique match found for SKU ${product.sku}`, {
              imageCount: matchResult.imagePaths.length,
            }, product.sku);
            break;

          case 'no_match':
            updatedProducts.push({
              ...product,
              status: ProductStatus.MISSING_IMAGE,
              matchedImagePaths: [],
            });
            await logging.warn(`No image found for SKU ${product.sku}`, undefined, product.sku);
            break;

          case 'multiple_matches':
            updatedProducts.push({
              ...product,
              status: ProductStatus.NEED_REVIEW,
              matchedImagePaths: matchResult.imagePaths,
              errorMessage: 'Multiple images matched - manual review needed',
            });
            await logging.warn(`Multiple matches for SKU ${product.sku}`, {
              imageCount: matchResult.imagePaths.length,
            }, product.sku);
            break;
        }
      }
    }

    await logging.info(`Image matching completed`, {
      uniqueMatches: updatedProducts.filter((p) => p.matchedImagePaths?.length === 1).length,
      noMatches: updatedProducts.filter((p) => p.status === ProductStatus.MISSING_IMAGE).length,
      multipleMatches: updatedProducts.filter((p) => p.status === ProductStatus.NEED_REVIEW).length,
    });

    return updatedProducts;
  }
}

// 导出单例
export const imageMatchingService = new ImageMatchingService();
