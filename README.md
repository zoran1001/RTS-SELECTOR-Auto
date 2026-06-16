# Selector - Image Processing Tool

一个基于 Electron 的本地桌面应用，用于自动化图片处理工作流。

## 功能特点

- 从 Google Sheet 读取产品数据（SKU、产品名称、状态）
- 从 Google Drive 匹配产品原始图片
- 自动合成 1080x1080 正方形图片
- 按 SKU 命名输出文件到本地文件夹
- 本地配置持久化存储
- 处理日志记录

## 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Google Service Account

创建 `.env` 文件并添加：

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":...}
```

### 3. 启动开发模式

```bash
npm run dev
```

### 4. 打包应用

```bash
# Windows
npm run package:win

# macOS
npm run package:mac
```

## 使用流程

1. **打开应用**：运行 `npm run dev` 启动开发模式
2. **配置设置**：在 Settings 页面配置：
   - Google Sheet ID
   - Sheet 列映射
   - Google Drive 原始图片文件夹 ID
   - 本地输出文件夹路径
   - 背景图路径（可选）
3. **加载产品**：点击 "Load Sheet" 从 Google Sheet 读取产品列表
4. **匹配图片**：点击 "Match Images" 根据 SKU 匹配 Drive 中的图片
5. **处理图片**：点击 "Process Ready" 批量处理状态为 Ready 的产品
6. **查看输出**：点击 "Open Output Folder" 查看合成后的图片

## 输出格式

- 尺寸：1080 × 1080 像素
- 格式：PNG（可配置为 JPG 或 WebP）
- 命名：`{SKU}.png`
- 位置：配置的本地输出文件夹

## 状态说明

| 状态 | 说明 |
|------|------|
| Ready | 待处理 |
| Pending | 暂不处理 |
| Done | 已完成 |
| Error | 处理失败 |
| Missing Image | 找不到图片 |
| Need Review | 需要人工检查 |

## 项目结构

```
selector-desktop/
├── src/
│   ├── main/
│   │   ├── main.ts          # Electron 主进程
│   │   └── preload.ts       # 预加载脚本
│   ├── renderer/
│   │   ├── App.tsx          # React 主组件
│   │   └── index.css        # 样式文件
│   ├── services/            # 业务服务层
│   ├── types/               # TypeScript 类型定义
│   └── utils/               # 工具函数
├── index.html               # HTML 入口
├── vite.config.ts           # Vite 配置
├── electron.vite.config.ts  # Electron Vite 配置
└── package.json             # 项目配置
```

## 技术栈

- Electron 32
- React 19
- TypeScript
- Tailwind CSS 4
- Sharp（图片处理）
- Google APIs（Sheets、Drive）
- Electron Store（配置存储）
