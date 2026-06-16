import { contextBridge, ipcRenderer } from 'electron';

export interface Config {
  googleSheetId: string;
  sheetName: string;
  fieldMapping: {
    sku: string;
    productName: string;
    status: string;
  };
  drive: {
    sourceFolderId: string;
    outputFolderId: string;
  };
  local: {
    backgroundImagePath: string;
    outputFolder: string;
    logFolder: string;
  };
  selector: {
    canvasWidth: number;
    canvasHeight: number;
    outputFormat: string;
    conflictStrategy: string;
    processStatus: string;
    productPlacement: {
      maxWidth: number;
      maxHeight: number;
      centerX: number;
      centerY: number;
      offsetX: number;
      offsetY: number;
    };
  };
}

export interface Product {
  sku: string;
  productName: string;
  status: string;
  matchedImagePaths?: string[];
  errorMessage?: string;
}

export interface ProcessingResult {
  sku: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  matchedImagePaths: string[];
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: Config) => ipcRenderer.invoke('config:save', config),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // File dialogs
  selectBackground: () => ipcRenderer.invoke('file:selectBackground'),
  selectOutputFolder: () => ipcRenderer.invoke('file:selectOutputFolder'),
  openOutputFolder: (path: string) => ipcRenderer.invoke('file:openOutputFolder', path),
  openLogFolder: () => ipcRenderer.invoke('file:openLogFolder'),

  // Google Sheets
  loadProducts: (config: Config) => ipcRenderer.invoke('google:loadProducts', config),
  updateProductStatus: (sku: string, status: string) => ipcRenderer.invoke('google:updateStatus', sku, status),

  // Google Drive
  scanImages: (folderId: string) => ipcRenderer.invoke('google:scanImages', folderId),
  matchImages: (products: Product[], folderId: string) => ipcRenderer.invoke('google:matchImages', products, folderId),

  // Image Processing
  processSingle: (product: Product, config: Config) => ipcRenderer.invoke('image:processSingle', product, config),
  processBatch: (products: Product[], config: Config) => ipcRenderer.invoke('image:processBatch', products, config),

  // Logging
  getRecentLogs: () => ipcRenderer.invoke('log:getRecent'),
  getLog: (runId: string) => ipcRenderer.invoke('log:get', runId),
});
