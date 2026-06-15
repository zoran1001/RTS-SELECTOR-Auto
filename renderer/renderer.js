// renderer.js - Image Composer Electron 前端逻辑 v0.6.0
// 新流程：加载表格 → 扫描本地图片 → 匹配 → 合成
// 支持中英文翻译

document.addEventListener('DOMContentLoaded', () => {
    // 初始化语言系统
    window.i18n.initLanguage();
    
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
    const languageModal = document.getElementById('language-modal');
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
    
    // 日志缓存 - 用于语言切换时重新翻译
    let logCache = [];

    // 初始化
    init();

    async function init() {
        // 应用翻译
        applyTranslations();
        
        // 绑定事件
        bindEvents();
        
        // 监听语言变更事件
        window.addEventListener('languageChanged', () => {
            applyTranslations();
        });
        
        // 检查是否需要显示语言选择弹窗
        const savedLang = localStorage.getItem('appLanguage');
        if (!savedLang) {
            showLanguageModal();
        } else {
            // 隐藏语言弹窗，开始初始化
            languageModal.classList.add('hidden');
            
            // 快速健康检查（异步）
            checkHealth();
            
            // 加载配置并自动启动（异步）
            loadConfig().then(() => {
                autoStartIfPossible();
            });
            
            log(window.i18n.t('log_app_started'), 'info', 'log_app_started');
            updateStatus(window.i18n.t('status_ready'));
        }
    }
    
    // 应用翻译到所有元素
    function applyTranslations() {
        // 翻译所有带有 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const paramsAttr = el.getAttribute('data-i18n-params');
            let params = {};
            if (paramsAttr) {
                try {
                    params = JSON.parse(paramsAttr);
                } catch (e) {}
            }
            el.textContent = window.i18n.t(key, params);
        });
        
        // 翻译所有带有 data-i18n-placeholder 属性的元素
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = window.i18n.t(key);
        });
        
        // 更新监听按钮状态
        const watchBtn = document.getElementById('btn-watch');
        if (watchEnabled) {
            watchBtn.textContent = window.i18n.t('btn_stop_watch');
        } else {
            watchBtn.textContent = window.i18n.t('btn_watch');
        }
        
        // 重新渲染日志
        rerenderLogs();
    }
    
    // 重新渲染日志（语言切换时调用）
    function rerenderLogs() {
        logContainer.innerHTML = '';
        
        logCache.forEach(entry => {
            const div = document.createElement('div');
            div.className = `log-entry log-${entry.type}`;
            
            const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
            let message = entry.message;
            
            // 如果有翻译 key，重新翻译
            if (entry.key) {
                try {
                    message = window.i18n.t(entry.key, entry.params || {});
                } catch (e) {
                    // 如果翻译失败，使用原始消息
                }
            }
            
            div.textContent = `[${time}] ${message}`;
            logContainer.appendChild(div);
        });
        
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // 显示语言选择弹窗
    function showLanguageModal() {
        languageModal.classList.remove('hidden');
    }
    
    // 隐藏语言选择弹窗
    function hideLanguageModal() {
        languageModal.classList.add('hidden');
        
        // 开始初始化
        checkHealth();
        loadConfig().then(() => {
            autoStartIfPossible();
        });
        
        log(window.i18n.t('log_app_started'), 'info', 'log_app_started');
        updateStatus(window.i18n.t('status_ready'));
    }
    
    // 切换语言
    function switchLanguage(lang) {
        window.i18n.setLanguage(lang);
        hideLanguageModal();
    }
    
    // 快速切换语言（右上角按钮）
    function quickSwitchLanguage() {
        const currentLang = window.i18n.getLanguage();
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        window.i18n.setLanguage(newLang);
        
        // 显示提示
        log(window.i18n.t('log_app_started'), 'info', 'log_app_started');
    }

    // 启动时自动加载（如果之前保存了配置）- 异步执行
    async function autoStartIfPossible() {
        try {
            const sheetsUrl = await window.api.store.get('sheetsUrl');
            
            if (sheetsUrl) {
                log(window.i18n.t('log_sheets_auto_loading'), 'info', 'log_sheets_auto_loading');
                
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
        document.getElementById('btn-refresh-token').addEventListener('click', () => refreshToken());
        document.getElementById('btn-scan-local').addEventListener('click', () => scanLocalImages());
        document.getElementById('btn-preprocess').addEventListener('click', () => runPreprocess());
        document.getElementById('btn-compose').addEventListener('click', () => composeImages());
        document.getElementById('btn-process-all').addEventListener('click', () => processAll());
        document.getElementById('btn-watch').addEventListener('click', () => toggleWatch());
        document.getElementById('btn-settings').addEventListener('click', () => showSettings());
        document.getElementById('btn-language').addEventListener('click', () => quickSwitchLanguage());

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

        // 语言选择弹窗
        document.getElementById('btn-lang-zh').addEventListener('click', () => switchLanguage('zh'));
        document.getElementById('btn-lang-en').addEventListener('click', () => switchLanguage('en'));

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
                statusIndicator.textContent = window.i18n.t('status_connected');
                log(window.i18n.t('log_backend_connected'), 'success', 'log_backend_connected');
                
                if (health.credentials_valid) {
                    log(window.i18n.t('log_credentials_valid'), 'success', 'log_credentials_valid');
                } else {
                    log(window.i18n.t('log_credentials_invalid'), 'warning', 'log_credentials_invalid');
                }
            } else {
                statusIndicator.className = 'status-offline';
                statusIndicator.textContent = window.i18n.t('status_offline');
            }
        } catch (err) {
            statusIndicator.className = 'status-offline';
            statusIndicator.textContent = window.i18n.t('status_offline');
            log(window.i18n.t('log_backend_offline'), 'error', 'log_backend_offline');
        }
    }

    // 更新凭证（刷新 OAuth2 token）
    async function refreshToken() {
        log(window.i18n.t('log_refresh_token_start'), 'info', 'log_refresh_token_start');
        updateStatus(window.i18n.t('status_refreshing_token'));
        
        try {
            const result = await window.api.refreshToken();
            
            if (result.success) {
                log(window.i18n.t('log_refresh_token_success'), 'success', 'log_refresh_token_success');
                updateStatus(window.i18n.t('status_token_refreshed'));
                
                // 重新检查健康状态
                await checkHealth();
            } else {
                log(window.i18n.t('log_refresh_token_failed', { error: result.error || 'Unknown' }), 'error', 'log_refresh_token_failed', { error: result.error || 'Unknown' });
                updateStatus(window.i18n.t('status_refresh_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_refresh_token_error', { error: err.message }), 'error', 'log_refresh_token_error', { error: err.message });
            updateStatus(window.i18n.t('status_refresh_failed'));
        }
    }
    
    // 单独运行预处理
    async function runPreprocess() {
        if (currentSKUs.length === 0) {
            alert(window.i18n.t('alert_no_skus'));
            return;
        }
        
        log(window.i18n.t('log_preprocess_start'), 'info', 'log_preprocess_start');
        updateStatus(window.i18n.t('status_preprocessing'));
        
        try {
            const skus = currentSKUs.map(s => s.sku);
            const result = await window.api.preprocess(skus);
            
            if (result.success) {
                log(window.i18n.t('log_preprocess_done', { count: result.processed }), 'success', 'log_preprocess_done', { count: result.processed });
                
                if (result.not_found && result.not_found.length > 0) {
                    log(window.i18n.t('log_preprocess_not_found', { count: result.not_found.length }), 'warning', 'log_preprocess_not_found', { count: result.not_found.length });
                    
                    // 尝试从 Google Drive 下载
                    const driveResult = await window.api.driveSearchDownload(
                        result.not_found,
                        null,
                        null,
                        true
                    );
                    
                    if (driveResult.success) {
                        if (driveResult.downloaded > 0) {
                            log(window.i18n.t('log_drive_downloaded', { count: driveResult.downloaded }), 'success', 'log_drive_downloaded', { count: driveResult.downloaded });
                        }
                        
                        if (driveResult.total_scanned !== undefined) {
                            log(window.i18n.t('log_drive_scanned', { count: driveResult.total_scanned }), 'info', 'log_drive_scanned', { count: driveResult.total_scanned });
                        }
                        
                        if (driveResult.not_found && driveResult.not_found.length > 0) {
                            log(window.i18n.t('log_drive_not_found', { count: driveResult.not_found.length }), 'warning', 'log_drive_not_found', { count: driveResult.not_found.length });
                        }
                    }
                }
                
                updateStatus(window.i18n.t('status_preprocess_done'));
                
                // 重新扫描本地图片
                await scanLocalImages();
            } else {
                log(window.i18n.t('log_preprocess_failed', { error: result.error || 'Unknown' }), 'error', 'log_preprocess_failed', { error: result.error || 'Unknown' });
                updateStatus(window.i18n.t('status_preprocess_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_preprocess_error', { error: err.message }), 'error', 'log_preprocess_error', { error: err.message });
            updateStatus(window.i18n.t('status_preprocess_failed'));
        }
    }

    // 步骤1：加载 Google Sheets 数据（带 UI）
    async function loadSheets() {
        // 从设置中读取链接
        const url = await window.api.store.get('sheetsUrl');
        if (!url) {
            alert(window.i18n.t('alert_sheets_url_required'));
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

        log(window.i18n.t('log_sheets_loading'), 'info', 'log_sheets_loading');
        updateStatus(window.i18n.t('status_loading_sheets'));
        sheetsStatus.textContent = window.i18n.t('sheets_status_loading');
        sheetsStatus.className = 'sheets-status loading';

        try {
            const config = await window.api.getConfig();
            const apiKey = await window.api.store.get('apiKey');
            const result = await window.api.loadSheets({
                sheets_url: url,
                api_key: apiKey || '',
                sku_column: config.sku_column || 'SKU',
                product_name_column: config.product_name_column || 'title',
                status_column: config.status_column || 'Status',
                active_status: config.active_status || 'active',
                exclude_keywords: config.exclude_keywords || []
            });

            if (result.success && result.items) {
                currentSKUs = result.items;
                renderSKUList(result.items);
                sheetsStatus.textContent = window.i18n.t('sheets_status_loaded', { count: result.filtered });
                sheetsStatus.className = 'sheets-status success';
                log(window.i18n.t('log_sheets_loaded', { total: result.total_rows, filtered: result.filtered }), 'success', 'log_sheets_loaded', { total: result.total_rows, filtered: result.filtered });
                updateStatus(window.i18n.t('status_sheets_loaded', { count: result.filtered }));
            } else {
                log(window.i18n.t('log_sheets_failed', { error: result.error || 'Unknown' }), 'error', 'log_sheets_failed', { error: result.error || 'Unknown' });
                sheetsStatus.textContent = window.i18n.t('sheets_status_failed');
                sheetsStatus.className = 'sheets-status error';
                updateStatus(window.i18n.t('status_sheets_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_sheets_error', { error: err.message }), 'error', 'log_sheets_error', { error: err.message });
            sheetsStatus.textContent = window.i18n.t('sheets_status_error');
            sheetsStatus.className = 'sheets-status error';
            updateStatus(window.i18n.t('status_sheets_error'));
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
            statusSpan.textContent = window.i18n.t('sku_image_status_unknown');
            statusSpan.title = window.i18n.t('sku_image_status_unknown');
            statusSpan.style.color = '#ffa502';

            row.appendChild(skuLabel);
            row.appendChild(nameLabel);
            row.appendChild(statusSpan);
            skuList.appendChild(row);
        });

        skuCount.textContent = window.i18n.t('sku_count', { count: items.length });
    }

    // 步骤2：扫描本地图片文件夹（带 UI）
    async function scanLocalImages() {
        log(window.i18n.t('log_local_scanning'), 'info', 'log_local_scanning');
        updateStatus(window.i18n.t('status_scanning'));
        localImageStatus.textContent = window.i18n.t('local_image_status_scanning');

        try {
            const result = await window.api.scanLocalImages();
            
            if (result.success && result.images) {
                localImages = result.images;
                renderLocalImageList(result.images);
                localImageStatus.textContent = window.i18n.t('local_image_status_scanned');
                localImageStatus.className = 'status-success';
                log(window.i18n.t('log_local_scanned', { count: result.images.length }), 'success', 'log_local_scanned', { count: result.images.length });
                updateStatus(window.i18n.t('status_scanned', { count: result.images.length }));
                
                // 自动识别匹配：扫描完图片后自动更新 SKU 列表的匹配状态
                await autoMatchSKUs();
            } else {
                log(window.i18n.t('log_local_failed', { error: result.error || 'Unknown' }), 'error', 'log_local_failed', { error: result.error || 'Unknown' });
                localImageStatus.textContent = window.i18n.t('local_image_status_failed');
                updateStatus(window.i18n.t('status_scan_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_local_error', { error: err.message }), 'error', 'log_local_error', { error: err.message });
            localImageStatus.textContent = window.i18n.t('local_image_status_error');
            updateStatus(window.i18n.t('status_scan_error'));
        }
    }
    
    // 步骤2：扫描本地图片文件夹（内部调用）
    async function scanLocalImagesInternal() {
        try {
            const result = await window.api.scanLocalImages();
            
            if (result.success && result.images) {
                localImages = result.images;
                renderLocalImageList(result.images);
                localImageStatus.textContent = window.i18n.t('local_image_status_scanned');
                localImageStatus.className = 'status-success';
                log(window.i18n.t('log_local_scanned', { count: result.images.length }), 'success', 'log_local_scanned', { count: result.images.length });
                updateStatus(window.i18n.t('status_scanned', { count: result.images.length }));
                
                // 自动识别匹配
                await autoMatchSKUs();
            } else {
                log(window.i18n.t('log_local_failed', { error: result.error || 'Unknown' }), 'error', 'log_local_failed', { error: result.error || 'Unknown' });
                localImageStatus.textContent = window.i18n.t('local_image_status_failed');
                updateStatus(window.i18n.t('status_scan_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_local_error', { error: err.message }), 'error', 'log_local_error', { error: err.message });
            localImageStatus.textContent = window.i18n.t('local_image_status_error');
            updateStatus(window.i18n.t('status_scan_error'));
        }
    }

    // 自动识别 SKU 与图片的匹配
    async function autoMatchSKUs() {
        if (currentSKUs.length === 0 || localImages.length === 0) {
            return;
        }

        log(window.i18n.t('log_auto_matching'), 'info', 'log_auto_matching');
        updateStatus(window.i18n.t('status_matching'));

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
                log(window.i18n.t('log_match_done', { matched: stats.matched_count, unmatched: stats.unmatched_sku_count }), 'success', 'log_match_done', { matched: stats.matched_count, unmatched: stats.unmatched_sku_count });
                updateStatus(window.i18n.t('status_matched', { count: stats.matched_count }));
                
                // 更新匹配统计显示
                matchCount.textContent = window.i18n.t('match_count', { matched: stats.matched_count, unmatched: stats.unmatched_sku_count });
            } else {
                log(window.i18n.t('log_match_failed', { error: result.error || 'Unknown' }), 'error', 'log_match_failed', { error: result.error || 'Unknown' });
            }
        } catch (err) {
            log(window.i18n.t('log_match_error', { error: err.message }), 'error', 'log_match_error', { error: err.message });
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
                    statusSpan.textContent = window.i18n.t('sku_image_status_matched');
                    statusSpan.className = 'sku-image-status matched';
                } else {
                    statusSpan.textContent = window.i18n.t('sku_image_status_unmatched');
                    statusSpan.className = 'sku-image-status unmatched';
                }
            }
        });
        
        // 更新匹配统计
        const total = items.length;
        const matchedCount = matchedSKUs.size;
        const unmatchedCount = total - matchedCount;
        matchCount.textContent = window.i18n.t('match_count', { matched: matchedCount, unmatched: unmatchedCount });
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

        localImageCount.textContent = window.i18n.t('local_image_count', { count: images.length });
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
            countSpan.textContent = window.i18n.t('match_images_count', { count: item.images.length });
            
            const statusSpan = document.createElement('span');
            statusSpan.className = 'match-status-tag';
            statusSpan.textContent = window.i18n.t('sku_image_status_matched');
            
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
            statusSpan.textContent = window.i18n.t('sku_image_status_unmatched');
            
            row.appendChild(skuSpan);
            row.appendChild(statusSpan);
            matchResultList.appendChild(row);
        });

        matchCount.textContent = window.i18n.t('match_count', { matched: matched.length, unmatched: unmatched.length });
    }

    // 步骤4：合成图片
    async function composeImages() {
        if (matchedResults.length === 0) {
            alert(window.i18n.t('alert_match_required'));
            return;
        }

        log(window.i18n.t('log_compose_start', { count: matchedResults.length }), 'info', 'log_compose_start', { count: matchedResults.length });
        updateStatus(window.i18n.t('status_composing'));

        try {
            const result = await window.api.compose(matchedResults);
            
            if (result.success) {
                log(window.i18n.t('log_compose_done', { count: result.composed }), 'success', 'log_compose_done', { count: result.composed });
                log(window.i18n.t('log_compose_output', { folder: result.output_folder }), 'info', 'log_compose_output', { folder: result.output_folder });
                updateStatus(window.i18n.t('status_composed'));
                
                if (result.errors && result.errors.length > 0) {
                    log(window.i18n.t('log_compose_errors', { count: result.errors.length }), 'warning', 'log_compose_errors', { count: result.errors.length });
                    result.errors.forEach(err => log(err, 'error'));
                }
            } else {
                log(window.i18n.t('log_compose_failed', { error: result.error || 'Unknown' }), 'error', 'log_compose_failed', { error: result.error || 'Unknown' });
                updateStatus(window.i18n.t('status_compose_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_compose_error', { error: err.message }), 'error', 'log_compose_error', { error: err.message });
            updateStatus(window.i18n.t('status_compose_error'));
        }
    }

    // 一键处理（完整流程）
    async function processAll() {
        const url = await window.api.store.get('sheetsUrl');
        if (!url) {
            alert(window.i18n.t('alert_sheets_url_required'));
            showSettings();
            return;
        }

        log(window.i18n.t('log_process_all_start'), 'info', 'log_process_all_start');
        updateStatus(window.i18n.t('status_processing'));

        try {
            const result = await window.api.processAll(url);
            
            if (result.success) {
                const stats = result.stats;
                log(window.i18n.t('log_process_all_done'), 'success', 'log_process_all_done');
                log(window.i18n.t('log_process_all_sheets', { count: stats.skus_from_sheets }), 'info', 'log_process_all_sheets', { count: stats.skus_from_sheets });
                log(window.i18n.t('log_process_all_images', { count: stats.images_found }), 'info', 'log_process_all_images', { count: stats.images_found });
                log(window.i18n.t('log_process_all_matched', { count: stats.matched_skus }), 'info', 'log_process_all_matched', { count: stats.matched_skus });
                log(window.i18n.t('log_process_all_unmatched', { count: stats.unmatched_skus }), 'warning', 'log_process_all_unmatched', { count: stats.unmatched_skus });
                log(window.i18n.t('log_process_all_composed', { count: stats.composed }), 'success', 'log_process_all_composed', { count: stats.composed });
                log(window.i18n.t('log_compose_output', { folder: result.output_folder }), 'info', 'log_compose_output', { folder: result.output_folder });
                
                updateStatus(window.i18n.t('status_processed', { count: stats.composed }));
                
                // 更新界面显示
                if (result.matched) {
                    matchedResults = result.matched;
                    unmatchedSKUs = result.unmatched_skus || [];
                    renderMatchResult(result.matched, unmatchedSKUs);
                }
                
                if (result.errors && result.errors.length > 0) {
                    log(window.i18n.t('log_compose_errors', { count: result.errors.length }), 'warning', 'log_compose_errors', { count: result.errors.length });
                }
            } else {
                log(window.i18n.t('log_process_all_failed', { error: result.error || 'Unknown' }), 'error', 'log_process_all_failed', { error: result.error || 'Unknown' });
                updateStatus(window.i18n.t('status_process_failed'));
            }
        } catch (err) {
            log(window.i18n.t('log_process_all_error', { error: err.message }), 'error', 'log_process_all_error', { error: err.message });
            updateStatus(window.i18n.t('status_process_error'));
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
                document.getElementById('setting-api-key').value = localConfig.apiKey || '';
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
                document.getElementById('setting-watermark-path').value = watermarkConfig.path || window.i18n.t('watermark_path_default');
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
            log(window.i18n.t('log_config_load_failed', { error: err.message }), 'warning', 'log_config_load_failed', { error: err.message });
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
            apiKey: document.getElementById('setting-api-key').value.trim(),
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
                path: document.getElementById('setting-watermark-path').value.trim() || window.i18n.t('watermark_path_default'),
                width: parseInt(document.getElementById('setting-watermark-width').value) || 1080,
                position_y: 0
            },
            // 监听配置
            watchEnabled: document.getElementById('setting-watch-enabled').checked,
            watchInterval: parseInt(document.getElementById('setting-watch-interval').value) || 60
        };
        
        log(window.i18n.t('log_config_loading'), 'info', 'log_config_loading');
        
        try {
            // 保存到本地 store
            await window.api.store.setMultiple(config);
            log(window.i18n.t('log_config_saved'), 'success', 'log_config_saved');
            hideSettings();
        } catch (err) {
            log(window.i18n.t('log_config_failed', { error: err.message }), 'error', 'log_config_failed', { error: err.message });
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
        log(window.i18n.t('log_flow_info'), 'info', 'log_flow_info');
    }

    // ===== 监听功能 =====
    
    // 切换监听状态
    async function toggleWatch() {
        const btn = document.getElementById('btn-watch');
        
        if (watchEnabled) {
            // 停止监听
            stopWatch();
            btn.textContent = window.i18n.t('btn_watch');
            btn.classList.remove('active');
            btn.style.background = '';
            log(window.i18n.t('log_watch_stopped'), 'info', 'log_watch_stopped');
        } else {
            // 开始监听
            const sheetsUrl = await window.api.store.get('sheetsUrl');
            if (!sheetsUrl) {
                alert(window.i18n.t('alert_sheets_url_required'));
                showSettings();
                return;
            }
            
            startWatch();
            btn.textContent = window.i18n.t('btn_stop_watch');
            btn.classList.add('active');
            btn.style.background = '#e74c3c';
            log(window.i18n.t('log_watch_started'), 'success', 'log_watch_started');
        }
    }
    
    // 开始监听
    function startWatch() {
        watchEnabled = true;
        
        // 从配置获取监听间隔
        getWatchInterval().then(interval => {
            watchInterval = interval;
            log(window.i18n.t('log_watch_interval', { interval: watchInterval / 1000 }), 'info', 'log_watch_interval', { interval: watchInterval / 1000 });
            
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
        
        log(window.i18n.t('log_watch_checking'), 'info', 'log_watch_checking');
        
        try {
            // 获取当前 SKU 列表
            const skuStrings = currentSKUs.map(s => s.sku);
            
            const result = await window.api.watchCheck(sheetsUrl, skuStrings);
            
            if (!result.success) {
                log(window.i18n.t('log_watch_failed', { error: result.error || 'Unknown' }), 'error', 'log_watch_failed', { error: result.error || 'Unknown' });
                return;
            }
            
            const { new_skus, removed_skus, all_skus } = result;
            
            // 处理下架的SKU
            if (removed_skus && removed_skus.length > 0) {
                log(window.i18n.t('log_watch_removed', { count: removed_skus.length }), 'warning', 'log_watch_removed', { count: removed_skus.length });
            }
            
            // 扫描输出目录删除不在表格中的文件
            log(window.i18n.t('log_watch_deleting'), 'info', 'log_watch_deleting');
            const deleteResult = await window.api.watchDelete(sheetsUrl);
            if (deleteResult.success) {
                log(window.i18n.t('log_watch_deleted', { count: deleteResult.deleted }), 'success', 'log_watch_deleted', { count: deleteResult.deleted });
                if (deleteResult.kept !== undefined) {
                    log(window.i18n.t('log_watch_kept', { count: deleteResult.kept }), 'info', 'log_watch_kept', { count: deleteResult.kept });
                }
            }
            
            // 处理新增的SKU
            if (new_skus && new_skus.length > 0) {
                log(window.i18n.t('log_watch_new', { count: new_skus.length }), 'warning', 'log_watch_new', { count: new_skus.length });
                pendingNewSKUs = new_skus;
                showNewSKUModal(new_skus);
            }
            
            if ((!new_skus || new_skus.length === 0) && (!removed_skus || removed_skus.length === 0)) {
                log(window.i18n.t('log_watch_no_update'), 'success', 'log_watch_no_update');
            }
            
            // 更新当前SKU列表
            if (all_skus) {
                currentSKUs = all_skus.map(sku => ({ sku, product_name: '' }));
            }
            
        } catch (err) {
            log(window.i18n.t('log_watch_error', { error: err.message }), 'error', 'log_watch_error', { error: err.message });
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
        log(window.i18n.t('log_new_sku_start', { count: pendingNewSKUs.length }), 'info', 'log_new_sku_start', { count: pendingNewSKUs.length });
        
        try {
            // 步骤1：扫描本地文件夹找产品图
            log(window.i18n.t('log_new_sku_scanning'), 'info', 'log_new_sku_scanning');
            const scanResult = await window.api.scanLocalImages();
            
            let hasAnyImages = false;
            let processedCount = 0;
            
            if (scanResult.success && scanResult.images && scanResult.images.length > 0) {
                hasAnyImages = true;
                
                // 先尝试匹配产品图（_P后缀）
                const matchResult = await window.api.matchImages(pendingNewSKUs, scanResult.images);
                
                if (matchResult.success && matchResult.matched && matchResult.matched.length > 0) {
                    log(window.i18n.t('log_new_sku_found', { count: matchResult.matched.length }), 'success', 'log_new_sku_found', { count: matchResult.matched.length });
                    
                    // 直接合成
                    const composeResult = await window.api.compose(matchResult.matched);
                    
                    if (composeResult.success) {
                        log(window.i18n.t('log_new_sku_composed', { count: composeResult.composed }), 'success', 'log_new_sku_composed', { count: composeResult.composed });
                        processedCount = matchResult.matched.length;
                    }
                    
                    // 记录已处理的SKU
                    const processedSKUs = new Set(matchResult.matched.map(m => m.sku));
                    
                    // 处理未匹配的SKU（需要预处理）
                    const unprocessed = pendingNewSKUs.filter(s => !processedSKUs.has(s.sku || s));
                    
                    if (unprocessed.length > 0) {
                        log(window.i18n.t('log_new_sku_preprocess_needed', { count: unprocessed.length }), 'info', 'log_new_sku_preprocess_needed', { count: unprocessed.length });
                        const unprocessedProcessed = await preprocessAndCompose(unprocessed);
                        processedCount += unprocessedProcessed;
                    }
                } else {
                    // 没有找到产品图，进行预处理
                    log(window.i18n.t('log_new_sku_no_product'), 'warning', 'log_new_sku_no_product');
                    processedCount = await preprocessAndCompose(pendingNewSKUs);
                }
            } else {
                // 没有本地图片，全部需要预处理
                log(window.i18n.t('log_new_sku_no_local'), 'warning', 'log_new_sku_no_local');
                processedCount = await preprocessAndCompose(pendingNewSKUs);
            }
            
            // 只有完全没有处理成功时才弹窗
            if (processedCount === 0) {
                log(window.i18n.t('log_new_sku_not_found'), 'error', 'log_new_sku_not_found');
                // 显示未找到的 SKU 列表
                const allNotFound = pendingNewSKUs.map(s => s.sku || s);
                showNewSKUModal(allNotFound.map(sku => ({ sku })));
                return;
            }
            
            log(window.i18n.t('log_new_sku_done'), 'success', 'log_new_sku_done');
            
        } catch (err) {
            log(window.i18n.t('log_new_sku_error', { error: err.message }), 'error', 'log_new_sku_error', { error: err.message });
        }
        
        pendingNewSKUs = [];
    }
    
    // 预处理并合成，返回处理数量
    async function preprocessAndCompose(skus) {
        let processedCount = 0;
        
        try {
            // 预处理（原图 → 产品图）
            log(window.i18n.t('log_preprocess_start'), 'info', 'log_preprocess_start');
            const preprocessResult = await window.api.preprocess(skus);
            
            if (preprocessResult.success) {
                log(window.i18n.t('log_preprocess_done', { count: preprocessResult.processed }), 'success', 'log_preprocess_done', { count: preprocessResult.processed });
                
                if (preprocessResult.not_found && preprocessResult.not_found.length > 0) {
                    log(window.i18n.t('log_preprocess_not_found', { count: preprocessResult.not_found.length }), 'warning', 'log_preprocess_not_found', { count: preprocessResult.not_found.length });
                    
                    // 尝试从 Google Drive 下载
                    const driveResult = await window.api.driveSearchDownload(
                        preprocessResult.not_found,
                        null,  // 使用默认的预处理输入文件夹
                        null,  // 使用配置的文件夹 ID
                        true   // 递归搜索
                    );
                    
                    if (driveResult.success) {
                        if (driveResult.downloaded > 0) {
                            log(window.i18n.t('log_drive_downloaded', { count: driveResult.downloaded }), 'success', 'log_drive_downloaded', { count: driveResult.downloaded });
                        }
                        
                        // 显示 Google Drive 扫描结果
                        if (driveResult.total_scanned !== undefined) {
                            log(window.i18n.t('log_drive_scanned', { count: driveResult.total_scanned }), 'info', 'log_drive_scanned', { count: driveResult.total_scanned });
                        }
                        
                        if (driveResult.not_found && driveResult.not_found.length > 0) {
                            log(window.i18n.t('log_drive_not_found', { count: driveResult.not_found.length }), 'warning', 'log_drive_not_found', { count: driveResult.not_found.length });
                            
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
                        log(window.i18n.t('log_drive_failed', { error: driveResult.error || 'Unknown' }), 'error', 'log_drive_failed', { error: driveResult.error || 'Unknown' });
                        // API 调用失败也弹窗
                        showNewSKUModal(preprocessResult.not_found.map(sku => ({ sku })));
                    }
                }
                
                if (preprocessResult.processed > 0) {
                    processedCount = preprocessResult.processed;
                    
                    // 重新扫描找产品图
                    log(window.i18n.t('log_product_scanning'), 'info', 'log_product_scanning');
                    const scanResult = await window.api.scanLocalImages();
                    
                    if (scanResult.success && scanResult.images) {
                        // 匹配产品图
                        const matchResult = await window.api.matchImages(skus, scanResult.images);
                        
                        if (matchResult.success && matchResult.matched && matchResult.matched.length > 0) {
                            // 合成
                            const composeResult = await window.api.compose(matchResult.matched);
                            
                            if (composeResult.success) {
                                log(window.i18n.t('log_new_sku_composed', { count: composeResult.composed }), 'success', 'log_new_sku_composed', { count: composeResult.composed });
                            }
                        }
                    }
                }
            } else {
                log(window.i18n.t('log_preprocess_failed', { error: preprocessResult.error || 'Unknown' }), 'error', 'log_preprocess_failed', { error: preprocessResult.error || 'Unknown' });
            }
        } catch (err) {
            log(window.i18n.t('log_preprocess_error', { error: err.message }), 'error', 'log_preprocess_error', { error: err.message });
        }
        
        return processedCount;
    }

    function clearLog() {
        logContainer.innerHTML = '';
        logCache = [];
    }

    // 日志函数（带翻译支持）
    function log(message, type = 'info', key = null, params = {}) {
        // 保存到缓存（用于语言切换时重新翻译）
        logCache.push({
            timestamp: Date.now(),
            message: message,
            type: type,
            key: key,
            params: params
        });
        
        // 限制缓存大小，避免内存问题
        if (logCache.length > 1000) {
            logCache = logCache.slice(-500);
        }

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