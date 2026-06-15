const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// 引入 electron-store 保存本地配置
const Store = require('electron-store');
const store = new Store({
    name: 'image-composer-config',
    defaults: {
        sheetsUrl: '',
        sheetsId: '',
        localFolder: '',
        outputFolder: '',
        sku_column: 'SKU',
        status_column: 'Status',
        active_status: 'active',
        composeWidth: 800,
        composeHeight: 800
    }
});

let mainWindow;
let pythonProcess;
let tray;
let bridgePort = 5000;
let bridgeUrl = `http://127.0.0.1:${bridgePort}`;

// 判断是否为打包模式
const isPackaged = app.isPackaged;
const appPath = isPackaged ? process.resourcesPath : __dirname;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        icon: path.join(appPath, 'renderer/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function findBridgeExecutable() {
    // 打包模式下，bridge.exe 在 resources/bridge/ 目录
    const bridgeExePath = path.join(appPath, 'bridge', 'bridge.exe');
    if (fs.existsSync(bridgeExePath)) {
        return bridgeExePath;
    }

    // 开发模式下，尝试用 Python 运行 bridge.py
    const pythonScript = path.join(__dirname, 'bridge/bridge.py');
    if (fs.existsSync(pythonScript)) {
        const pythonCandidates = ['python', 'python3', 'py'];
        for (const candidate of pythonCandidates) {
            try {
                const { execSync } = require('child_process');
                execSync(`${candidate} --version`, { stdio: 'ignore' });
                return { command: candidate, args: [pythonScript] };
            } catch (e) {
                continue;
            }
        }
    }

    return null;
}

function startPythonBridge() {
    return new Promise((resolve, reject) => {
        const result = findBridgeExecutable();
        
        if (!result) {
            reject(new Error('未找到 Python 桥接可执行文件'));
            return;
        }

        let command, args;
        if (typeof result === 'string') {
            command = result;
            args = [];
        } else {
            command = result.command;
            args = result.args;
        }
        
        console.log(`[INFO] 启动 Python 桥接: ${command} ${args.join(' ')}`);
        
        pythonProcess = spawn(command, args, {
            env: { ...process.env, FLASK_ENV: 'development', PYTHONIOENCODING: 'utf-8' },
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let started = false;
        let stdoutBuffer = '';
        
        pythonProcess.stdout.on('data', (data) => {
            const message = data.toString('utf8');
            stdoutBuffer += message;
            console.log(`[Python] ${message.trim()}`);
            
            // 不依赖中文匹配，只要进程启动就开始轮询健康检查
            if (!started && (message.includes('Running on') || message.includes('Serving'))) {
                started = true;
                setTimeout(() => {
                    pollBridgeHealth(resolve, reject);
                }, 1500);
            }
        });
        
        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Python Error] ${data.toString('utf8')}`);
            // stderr 也可能有启动信息
            const msg = data.toString('utf8');
            if (!started && msg.includes('Running on')) {
                started = true;
                setTimeout(() => {
                    pollBridgeHealth(resolve, reject);
                }, 1500);
            }
        });
        
        pythonProcess.on('close', (code) => {
            console.log(`[INFO] Python 进程已退出，代码: ${code}`);
            if (!started) {
                reject(new Error(`Python 桥接进程意外退出，代码: ${code}`));
            }
        });
        
        pythonProcess.on('error', (err) => {
            console.error(`[ERROR] Python 进程启动失败: ${err.message}`);
            reject(err);
        });

        // 兜底：3秒后开始轮询（不等待任何输出）
        setTimeout(() => {
            if (!started) {
                console.log('[INFO] 超时未检测到输出，尝试轮询健康检查...');
                started = true; // 防止重复触发
                pollBridgeHealth(resolve, reject);
            }
        }, 5000);

        // 硬超时
        setTimeout(() => {
            if (!started) {
                reject(new Error('Python 桥接启动超时'));
            }
        }, 60000);
    });
}

// 轮询健康检查
function pollBridgeHealth(resolve, reject, attempts = 10) {
    checkBridgeHealth()
        .then(resolve)
        .catch((err) => {
            if (attempts > 0) {
                setTimeout(() => pollBridgeHealth(resolve, reject, attempts - 1), 1000);
            } else {
                reject(new Error('Python 桥接启动后无法连接（健康检查失败）'));
            }
        });
}

function checkBridgeHealth() {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/health', bridgeUrl);
        
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === 'ok') {
                        console.log('[INFO] Python 桥接已就绪');
                        resolve();
                    } else {
                        reject(new Error('桥接状态异常'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
    });
}

function sendLog(level, message) {
    if (mainWindow && mainWindow.webContents) {
        try {
            const timestamp = new Date().toLocaleTimeString('zh-CN');
            mainWindow.webContents.send('log', { level, message, timestamp });
        } catch (e) {
            // 忽略发送失败
        }
    }
}

// IPC 处理 - 代理到 Python 桥接
ipcMain.handle('api-request', async (event, options) => {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path, bridgeUrl);
        
        const reqOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = http.request(url, reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    resolve({ success: false, error: '解析响应失败', raw: data });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
});

ipcMain.on('log', (event, message) => {
    console.log(`[Renderer] ${message}`);
});

// 本地配置保存（使用 electron-store）
ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
});

ipcMain.handle('store-get-all', () => {
    return store.store;
});

ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
    console.log(`[Store] 保存配置: ${key} = ${value}`);
    return true;
});

ipcMain.handle('store-set-multiple', (event, values) => {
    Object.keys(values).forEach(key => {
        store.set(key, values[key]);
    });
    console.log(`[Store] 批量保存配置:`, values);
    return true;
});

app.whenReady().then(async () => {
    try {
        sendLog('info', '正在启动 Python 桥接...');
        await startPythonBridge();
        sendLog('info', 'Python 桥接已启动');
        createWindow();
        
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (err) {
        console.error(`[ERROR] 启动失败: ${err.message}`);
        dialog.showErrorBox('启动失败', err.message);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (pythonProcess) {
            pythonProcess.kill();
        }
        app.quit();
    }
});
