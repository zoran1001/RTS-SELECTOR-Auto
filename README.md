# Image Composer Electron v0.5.2

基于 Electron + Python (Flask) 的图片合成工具，支持从 Google Drive 搜索、预览和下载图片。

## 功能特性

- 🔍 **Google Drive 图片搜索** - 根据 SKU 搜索 Google Drive 中的图片
- 🖼️ **缩略图预览** - 在网格中显示图片缩略图
- ✅ **手动选择** - 手动选择需要下载的图片
- 📥 **批量下载** - 下载选中的图片到本地
- 🎨 **图片合成** - 将产品图和背景图按图层顺序合成
- 📊 **Google Sheets 集成** - 从 Google Sheets 读取 SKU 列表
- 🔄 **自动监听** - 监听 Sheets 变化，自动处理新增 SKU

## 项目结构

```
image-composer-electron/
├── main.js              # Electron 主进程
├── preload.js           # IPC 预加载脚本
├── package.json         # Node.js 依赖配置
├── requirements.txt     # Python 依赖列表
├── config.yaml          # 应用配置文件
├── bridge/              # Python 后端
│   └── bridge.py       # Flask HTTP API 服务器
└── renderer/           # 前端界面
    ├── index.html       # 主界面
    ├── renderer.js      # 前端逻辑
    └── style.css       # 样式表
```

## 安装步骤

### 1. 安装 Node.js 依赖

```bash
cd E:\DESTOP\se\image-composer-electron
npm install
```

### 2. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 3. 配置 Google API 凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目并启用 **Google Drive API** 和 **Google Sheets API**
3. 创建 OAuth 2.0 客户端 ID
4. 下载凭证文件并保存为 `credentials/token.json`

### 4. 配置应用

编辑 `config.yaml` 文件，设置：
- `sheetsId` - Google Sheets ID
- `localFolder` - 本地图片文件夹路径
- `outputFolder` - 合成输出文件夹路径

## 运行应用

### 开发模式

```bash
npm start
```

### 构建可执行文件

```bash
npm run pack
```

## API 接口

Python 后端提供以下 HTTP API：

### GET /api/health
健康检查

**响应:**
```json
{
  "status": "ok",
  "version": "0.5.2",
  "drive_connected": true
}
```

### POST /api/drive/scan
扫描 Google Drive 图片

**请求体:**
```json
{
  "sku": "SKU12345"
}
```

**响应:**
```json
{
  "success": true,
  "files": [
    {
      "id": "file_id",
      "name": "image.jpg",
      "thumbnailLink": "https://...",
      "webContentLink": "https://..."
    }
  ],
  "count": 1
}
```

### POST /api/drive/download
下载 Google Drive 图片

**请求体:**
```json
{
  "file_ids": ["file_id1", "file_id2"]
}
```

**响应:**
```json
{
  "success": true,
  "downloaded": 2,
  "total": 2,
  "errors": []
}
```

### POST /api/compose
合成图片

**请求体:**
```json
{
  "skus": ["SKU12345", "SKU67890"]
}
```

**响应:**
```json
{
  "success": true,
  "composed": 2,
  "total": 2,
  "errors": []
}
```

### GET /api/config
获取配置

### POST /api/config
保存配置

## 技术栈

### 前端
- Electron 28+
- HTML5 / CSS3
- Vanilla JavaScript

### 后端
- Python 3.12+
- Flask (HTTP API)
- Google Drive API v3
- Google Sheets API v4

## 常见问题

### 1. Python 桥接启动失败

**错误信息:** `Python 桥接启动超时`

**解决方法:**
- 检查 Python 是否已安装并在 PATH 中
- 检查 `requirements.txt` 中的依赖是否已安装
- 检查 `credentials/token.json` 是否存在且有效

### 2. Google Drive API 授权失败

**错误信息:** `凭证无效或已过期`

**解决方法:**
- 重新生成 OAuth 2.0 token
- 确保已启用 Google Drive API
- 检查 `token.json` 文件格式是否正确

### 3. 图片下载失败

**可能原因:**
- Google Drive 文件权限不足
- 网络连接问题
- 本地文件夹权限不足

## 开发说明

### 调试模式

在 `main.js` 中取消注释以下行以打开开发者工具：

```javascript
// mainWindow.webContents.openDevTools();
```

### 日志查看

应用日志显示在界面底部的"运行日志"面板中。

## 版本历史

### v0.5.2 (当前版本)
- 初始版本
- 支持 Google Drive 图片搜索和下载
- 支持图片合成
- 支持 Google Sheets 集成

## 许可证

MIT License

## 作者

WorkBuddy AI Assistant
