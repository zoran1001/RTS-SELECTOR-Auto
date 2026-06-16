import Store from 'electron-store';
import { join } from 'path';
import type { Config } from '@/types';

const defaultConfig: Config = {
  googleSheetId: '',
  sheetName: 'Products',
  fieldMapping: {
    sku: 'SKU',
    productName: 'Product Name',
    status: 'Status',
  },
  drive: {
    sourceFolderId: '',
    outputFolderId: '',
  },
  local: {
    backgroundImagePath: '',
    outputFolder: join(process.cwd(), 'outputs'),
    logFolder: join(process.cwd(), 'logs'),
  },
  selector: {
    canvasWidth: 1080,
    canvasHeight: 1080,
    outputFormat: 'png',
    conflictStrategy: 'overwrite',
    processStatus: 'Ready',
    productPlacement: {
      maxWidth: 900,
      maxHeight: 900,
      centerX: 540,
      centerY: 540,
      offsetX: 0,
      offsetY: 0,
    },
  },
};

export class ConfigService {
  private store: Store<Config>;

  constructor() {
    this.store = new Store({
      defaults: defaultConfig,
    });
  }

  getConfig(): Config {
    return this.store.get() as Config;
  }

  saveConfig(config: Config): void {
    this.store.set(config);
  }

  resetConfig(): void {
    this.store.reset();
  }

  getLogFolder(): string {
    return this.store.get('local.logFolder') as string;
  }

  getOutputFolder(): string {
    return this.store.get('local.outputFolder') as string;
  }
}
