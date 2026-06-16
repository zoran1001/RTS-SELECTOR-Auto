import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import type { ProcessingResult, Config } from '@/types';
import { generateOutputFileName } from '@/utils';

export class ImageProcessingService {
  /**
   * 合成图片
   */
  async composeImage(
    productImagePath: string,
    config: Config,
    sku: string
  ): Promise<ProcessingResult> {
    try {
      const { selector, local } = config;
      const { canvasWidth, canvasHeight, outputFormat, productPlacement } = selector;

      // 读取产品图片
      let productImage = await sharp(productImagePath).toBuffer();

      // 获取产品图尺寸
      const productMeta = await sharp(productImage).metadata();
      let productWidth = productMeta.width || 0;
      let productHeight = productMeta.height || 0;

      // 计算缩放比例（保持宽高比）
      const scaleX = productPlacement.maxWidth / productWidth;
      const scaleY = productPlacement.maxHeight / productHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      // 调整尺寸
      if (scale !== 1) {
        productWidth = Math.round(productWidth * scale);
        productHeight = Math.round(productHeight * scale);
        productImage = await sharp(productImage)
          .resize(productWidth, productHeight)
          .toBuffer();
      }

      // 计算位置（居中）
      const x = productPlacement.centerX - productWidth / 2 + productPlacement.offsetX;
      const y = productPlacement.centerY - productHeight / 2 + productPlacement.offsetY;

      // 创建画布
      let canvas: sharp.Sharp;

      if (local.backgroundImagePath) {
        // 使用背景图片
        const bgImage = await fs.readFile(local.backgroundImagePath);
        canvas = sharp(bgImage).resize(canvasWidth, canvasHeight);
      } else {
        // 使用白色背景
        canvas = sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: '#FFFFFF',
          },
        });
      }

      // 合成产品图
      const outputBuffer = await canvas
        .composite([
          {
            input: productImage,
            left: Math.round(x),
            top: Math.round(y),
          },
        ])
        .toBuffer();

      // 输出文件
      const outputFolder = local.outputFolder;
      await fs.mkdir(outputFolder, { recursive: true });

      const fileName = generateOutputFileName(sku, outputFormat);
      const outputPath = path.join(outputFolder, fileName);

      // 根据格式输出
      let sharpInstance = sharp(outputBuffer);
      switch (outputFormat) {
        case 'png':
          await sharpInstance.png().toFile(outputPath);
          break;
        case 'jpg':
        case 'jpeg':
          await sharpInstance.jpeg({ quality: 95 }).toFile(outputPath);
          break;
        case 'webp':
          await sharpInstance.webp({ quality: 95 }).toFile(outputPath);
          break;
        default:
          await sharpInstance.png().toFile(outputPath);
      }

      return {
        sku,
        success: true,
        outputPath,
        matchedImagePaths: [productImagePath],
      };
    } catch (error) {
      console.error(`Failed to compose image for SKU ${sku}:`, error);
      return {
        sku,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        matchedImagePaths: [productImagePath],
      };
    }
  }
}
