// 日志级别
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

// 日志条目
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  sku?: string;
}

// 处理日志（包含多个条目）
export interface ProcessingLog {
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  totalProducts: number;
  successCount: number;
  errorCount: number;
  entries: LogEntry[];
}
