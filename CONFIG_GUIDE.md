# Image Composer Electron v0.5.2 - 配置功能测试指南

## ✅ 已完成的修改

### 1. 配置自动加载
- **文件**: `renderer/renderer.js`
- **函数**: `loadConfig()`
- **触发**: 应用启动时自动调用
- **效果**: 从 `config.yaml` 读取配置并填充到设置表单

### 2. 配置自动保存
- **文件**: `renderer/renderer.js`
- **函数**: `autoSaveSettings()`
- **触发**: 设置表单的任何输入项被修改时自动触发
- **效果**: 延迟 500ms 后自动保存到 `config.yaml`

### 3. 防抖优化
- **函数**: `debounce()`
- **效果**: 避免频繁修改时反复保存

---

## 🧪 测试步骤

### 测试 1: 启动自动加载配置
1. 确保 `config.yaml` 中有配置（参考下面的示例）
2. 启动应用（双击 `启动.vbs`）
3. 点击工具栏的**设置**按钮
4. **预期结果**: 设置表单应该显示 `config.yaml` 中的值

### 测试 2: 修改自动保存
1. 在设置表单中修改任意项（如 Google Sheets ID）
2. 等待 500ms（不用点保存按钮）
3. 关闭设置框，然后重新打开
4. **预期结果**: 修改的值应该被保存并重新加载
5. 检查 `config.yaml` 文件，确认值已更新

---

## 📋 config.yaml 示例

```yaml
# Image Composer Electron 配置文件 v0.5.2

# Google Sheets 配置
sheetsId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upc"
sheetName: "Sheet1"

# 本地文件夹配置
localFolder: "C:\\Users\\Administrator\\Pictures\\ImageComposer\\products"
outputFolder: "C:\\Users\\Administrator\\Pictures\\ImageComposer\\output"
tempFolder: "C:\\Users\\Administrator\\Pictures\\ImageComposer\\temp"

# Google Drive 配置
driveFolderId: ""
sharedDriveId: ""

# 监听配置
watchInterval: 60  # 秒
watchEnabled: false

# 合成配置
composeWidth: 800
composeHeight: 800
composeQuality: 95
composeFormat: "png"

# 日志配置
logLevel: "info"
logFile: "image-composer.log"

# 语言配置
language: "zh"  # zh 或 en
```

---

## 📝 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `renderer/renderer.js` | 添加自动保存功能、防抖函数 |
| `preload.js` | 已暴露 `getConfig` 和 `saveConfig` API（无需修改）|
| `bridge/bridge.py` | 已有配置 API（无需修改）|

---

## ⚠️ 注意事项

1. **自动保存延迟**: 修改配置后需要等待 500ms 才会自动保存
2. **保存按钮仍可用**: 设置框中的"保存"按钮仍然可用（可以手动立即保存）
3. **配置文件编码**: `config.yaml` 使用 UTF-8 编码

---

## 🐛 如果测试失败

请提供：
1. 应用启动时的日志输出
2. 打开设置框时的日志输出
3. 修改配置时的日志输出
4. `config.yaml` 文件的内容

我会根据错误信息继续修复。
