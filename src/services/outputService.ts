import fs from 'fs/promises';
import path from 'path';
import { Template, ProcessingResult } from '@/types';
import { loggingService } from './loggingService';

/**
 * 输出服务
 * 负责管理输出目录和文件组织
 */
export class OutputService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.OUTPUT_BASE_DIR || './outputs';
  }

  /**
   * 确保输出目录存在
   */
  async ensureOutputDir(template: Template): Promise<string> {
    const outputPath = path.join(this.baseDir, template.output.folder);
    await fs.mkdir(outputPath, { recursive: true });
    return outputPath;
  }

  /**
   * 获取输出目录结构
   */
  async getOutputStructure(): Promise<Record<string, string[]>> {
    const structure: Record<string, string[]> = {};

    try {
      await this.walkDirectory(this.baseDir, structure);
    } catch {
      // 目录可能不存在
    }

    return structure;
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(
    dir: string,
    structure: Record<string, string[]>
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        structure[fullPath] = [];
        await this.walkDirectory(fullPath, structure);
      } else if (entry.isFile()) {
        const parentDir = path.dirname(fullPath);
        if (!structure[parentDir]) {
          structure[parentDir] = [];
        }
        structure[parentDir].push(entry.name);
      }
    }
  }

  /**
   * 删除指定输出文件
   */
  async deleteOutput(template: Template, sku: string): Promise<void> {
    const fileName = `${sku.toUpperCase().replace(/\s+/g, '')}.${template.output.format}`;
    const filePath = path.join(this.baseDir, template.output.folder, fileName);

    try {
      await fs.unlink(filePath);
      await loggingService.info(`Deleted output file: ${filePath}`);
    } catch {
      // 文件可能不存在
    }
  }

  /**
   * 清理输出目录
   */
  async cleanOutputDir(templateId?: string): Promise<void> {
    if (templateId) {
      const dir = path.join(this.baseDir, templateId);
      await fs.rm(dir, { recursive: true, force: true });
    } else {
      await fs.rm(this.baseDir, { recursive: true, force: true });
    }
  }
}

// 导出单例
export const outputService = new OutputService();
