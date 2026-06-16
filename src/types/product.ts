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

export enum ProductStatus {
  READY = 'Ready',
  PENDING = 'Pending',
  DONE = 'Done',
  ERROR = 'Error',
  MISSING_SKU = 'Missing SKU',
  MISSING_IMAGE = 'Missing Image',
  NEED_REVIEW = 'Need Review',
}

export interface Product {
  sku: string;
  productName: string;
  status: ProductStatus | string;
  matchedImagePaths?: string[];
  errorMessage?: string;
}

export interface GoogleSheetConfig {
  spreadsheetId: string;
  sheetName: string;
  columnMapping: {
    sku: string;
    productName: string;
    status: string;
  };
}

export interface MatchResult {
  sku: string;
  status: 'unique_match' | 'no_match' | 'multiple_matches';
  imagePaths: string[];
}

export interface ProcessingResult {
  sku: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  matchedImagePaths: string[];
}
