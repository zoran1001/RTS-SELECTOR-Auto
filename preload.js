const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给渲染进程的 API - v0.6.0
 * 新流程：加载表格 → 扫描本地图片 → 匹配 → 合成
 */
contextBridge.exposeInMainWorld('api', {
    // 通用 API 请求方法
    request: async (options) => {
        return await ipcRenderer.invoke('api-request', options);
    },

    // 本地配置存储（使用 electron-store，配置保存在用户电脑）
    store: {
        get: async (key) => {
            return await ipcRenderer.invoke('store-get', key);
        },
        getAll: async () => {
            return await ipcRenderer.invoke('store-get-all');
        },
        set: async (key, value) => {
            return await ipcRenderer.invoke('store-set', key, value);
        },
        setMultiple: async (values) => {
            return await ipcRenderer.invoke('store-set-multiple', values);
        }
    },

    // 扫描 Google Drive
    scanDrive: async (sku) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/drive/scan',
            body: { sku }
        });
    },

    // 下载图片
    downloadImages: async (fileIds) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/drive/download',
            body: { file_ids: fileIds }
        });
    },

    // 扫描本地图片文件夹
    scanLocalImages: async (folder) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/local/scan',
            body: { folder }
        });
    },

    // SKU 与图片匹配
    matchImages: async (skus, images) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/match',
            body: { skus, images }
        });
    },

    // 从 Google Drive 根据 SKU 搜索并下载图片
    driveSearchDownload: async (skus, outputFolder, folderId, recursive) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/drive/search-download',
            body: { skus: skus, output_folder: outputFolder, folder_id: folderId, recursive: recursive }
        });
    },

    // 获取 Google Drive 文件夹列表
    getDriveFolders: async (parentFolderId) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'GET',
            path: `/api/drive/folders?folder_id=${parentFolderId || ''}`
        });
    },

    // 预处理（原图 → 产品图）
    preprocess: async (skus) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/preprocess',
            body: { skus }
        });
    },

    // 监听检查（检测新增/下架SKU）
    watchCheck: async (sheetsUrl, currentSKUs) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/watch/check',
            body: { sheets_url: sheetsUrl, current_skus: currentSKUs }
        });
    },

    // 删除下架SKU的文件（扫描输出目录删除不在表格中的文件）
    watchDelete: async (sheetsUrl) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/watch/delete',
            body: { sheets_url: sheetsUrl }
        });
    },

    // 一键处理（完整流程）
    processAll: async (sheetsUrl) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/process-all',
            body: { sheets_url: sheetsUrl }
        });
    },

    // 获取配置（从 Python 后端）
    getConfig: async () => {
        return await ipcRenderer.invoke('api-request', {
            method: 'GET',
            path: '/api/config'
        });
    },

    // 加载 Google Sheets 数据
    loadSheets: async (config) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/sheets/load',
            body: config
        });
    },

    // 保存配置（到 Python 后端）
    saveConfig: async (config) => {
        return await ipcRenderer.invoke('api-request', {
            method: 'POST',
            path: '/api/config',
            body: config
        });
    },

    // 健康检查
    healthCheck: async () => {
        return await ipcRenderer.invoke('api-request', {
            method: 'GET',
            path: '/api/health'
        });
    },

    // 日志监听
    onLog: (callback) => {
        ipcRenderer.on('log', (event, data) => callback(data));
    }
});
