import { google, drive_v3 } from 'googleapis';
import { MatchResult } from '@/types';
import { matchSkuInFileName, isSupportedImageFormat, normalizeSku } from '@/utils';

// 支持的图片格式
const SUPPORTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

// Google Drive Service
export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private folderId: string = '';

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!credentials) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
    }

    let parsedCredentials: object;
    try {
      parsedCredentials = JSON.parse(credentials);
    } catch {
      throw new Error('Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * 设置要扫描的文件夹 ID
   */
  setFolderId(folderId: string): void {
    this.folderId = folderId;
  }

  /**
   * 扫描文件夹中的所有图片
   */
  async scanImages(): Promise<string[]> {
    if (!this.drive) {
      throw new Error('Service not initialized');
    }

    if (!this.folderId) {
      throw new Error('Folder ID not set');
    }

    const imageFiles: string[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.drive.files.list({
          q: `'${this.folderId}' in parents and mimeType contains 'image/'`,
          fields: 'nextPageToken, files(id, name, webContentLink)',
          pageSize: 100,
          pageToken,
        });

        const files = response.data.files || [];

        for (const file of files) {
          if (file.name && isSupportedImageFormat(file.name)) {
            // 优先使用 webContentLink，如果没有则用 file id
            imageFiles.push(file.webContentLink || file.id || '');
          }
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return imageFiles;
    } catch (error) {
      console.error('Failed to scan Google Drive folder:', error);
      throw error;
    }
  }

  /**
   * 根据 SKU 列表匹配图片
   */
  async matchImagesBySku(skuList: string[]): Promise<MatchResult[]> {
    if (!this.drive) {
      throw new Error('Service not initialized');
    }

    const results: MatchResult[] = [];

    for (const sku of skuList) {
      const normalizedSku = normalizeSku(sku);
      if (!normalizedSku) {
        results.push({
          sku,
          status: 'no_match',
          imagePaths: [],
        });
        continue;
      }

      const matchedFiles = await this.findFilesContainingSku(normalizedSku);

      if (matchedFiles.length === 0) {
        results.push({
          sku,
          status: 'no_match',
          imagePaths: [],
        });
      } else if (matchedFiles.length === 1) {
        results.push({
          sku,
          status: 'unique_match',
          imagePaths: matchedFiles,
        });
      } else {
        results.push({
          sku,
          status: 'multiple_matches',
          imagePaths: matchedFiles,
        });
      }
    }

    return results;
  }

  /**
   * 在文件夹中查找包含指定 SKU 的文件
   */
  private async findFilesContainingSku(sku: string): Promise<string[]> {
    if (!this.drive || !this.folderId) {
      throw new Error('Service not initialized');
    }

    const matchedFiles: string[] = [];
    let pageToken: string | undefined;

    // 构建查询：父文件夹 + 图片类型 + 名称包含 SKU
    const query = [
      `'${this.folderId}' in parents`,
      'mimeType contains "image/"',
      `name contains '${sku}'`,
    ].join(' and ');

    try {
      do {
        const response = await this.drive.files.list({
          q,
          fields: 'nextPageToken, files(id, name, webContentLink)',
          pageSize: 100,
          pageToken,
        });

        const files = response.data.files || [];

        for (const file of files) {
          if (file.name && isSupportedImageFormat(file.name)) {
            // 再次确认文件名确实包含 SKU
            if (matchSkuInFileName(file.name, sku)) {
              matchedFiles.push(file.webContentLink || file.id || '');
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return matchedFiles;
    } catch (error) {
      console.error(`Failed to search for SKU ${sku}:`, error);
      return [];
    }
  }

  /**
   * 获取文件的下载路径（用于后续处理）
   */
  async getDownloadUrl(fileId: string): Promise<string> {
    if (!this.drive) {
      throw new Error('Service not initialized');
    }

    try {
      const file = await this.drive.files.get({
        fileId,
        fields: 'webContentLink',
      });
      return file.data.webContentLink || '';
    } catch {
      // 如果无法获取下载链接，返回 fileId 作为备选
      return fileId;
    }
  }
}

// 导出单例
export const googleDriveService = new GoogleDriveService();
