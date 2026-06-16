import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { GoogleDriveService } from '@/services/googleDriveService';
import { ImageMatchingService } from '@/services/imageMatchingService';
import { ImageProcessingService } from '@/services/imageProcessingService';
import { ConfigService } from '@/services/configService';
import { LoggingService } from '@/services/loggingService';
import type { Product, Config, ProcessingResult } from '@/types';

let mainWindow: BrowserWindow | null = null;

const sheetsService = new GoogleSheetsService();
const driveService = new GoogleDriveService();
const matchingService = new ImageMatchingService();
const processingService = new ImageProcessingService();
const configService = new ConfigService();
const loggingService = new LoggingService();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Selector - Image Processing Tool',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Config
ipcMain.handle('config:get', async () => {
  return configService.getConfig();
});

ipcMain.handle('config:save', async (_event, config: Config) => {
  return configService.saveConfig(config);
});

ipcMain.handle('config:reset', async () => {
  return configService.resetConfig();
});

// File dialogs
ipcMain.handle('file:selectBackground', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  return result.filePaths[0] || '';
});

ipcMain.handle('file:selectOutputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || '';
});

ipcMain.handle('file:openOutputFolder', async (_event, path: string) => {
  await shell.openPath(path);
});

ipcMain.handle('file:openLogFolder', async () => {
  await shell.openPath(configService.getLogFolder());
});

// Google Sheets
ipcMain.handle('google:loadProducts', async (_event, config: Config) => {
  try {
    await sheetsService.initialize();
    sheetsService.configure({
      spreadsheetId: config.googleSheetId,
      sheetName: config.sheetName,
      columnMapping: config.fieldMapping,
    });
    const products = await sheetsService.getProducts();
    await loggingService.info(`Loaded ${products.length} products from Google Sheet`);
    return { success: true, data: products };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load products';
    await loggingService.error(message);
    return { success: false, error: message };
  }
});

ipcMain.handle('google:updateStatus', async (_event, sku: string, status: string) => {
  try {
    await sheetsService.updateProductStatus(sku, status as any);
    await loggingService.info(`Updated status for SKU ${sku} to ${status}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update status';
    await loggingService.error(message);
    return { success: false, error: message };
  }
});

// Google Drive
ipcMain.handle('google:scanImages', async (_event, folderId: string) => {
  try {
    await driveService.initialize();
    driveService.setFolderId(folderId);
    const images = await driveService.scanImages();
    await loggingService.info(`Scanned ${images.length} images from Drive`);
    return { success: true, data: images };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scan images';
    await loggingService.error(message);
    return { success: false, error: message };
  }
});

ipcMain.handle('google:matchImages', async (_event, products: Product[], folderId: string) => {
  try {
    await driveService.initialize();
    driveService.setFolderId(folderId);
    const matched = await matchingService.matchImagesForProducts(products);
    await loggingService.info(`Matched ${matched.length} products`);
    return { success: true, data: matched };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to match images';
    await loggingService.error(message);
    return { success: false, error: message };
  }
});

// Image Processing
ipcMain.handle('image:processSingle', async (_event, product: Product, config: Config) => {
  try {
    if (!product.matchedImagePaths?.length) {
      return { success: false, error: 'No matched image' };
    }

    const result = await processingService.composeImage(
      product.matchedImagePaths[0],
      config,
      product.sku
    );
    
    if (result.success) {
      await loggingService.success(`Processed SKU ${product.sku}`, { outputPath: result.outputPath });
    } else {
      await loggingService.error(`Failed to process SKU ${product.sku}`, { error: result.error });
    }
    
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    await loggingService.error(message);
    return { success: false, error: message };
  }
});

ipcMain.handle('image:processBatch', async (_event, products: Product[], config: Config) => {
  const results: ProcessingResult[] = [];
  
  for (const product of products) {
    if (product.status !== 'Ready' || !product.matchedImagePaths?.length) {
      results.push({
        sku: product.sku,
        success: false,
        error: product.errorMessage || 'No matched image',
        matchedImagePaths: product.matchedImagePaths || [],
      });
      continue;
    }

    const result = await processingService.composeImage(
      product.matchedImagePaths[0],
      config,
      product.sku
    );
    results.push(result);

    if (result.success) {
      await loggingService.success(`Processed SKU ${product.sku}`, { outputPath: result.outputPath });
    } else {
      await loggingService.error(`Failed to process SKU ${product.sku}`, { error: result.error });
    }
  }

  return { success: true, data: results };
});

// Logging
ipcMain.handle('log:getRecent', async () => {
  return loggingService.getRecentLogs(10);
});

ipcMain.handle('log:get', async (_event, runId: string) => {
  return loggingService.getLog(runId);
});
