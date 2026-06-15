// renderer.js - Image Composer Electron 前端逻辑 v0.6.0
// 新流程：加载表格 → 扫描本地图片 → 匹配 → 合成

document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const sheetsStatus = document.getElementById('sheets-status');
    const skuList = document.getElementById('sku-list');
    const skuSearch = document.getElementById('sku-search');
    const skuCount = document.getElementById('sku-count');
    const localImageList = document.getElementById('local-image-list');
    const localImageStatus = document.getElementById('local-image-status');
    const localImageCount = document.getElementById('local-image-count');
    const matchResultList = document.getElementById('match-result-list');
    const matchStatus = document.getElementById('match-status');
    const matchCount = document.getElementById('match-count');
    const logContainer = document.getElementById('log-container');
    const statusMessage = document.getElementById('status-message');
    const progressInfo = document.getElementById('progress-info');
    const settingsModal = document.getElementById('settings-modal');
    const statusIndicator = document.getElementById('status-indicator');

    // 状态变量
    let currentSKUs = [];           // 从表格加载的 SKU
    let localImages = [];           // 本地扫描的图片
    let matchedResults = [];        // 匹配结果
    let unmatchedSKUs = [];         // 未匹配的 SKU
    
    // 监听状态
    let watchEnabled = false;
    let watchInterval = 60000;     // 默认60秒
    let watchTimer = null;
    let pendingNewSKUs = [];       // 待处理的新增SKU

    // 初始化
    init();

    async function init() {
        bindEvents();
        
        // 快速健康检查（异步）
        checkHealth();
        
        // 加载配置并自动启动（异步）
        loadConfig().then(() => {
            autoStartIfPossible();
        });
        
        log('Image Composer v0.6.0 已启动', 'info');
        updateStatus('就绪');
    }
    
    // 启动时自动加载（如果之前保存了配置）- 异步执行
    async function autoStartIfPossible() {
        try {
            const sheetsUrl = await window.api.store.get('sheetsUrl');
            
            if (sheetsUrl) {
                log('检测到保存的表格链接，正在自动加载...', 'info');
                
                // 加载表格
                await loadSheetsInternal(sheetsUrl);
            }
        } catch (err) {
            console.error('自动启动失败:', err);
        }
    }

    function bindEvents() {
        // 工具栏按钮
        document.getElementById('btn-load-sheets').addEventListener('click', () => loadSheets());
        document.getElementById('btn-scan-local').addEventListener('click', () => scanLocalImages());
        document.getElementById('btn-compose').addEventListener('click', () => composeImages());
        document.getElementById('btn-process-all').addEventListener('click', () => processAll());
        document.getElementById('btn-watch').addEventListener('click', () => toggleWatch());
        document.getElementById('btn-settings').addEventListener('click', () => showSettings());

        // SKU 搜索
        skuSearch.addEventListener('input', (e) => filterSKUs(e.target.value));

        // 全选
        document.getElementById('btn-select-all').addEventListener('click', () => toggleSelectAll());

        // 设置模态框
        document.getElementById('btn-close-settings').addEventListener('click', () => hideSettings());
        document.getElementById('btn-save-settings').addEventListener('click', () => saveSettings());
        document.getElementById('btn-cancel-settings').addEventListener('click', () => hideSettings());

        // 新增SKU弹窗
        document.getElementById('btn-new-sku-continue').addEventListener('click', () => handleNewSKUContinue());
        document.getElementById('btn-new-sku-cancel').addEventListener('click', () => hideNewSKUModal());

        // 日志
        document.getElementById('btn-clear-log').addEventListener('click', () => clearLog());

        // 监听日志
        window.api.onLog((data) => {
            log(data.message, data.level);
        });
    }

    // 检查后端健康状态
    async function checkHealth() {
        try {
            const health = await window.api.healthCheck();
            if (health.status === 'ok') {
                statusIndicator.className = 'status-online';
                statusIndicator.textContent = '已连接';
                log('后端服务已连接', 'success');
                
                if (health.credentials_valid) {
                    log('凭证已验证有效，无需再次验证', 'success');
                } else {
                    log('凭证未验证或已过期，请检查设置', 'warning');
                }
            } else {
                statusIndicator.className = 'status-offline';
                statusIndicator.textContent = '未连接';
            }
        } catch (err) {
            statusIndicator.className = 'status-offline';
            statusIndicator.textContent = '未连接';
            log('无法连接后端服务', 'error');
        }
    }

    // 步骤1：加载 Google Sheets 数据（带 UI）
    async function loadSheets() {
        // 从设置中读取链接
        const url = await window.api.store.get('sheetsUrl');
        if (!url) {
            alert('请先在设置中配置 Google Sheets 链接');
            showSettings();
            return;
        }
        
        await loadSheetsInternal(url);
    }
    
    // 步骤1：加载 Google Sheets 数据（内部调用，不弹窗）
    async function loadSheetsInternal(url) {
        if (!url) {
            return;
        }

        log(`开始读取 Google Sheets...`, 'info');
        updateStatus('正在读取表格...');
        sheetsStatus.textContent = '读取中...';
        sheetsStatus.className = 'sheets-status loading';

        try {
            const config = await window.api.getConfig();
            const result = await window.api.loadSheets({
                sheets_url: url,
                sku_column: config.sku_column || 'SKU',
                product_name_column: config.product_name_column || 'title',
                status_column: config.status_column || 'Status',
                active_status: config.active_status || 'active',
                exclude_keywords: config.exclude_keywords || []
            });

            if (result.success && result.items) {
                currentSKUs = result.items;
                renderSKUList(result.items);
                sheetsStatus.textContent = `已加载 ${result.filtered} 条`;
                sheetsStatus.className = 'sheets-status success';
                log(`✅ Sheets 加载完成: ${result.total_rows} 行, 识别到 ${result.filtered} 个 SKU`, 'success');
                updateStatus(`已识别 ${result.filtered} 个 SKU`);
            } else {
                log('❌ Sheets 加载失败: ' + (result.error || '未知错误'), 'error');
                sheetsStatus.textContent = '加载失败';
                sheetsStatus.className = 'sheets-status error';
                updateStatus('加载失败');
            }
        } catch (err) {
            log('❌ Sheets 出错: ' + err.message, 'error');
            sheetsStatus.textContent = '出错';
            sheetsStatus.className = 'sheets-status error';
            updateStatus('出错');
        }
    }

    // 渲染 SKU 列表
    function renderSKUList(items) {
        skuList.innerHTML = '';

        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'sku-item';
            row.dataset.sku = item.sku;
            row.dataset.index = index;

            const skuLabel = document.createElement('span');
            skuLabel.className = 'sku-label';
            skuLabel.textContent = item.sku;

            const nameLabel = document.createElement('span');
            nameLabel.className = 'sku-name';
            nameLabel.textContent = item.product_name || '';

            // 图片状态列
            const statusSpan = document.createElement('span');
            statusSpan.className = 'sku-image-status';
            statusSpan.textContent = '❓';  // 初始状态：未识别
            statusSpan.title = '图片未识别';
            statusSpan.style.color = '#ffa502';

            row.appendChild(skuLabel);
            row.appendChild(nameLabel);
            row.appendChild(statusSpan);
            skuList.appendChild(row);
        });

        skuCount.textContent = `共 ${items.length} 个 SKU`;
    }

    // 步骤2：扫描本地图片文件夹（带 UI）
    async function scanLocalImages() {
        log('开始扫描本地图片文件夹...', 'info');
        updateStatus('正在扫描本地图片...');
        localImageStatus.textContent = '扫描中...';

        try {
            const result = await window.api.scanLocalImages();
            
            if (result.success && result.images) {
                localImages = result.images;
                renderLocalImageList(result.images);
                localImageStatus.textContent = `已扫描`;
                localImageStatus.className = 'status-success';
                log(`✅ 本地图片扫描完成: 找到 ${result.images.length} 张图片`, 'success');
                updateStatus(`找到 ${result.images.length} 张图片`);
                
                // 自动识别匹配：扫描完图片后自动更新 SKU 列表的匹配状态
                await autoMatchSKUs();
            } else {
                log('❌ 扫描失败: ' + (result.error || '未知错误'), 'error');
                localImageStatus.textContent = '扫描失败';
                updateStatus('扫描失败');
            }
        } catch (err) {
            log('❌ 扫描出错: ' + err.message, 'error');
            localImageStatus.textContent = '出错';
            updateStatus('出错');
        }
    }
    
    // 步骤2：扫描本地图片文件夹（内部调用）
    async function scanLocalImagesInternal() {
        try {
            const result = await window.api.scanLocalImages();
            
            if (result.success && result.images) {
                localImages = result.images;
                renderLocalImageList(result.images);
                localImageStatus.textContent = `已扫描`;
                localImageStatus.className = 'status-success';
                log(`✅ 本地图片扫描完成: 找到 ${result.images.length} 张图片`, 'success');
                updateStatus(`找到 ${result.images.length} 张图片`);
                
                // 自动识别匹配
                await autoMatchSKUs();
            } else {
                log('❌ 扫描失败: ' + (result.error || '未知错误'), 'error');
                localImageStatus.textContent = '扫描失败';
                updateStatus('扫描失败');
            }
        } catch (err) {
            log('❌ 扫描出错: ' + err.message, 'error');
            localImageStatus.textContent = '出错';
            updateStatus('出错');
        }
    }

    // 自动识别 SKU 与图片的匹配
    async function autoMatchSKUs() {
        if (currentSKUs.length === 0 || localImages.length === 0) {
            return;
        }

        log('自动识别图片匹配状态...', 'info');
        updateStatus('正在识别匹配...');

        try {
            const result = await window.api.matchImages(currentSKUs, localImages);
            
            if (result.success) {
                // 记录匹配结果
                const matchedSKUs = new Set();
                result.matched.forEach(item => {
                    matchedSKUs.add(item.sku);
                });
                
                // 更新 SKU 列表的显示状态
                updateSKUListMatchStatus(matchedSKUs);
                
                // 更新统计信息
                matchedResults = result.matched;
                unmatchedSKUs = result.unmatched_skus;
                
                const stats = result.stats;
                log(`识别完成: 匹配成功 ${stats.matched_count}, 未匹配 ${stats.unmatched_sku_count}`, 'success');
                updateStatus(`匹配成功 ${stats.matched_count} 个`);
                
                // 更新匹配统计显示
                matchCount.textContent = `✅ 匹配成功: ${stats.matched_count} | ❌ 未匹配: ${stats.unmatched_sku_count}`;
            } else {
                log('识别失败: ' + (result.error || '未知错误'), 'error');
            }
        } catch (err) {
            log('识别出错: ' + err.message, 'error');
        }
    }

    // 更新 SKU 列表的匹配状态
    function updateSKUListMatchStatus(matchedSKUs) {
        const items = skuList.querySelectorAll('.sku-item');
        
        items.forEach(item => {
            const sku = item.dataset.sku;
            const statusSpan = item.querySelector('.sku-image-status');
            
            if (statusSpan) {
                if (matchedSKUs.has(sku)) {
                    statusSpan.textContent = '✅';
                    statusSpan.className = 'sku-image-status matched';
                } else {
                    statusSpan.textContent = '❌';
                    statusSpan.className = 'sku-image-status unmatched';
                }
            }
        });
        
        // 更新匹配统计
        const total = items.length;
        const matchedCount = matchedSKUs.size;
        const unmatchedCount = total - matchedCount;
        matchCount.textContent = `✅ 匹配成功: ${matchedCount} | ❌ 未匹配: ${unmatchedCount}`;
    }

    // 渲染本地图片列表
    function renderLocalImageList(images) {
        localImageList.innerHTML = '';

        images.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.dataset.filename = img.filename;

            const filenameSpan = document.createElement('span');
            filenameSpan.className = 'image-filename';
            filenameSpan.textContent = img.filename;

            const pathSpan = document.createElement('span');
            pathSpan.className = 'image-path';
            pathSpan.textContent = img.relative_path || img.path;

            item.appendChild(filenameSpan);
            item.appendChild(pathSpan);
            localImageList.appendChild(item);
        });

        localImageCount.textContent = `共 ${images.length} 张图片`;
    }

    // 渲染匹配结果（用于显示详细信息）
    function renderMatchResult(matched, unmatched) {
        matchResultList.innerHTML = '';

        // 渲染匹配成功的
        matched.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'match-item match-success';
            
            const skuSpan = document.createElement('span');
            skuSpan.className = 'match-sku';
            skuSpan.textContent = item.sku;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'match-count';
            countSpan.textContent = `${item.images.length} 张图片`;
            
            const statusSpan = document.createElement('span');
            statusSpan.className = 'match-status-tag';
            statusSpan.textContent = '✅';
            
            row.appendChild(skuSpan);
            row.appendChild(countSpan);
            row.appendChild(statusSpan);
            matchResultList.appendChild(row);
        });

        // 渲染未匹配的 SKU
        unmatched.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'match-item match-failed';
            
            const skuSpan = document.createElement('span');
            skuSpan.className = 'match-sku';
            skuSpan.textContent = item.sku;
            
            const statusSpan = document.createElement('span');
            statusSpan.className = 'match-status-tag';
            statusSpan.textContent = '❌';
            
            row.appendChild(skuSpan);
            row.appendChild(statusSpan);
            matchResultList.appendChild(row);
        });

        matchCount.textContent = `✅ 匹配成功: ${matched.length} | ❌ 未匹配: ${unmatched.length}`;
    }

    // 步骤4：合成图片
    async function composeImages() {
        if (matchedResults.length === 0) {
            alert('请先进行匹配对照');
            return;
        }

        log(`开始合成 ${matchedResults.length} 个 SKU 的图片...`, 'info');
        updateStatus('正在合成图片...');

        try {
            const result = await window.api.compose(matchedResults);
            
            if (result.success) {
                log(`合成完成: 成功 ${result.composed} 张`, 'success');
                log(`输出目录: ${result.output_folder}`, 'info');
                updateStatus('合成完成');
                
                if (result.errors && result.errors.length > 0) {
                    log(`有 ${result.errors.length} 个错误`, 'warning');
                    result.errors.forEach(err => log(err, 'error'));
                }
            } else {
                log('合成失败: ' + (result.error || '未知错误'), 'error');
                updateStatus('合成失败');
            }
        } catch (err) {
            log('合成出错: ' + err.message, 'error');
            updateStatus('合成出错');
        }
    }

    // 一键处理（完整流程）
    async function processAll() {
        const url = await window.api.store.get('sheetsUrl');
        if (!url) {
            alert('请先在设置中配置 Google Sheets 链接');
            showSettings();
            return;
        }

        log('=== 开始一键处理 ===', 'info');
        updateStatus('正在一键处理...');

        try {
            const result = await window.api.processAll(url);
            
            if (result.success) {
                const stats = result.stats;
                log(`一键处理完成！`, 'success');
                log(`表格识别: ${stats.skus_from_sheets} 个 SKU`, 'info');
                log(`本地图片: ${stats.images_found} 张`, 'info');
                log(`匹配成功: ${stats.matched_skus} 个`, 'info');
                log(`未匹配: ${stats.unmatched_skus} 个`, 'warning');
                log(`合成完成: ${stats.composed} 张`, 'success');
                log(`输出目录: ${result.output_folder}`, 'info');
                
                updateStatus(`处理完成: 合成 ${stats.composed} 张图片`);
                
                // 更新界面显示
                if (result.matched) {
                    matchedResults = result.matched;
                    unmatchedSKUs = result.unmatched_skus || [];
                    renderMatchResult(result.matched, unmatchedSKUs);
                }
                
                if (result.errors && result.errors.length > 0) {
                    log(`错误: ${result.errors.length} 个`, 'warning');
                }
            } else {
                log('一键处理失败: ' + (result.error || '未知错误'), 'error');
                updateStatus('处理失败');
            }
        } catch (err) {
            log('一键处理出错: ' + err.message, 'error');
            updateStatus('处理出错');
        }
    }

    // 加载配置（从本地 store）
    async function loadConfig() {
        try {
            // 优先从本地 store 加载配置
            const localConfig = await window.api.store.getAll();
            console.log('从本地 store 加载配置:', localConfig);
            
            if (localConfig) {
                // 加载设置表单
                document.getElementById('setting-sheets-id').value = localConfig.sheetsId || '';
                document.getElementById('setting-local-folder').value = localConfig.localFolder || '';
                document.getElementById('setting-output-folder').value = localConfig.outputFolder || '';
                document.getElementById('setting-preprocess-input').value = localConfig.preprocessInput || '';
                document.getElementById('setting-drive-folder').value = localConfig.driveFolderId || '';
                document.getElementById('setting-sku-column').value = localConfig.sku_column || 'SKU';
                document.getElementById('setting-status-column').value = localConfig.status_column || 'Status';
                document.getElementById('setting-active-status').value = localConfig.active_status || 'active';
                document.getElementById('setting-compose-width').value = localConfig.composeWidth || 800;
                document.getElementById('setting-compose-height').value = localConfig.composeHeight || 800;
                
                // 加载水印配置
                const watermarkConfig = localConfig.watermark || {};
                document.getElementById('setting-watermark-enabled').checked = watermarkConfig.enabled || false;
                document.getElementById('setting-watermark-path').value = watermarkConfig.path || 'E:\\DESTOP\\se\\image-composer-electron\\watermark.png';
                document.getElementById('setting-watermark-width').value = watermarkConfig.width || 1080;
                
                // 加载监听配置
                document.getElementById('setting-watch-enabled').checked = localConfig.watchEnabled || false;
                document.getElementById('setting-watch-interval').value = localConfig.watchInterval || 60;
                
                // 自动填入 Google Sheets 链接（到设置中）
                if (localConfig.sheetsUrl) {
                    document.getElementById('setting-sheets-id').value = localConfig.sheetsUrl;
                } else if (localConfig.sheetsId) {
                    document.getElementById('setting-sheets-id').value = `https://docs.google.com/spreadsheets/d/${localConfig.sheetsId}`;
                }
            } else {
                console.log('无本地配置');
            }
        } catch (err) {
            log('加载配置失败: ' + err.message, 'warning');
            console.error('加载配置失败:', err);
        }
    }

    // 保存配置（到本地 store）
    async function saveSettings() {
        const sheetsUrl = document.getElementById('setting-sheets-id').value.trim();
        
        // 从 URL 中提取 sheetsId
        let sheetsId = '';
        if (sheetsUrl) {
            const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
                sheetsId = match[1];
            }
        }
        
        const config = {
            sheetsUrl: sheetsUrl,
            sheetsId: sheetsId,
            localFolder: document.getElementById('setting-local-folder').value.trim(),
            outputFolder: document.getElementById('setting-output-folder').value.trim(),
            preprocessInput: document.getElementById('setting-preprocess-input').value.trim(),
            driveFolderId: document.getElementById('setting-drive-folder').value.trim(),
            sku_column: document.getElementById('setting-sku-column').value.trim() || 'SKU',
            status_column: document.getElementById('setting-status-column').value.trim() || 'Status',
            active_status: document.getElementById('setting-active-status').value.trim() || 'active',
            composeWidth: parseInt(document.getElementById('setting-compose-width').value) || 800,
            composeHeight: parseInt(document.getElementById('setting-compose-height').value) || 800,
            // 水印配置
            watermark: {
                enabled: document.getElementById('setting-watermark-enabled').checked,
                path: document.getElementById('setting-watermark-path').value.trim() || 'E:\\DESTOP\\se\\image-composer-electron\\watermark.png',
                width: parseInt(document.getElementById('setting-watermark-width').value) || 1080,
                position_y: 0
            },
            // 监听配置
            watchEnabled: document.getElementById('setting-watch-enabled').checked,
            watchInterval: parseInt(document.getElementById('setting-watch-interval').value) || 60
        };
        
        log(`正在保存配置...`, 'info');
        
        try {
            // 保存到本地 store
            await window.api.store.setMultiple(config);
            log('✅ 配置已保存到本地！', 'success');
            hideSettings();
        } catch (err) {
            log('❌ 保存配置失败: ' + err.message, 'error');
            console.error('保存配置失败:', err);
        }
    }

    // UI 控制函数
    function showSettings() {
        settingsModal.classList.remove('hidden');
    }

    function hideSettings() {
        settingsModal.classList.add('hidden');
    }

    function filterSKUs(keyword) {
        const items = skuList.querySelectorAll('.sku-item');
        items.forEach(item => {
            const sku = item.dataset.sku.toLowerCase();
            if (sku.includes(keyword.toLowerCase())) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }

    function toggleSelectAll() {
        // 新版本不需要选择功能，因为匹配后自动合成
        log('新版本流程：匹配后自动合成所有', 'info');
    }

    // ===== 监听功能 =====
    
    // 切换监听状态
    async function toggleWatch() {
        const btn = document.getElementById('btn-watch');
        
        if (watchEnabled) {
            // 停止监听
            stopWatch();
            btn.textContent = '开始监听';
            btn.classList.remove('active');
            btn.style.background = '';
            log('监听已停止', 'info');
        } else {
            // 开始监听
            const sheetsUrl = await window.api.store.get('sheetsUrl');
            if (!sheetsUrl) {
                alert('请先在设置中配置 Google Sheets 链接');
                showSettings();
                return;
            }
            
            startWatch();
            btn.textContent = '停止监听';
            btn.classList.add('active');
            btn.style.background = '#e74c3c';
            log('监听已开始，每分钟检查一次', 'success');
        }
    }
    
    // 开始监听
    function startWatch() {
        watchEnabled = true;
        
        // 从配置获取监听间隔
        getWatchInterval().then(interval => {
            watchInterval = interval;
            log(`监听间隔: ${watchInterval / 1000} 秒`, 'info');
            
            // 立即执行一次检查
            performWatchCheck();
            
            // 设置定时器
            watchTimer = setInterval(() => {
                performWatchCheck();
            }, watchInterval);
        });
    }
    
    // 停止监听
    function stopWatch() {
        watchEnabled = false;
        if (watchTimer) {
            clearInterval(watchTimer);
            watchTimer = null;
        }
    }
    
    // 获取监听间隔
    async function getWatchInterval() {
        try {
            const interval = await window.api.store.get('watchInterval');
            return (interval || 60) * 1000; // 转换为毫秒
        } catch {
            return 60000; // 默认60秒
        }
    }
    
    // 执行监听检查
    async function performWatchCheck() {
        if (!watchEnabled) return;
        
        const sheetsUrl = await window.api.store.get('sheetsUrl');
        if (!sheetsUrl) return;
        
        log('🔍 正在检查更新...', 'info');
        
        try {
            // 获取当前 SKU 列表
            const skuStrings = currentSKUs.map(s => s.sku);
            
            const result = await window.api.watchCheck(sheetsUrl, skuStrings);
            
            if (!result.success) {
                log('监听检查失败: ' + (result.error || '未知错误'), 'error');
                return;
            }
            
            const { new_skus, removed_skus, all_skus } = result;
            
            // 处理下架的SKU
            if (removed_skus && removed_skus.length > 0) {
                log(`检测到下架 SKU: ${removed_skus.length} 个，正在删除...`, 'warning');
            }
            
            // 扫描输出目录删除不在表格中的文件
            log('🔍 正在扫描输出目录，删除不在表格中的文件...', 'info');
            const deleteResult = await window.api.watchDelete(sheetsUrl);
            if (deleteResult.success) {
                log(`✅ 已删除 ${deleteResult.deleted} 个下架文件`, 'success');
                if (deleteResult.kept !== undefined) {
                    log(`📁 保留 ${deleteResult.kept} 个文件`, 'info');
                }
            }
            
            // 处理新增的SKU
            if (new_skus && new_skus.length > 0) {
                log(`⚠️ 检测到新增 SKU: ${new_skus.length} 个`, 'warning');
                pendingNewSKUs = new_skus;
                showNewSKUModal(new_skus);
            }
            
            if ((!new_skus || new_skus.length === 0) && (!removed_skus || removed_skus.length === 0)) {
                log('✅ 无更新', 'success');
            }
            
            // 更新当前SKU列表
            if (all_skus) {
                currentSKUs = all_skus.map(sku => ({ sku, product_name: '' }));
            }
            
        } catch (err) {
            log('监听检查出错: ' + err.message, 'error');
        }
    }
    
    // 显示新增SKU弹窗
    function showNewSKUModal(newSKUs) {
        const modal = document.getElementById('new-sku-modal');
        const list = document.getElementById('new-sku-list');
        
        // 清空并填充列表
        list.innerHTML = '';
        newSKUs.forEach(item => {
            const div = document.createElement('div');
            div.className = 'sku-confirm-item';
            div.textContent = item.sku || item;
            list.appendChild(div);
        });
        
        modal.classList.remove('hidden');
    }
    
    // 隐藏新增SKU弹窗
    function hideNewSKUModal() {
        const modal = document.getElementById('new-sku-modal');
        modal.classList.add('hidden');
        pendingNewSKUs = [];
    }
    
    // 处理新增SKU - 继续
    async function handleNewSKUContinue() {
        if (pendingNewSKUs.length === 0) {
            hideNewSKUModal();
            return;
        }
        
        hideNewSKUModal();
        log(`开始处理 ${pendingNewSKUs.length} 个新增 SKU...`, 'info');
        
        try {
            // 步骤1：扫描本地文件夹找产品图
            log('🔍 正在扫描本地产品图...', 'info');
            const scanResult = await window.api.scanLocalImages();
            
            let hasAnyImages = false;
            let processedCount = 0;
            
            if (scanResult.success && scanResult.images && scanResult.images.length > 0) {
                hasAnyImages = true;
                
                // 先尝试匹配产品图（_P后缀）
                const matchResult = await window.api.matchImages(pendingNewSKUs, scanResult.images);
                
                if (matchResult.success && matchResult.matched && matchResult.matched.length > 0) {
                    log(`✅ 找到 ${matchResult.matched.length} 个产品图，直接合成`, 'success');
                    
                    // 直接合成
                    const composeResult = await window.api.compose(matchResult.matched);
                    
                    if (composeResult.success) {
                        log(`✅ 合成完成: ${composeResult.composed} 个 SKU`, 'success');
                        processedCount = matchResult.matched.length;
                    }
                    
                    // 记录已处理的SKU
                    const processedSKUs = new Set(matchResult.matched.map(m => m.sku));
                    
                    // 处理未匹配的SKU（需要预处理）
                    const unprocessed = pendingNewSKUs.filter(s => !processedSKUs.has(s.sku || s));
                    
                    if (unprocessed.length > 0) {
                        log(`📦 还有 ${unprocessed.length} 个SKU需要预处理原图...`, 'info');
                        const unprocessedProcessed = await preprocessAndCompose(unprocessed);
                        processedCount += unprocessedProcessed;
                    }
                } else {
                    // 没有找到产品图，进行预处理
                    log('⚠️ 没有找到产品图，开始预处理原图...', 'warning');
                    processedCount = await preprocessAndCompose(pendingNewSKUs);
                }
            } else {
                // 没有本地图片，全部需要预处理
                log('⚠️ 没有本地图片，开始预处理原图...', 'warning');
                processedCount = await preprocessAndCompose(pendingNewSKUs);
            }
            
            // 只有完全没有处理成功时才弹窗
            if (processedCount === 0) {
                log('⚠️ 未能找到任何图片，请检查原图文件夹和 Google Drive', 'error');
                // 显示未找到的 SKU 列表
                const allNotFound = pendingNewSKUs.map(s => s.sku || s);
                showNewSKUModal(allNotFound.map(sku => ({ sku })));
                return;
            }
            
            log('🎉 新增 SKU 处理完成！', 'success');
            
        } catch (err) {
            log('❌ 处理新增 SKU 出错: ' + err.message, 'error');
        }
        
        pendingNewSKUs = [];
    }
    
    // 预处理并合成，返回处理数量
    async function preprocessAndCompose(skus) {
        let processedCount = 0;
        
        try {
            // 预处理（原图 → 产品图）
            log('📦 正在进行预处理（原图→产品图）...', 'info');
            const preprocessResult = await window.api.preprocess(skus);
            
            if (preprocessResult.success) {
                log(`✅ 预处理完成: 处理 ${preprocessResult.processed} 个`, 'success');
                
                if (preprocessResult.not_found && preprocessResult.not_found.length > 0) {
                    log(`⚠️ 本地未找到原图: ${preprocessResult.not_found.length} 个，尝试从 Google Drive 下载...`, 'warning');
                    
                    // 尝试从 Google Drive 下载
                    const driveResult = await window.api.driveSearchDownload(
                        preprocessResult.not_found,
                        null,  // 使用默认的预处理输入文件夹
                        null,  // 使用配置的文件夹 ID
                        true   // 递归搜索
                    );
                    
                    if (driveResult.success) {
                        if (driveResult.downloaded > 0) {
                            log(`✅ 从 Google Drive 下载了 ${driveResult.downloaded} 个图片`, 'success');
                        }
                        
                        // 显示 Google Drive 扫描结果
                        if (driveResult.total_scanned !== undefined) {
                            log(`📊 Google Drive 扫描了 ${driveResult.total_scanned} 个图片文件`, 'info');
                        }
                        
                        if (driveResult.not_found && driveResult.not_found.length > 0) {
                            log(`⚠️ Google Drive 中也未找到: ${driveResult.not_found.length} 个`, 'warning');
                            
                            // 弹窗提醒
                            if (driveResult.downloaded === 0) {
                                showNewSKUModal(driveResult.not_found.map(sku => ({ sku })));
                            }
                        }
                        
                        // 如果有下载成功，再次尝试预处理
                        if (driveResult.downloaded > 0) {
                            // 重新扫描
                            const scanResult = await window.api.scanLocalImages();
                            if (scanResult.success && scanResult.images) {
                                const matchResult = await window.api.matchImages(skus, scanResult.images);
                                if (matchResult.success && matchResult.matched) {
                                    processedCount += matchResult.matched.length;
                                }
                            }
                        }
                    } else {
                        log('❌ Google Drive 下载失败: ' + (driveResult.error || '未知错误'), 'error');
                        // API 调用失败也弹窗
                        showNewSKUModal(preprocessResult.not_found.map(sku => ({ sku })));
                    }
                }
                
                if (preprocessResult.processed > 0) {
                    processedCount = preprocessResult.processed;
                    
                    // 重新扫描找产品图
                    log('🔍 正在扫描生成的产品图...', 'info');
                    const scanResult = await window.api.scanLocalImages();
                    
                    if (scanResult.success && scanResult.images) {
                        // 匹配产品图
                        const matchResult = await window.api.matchImages(skus, scanResult.images);
                        
                        if (matchResult.success && matchResult.matched && matchResult.matched.length > 0) {
                            // 合成
                            const composeResult = await window.api.compose(matchResult.matched);
                            
                            if (composeResult.success) {
                                log(`✅ 合成完成: ${composeResult.composed} 个 SKU`, 'success');
                            }
                        }
                    }
                }
            } else {
                log('❌ 预处理失败: ' + (preprocessResult.error || '未知错误'), 'error');
            }
        } catch (err) {
            log('❌ 预处理出错: ' + err.message, 'error');
        }
        
        return processedCount;
    }

    function clearLog() {
        logContainer.innerHTML = '';
    }

    // 日志函数
    function log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        const time = new Date().toLocaleTimeString('zh-CN');
        entry.textContent = `[${time}] ${message}`;

        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function updateStatus(message) {
        statusMessage.textContent = message;
    }
});