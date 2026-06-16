import fs from 'fs/promises';
import path from 'path';
import { LogEntry, LogLevel, ProcessingLog } from '@/types';

// 日志目录
const LOG_DIR = process.env.LOG_DIR || './logs';

/**
 * 日志服务
 */
export class LoggingService {
  private currentLog: ProcessingLog | null = null;

  /**
   * 生成随机 ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 初始化新的处理日志
   */
  async initLog(): Promise<string> {
    const runId = this.generateRunId();
    this.currentLog = {
      runId,
      startedAt: new Date(),
      totalProducts: 0,
      successCount: 0,
      errorCount: 0,
      entries: [],
    };
    return runId;
  }

  /**
   * 添加日志条目
   */
  async addEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    sku?: string
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      sku,
    };

    if (this.currentLog) {
      this.currentLog.entries.push(entry);
      console.log(`[${level}] ${sku ? `[${sku}] ` : ''}${message}`);
    }
  }

  /**
   * 记录信息日志
   */
  async info(message: string, context?: Record<string, unknown>, sku?: string): Promise<void> {
    await this.addEntry(LogLevel.INFO, message, context, sku);
  }

  /**
   * 记录成功日志
   */
  async success(message: string, context?: Record<string, unknown>, sku?: string): Promise<void> {
    await this.addEntry(LogLevel.SUCCESS, message, context, sku);
  }

  /**
   * 记录警告日志
   */
  async warn(message: string, context?: Record<string, unknown>, sku?: string): Promise<void> {
    await this.addEntry(LogLevel.WARN, message, context, sku);
  }

  /**
   * 记录错误日志
   */
  async error(message: string, context?: Record<string, unknown>, sku?: string): Promise<void> {
    await this.addEntry(LogLevel.ERROR, message, context, sku);
  }

  /**
   * 完成日志记录
   */
  async completeLog(totalProducts: number): Promise<void> {
    if (this.currentLog) {
      this.currentLog.completedAt = new Date();
      this.currentLog.totalProducts = totalProducts;
      this.currentLog.successCount = this.currentLog.entries.filter(
        (e) => e.level === LogLevel.SUCCESS
      ).length;
      this.currentLog.errorCount = this.currentLog.entries.filter(
        (e) => e.level === LogLevel.ERROR
      ).length;

      await this.saveLog(this.currentLog);
    }
  }

  /**
   * 保存日志到文件
   */
  private async saveLog(log: ProcessingLog): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const fileName = `${log.runId}.json`;
      const filePath = path.join(LOG_DIR, fileName);
      await fs.writeFile(filePath, JSON.stringify(log, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  /**
   * 获取最新日志文件列表
   */
  async getRecentLogs(count: number = 10): Promise<string[]> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const files = await fs.readdir(LOG_DIR);
      const logFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, count);
      return logFiles;
    } catch {
      return [];
    }
  }

  /**
   * 读取指定日志
   */
  async getLog(runId: string): Promise<ProcessingLog | null> {
    try {
      const filePath = path.join(LOG_DIR, `${runId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

// 导出单例
export const loggingService = new LoggingService();
