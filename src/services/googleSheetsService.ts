import { google, sheets_v4 } from 'googleapis';
import { Product, ProductStatus, GoogleSheetConfig } from '@/types';

// Google Sheets Service
export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private config: GoogleSheetConfig | null = null;

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
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * 配置服务
   */
  configure(config: GoogleSheetConfig): void {
    this.config = config;
  }

  /**
   * 读取所有产品数据
   */
  async getProducts(): Promise<Product[]> {
    if (!this.sheets || !this.config) {
      throw new Error('Service not initialized or configured');
    }

    const { spreadsheetId, sheetName, columnMapping } = this.config;

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // 第一行是表头
      const headers = rows[0];
      const dataRows = rows.slice(1);

      // 找到各列的索引
      const skuIndex = headers.indexOf(columnMapping.sku);
      const nameIndex = headers.indexOf(columnMapping.productName);
      const statusIndex = headers.indexOf(columnMapping.status);

      if (skuIndex === -1) {
        throw new Error(`SKU column "${columnMapping.sku}" not found`);
      }

      const products: Product[] = [];

      for (const row of dataRows) {
        const sku = row[skuIndex] || '';
        const productName = nameIndex !== -1 ? (row[nameIndex] || '') : '';
        const statusValue = statusIndex !== -1 ? (row[statusIndex] || '') : '';

        // 跳过空行
        if (!sku.trim()) {
          continue;
        }

        // 映射状态
        let status: ProductStatus;
        const normalizedStatus = statusValue.toLowerCase().trim();
        switch (normalizedStatus) {
          case 'ready':
            status = ProductStatus.READY;
            break;
          case 'pending':
            status = ProductStatus.PENDING;
            break;
          case 'done':
            status = ProductStatus.DONE;
            break;
          case 'error':
            status = ProductStatus.ERROR;
            break;
          case 'missing sku':
            status = ProductStatus.MISSING_SKU;
            break;
          case 'missing image':
            status = ProductStatus.MISSING_IMAGE;
            break;
          case 'need review':
            status = ProductStatus.NEED_REVIEW;
            break;
          default:
            status = ProductStatus.PENDING;
        }

        products.push({
          sku: sku.trim(),
          productName: productName.trim(),
          status,
        });
      }

      return products;
    } catch (error) {
      console.error('Failed to read Google Sheet:', error);
      throw error;
    }
  }

  /**
   * 更新产品状态
   */
  async updateProductStatus(
    sku: string,
    newStatus: ProductStatus,
    errorMessage?: string
  ): Promise<void> {
    if (!this.sheets || !this.config) {
      throw new Error('Service not initialized or configured');
    }

    const { spreadsheetId, sheetName, columnMapping } = this.config;

    try {
      // 获取所有数据找到对应行
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('Sheet is empty');
      }

      const headers = rows[0];
      const skuIndex = headers.indexOf(columnMapping.sku);
      const statusIndex = headers.indexOf(columnMapping.status);

      if (skuIndex === -1) {
        throw new Error(`SKU column not found`);
      }

      // 找到匹配 SKU 的行
      let targetRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][skuIndex]?.trim() === sku) {
          targetRowIndex = i;
          break;
        }
      }

      if (targetRowIndex === -1) {
        throw new Error(`SKU "${sku}" not found in sheet`);
      }

      // 构建更新数据
      const statusValue = newStatus;
      const range = `${sheetName}!${String.fromCharCode(65 + statusIndex)}${targetRowIndex + 1}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[statusValue]],
        },
      });
    } catch (error) {
      console.error(`Failed to update status for SKU ${sku}:`, error);
      throw error;
    }
  }
}

// 导出单例
export const googleSheetsService = new GoogleSheetsService();
