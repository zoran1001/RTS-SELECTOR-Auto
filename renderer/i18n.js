// i18n.js - 国际化翻译系统

const translations = {
    // 中文语言包
    zh: {
        // 标题和版本
        app_title: 'Image Composer',
        version: 'v0.6.0',
        
        // 工具栏按钮
        btn_process_all: '一键处理',
        btn_scan_local: '扫描图片',
        btn_compose: '开始合成',
        btn_watch: '开始监听',
        btn_stop_watch: '停止监听',
        btn_settings: '设置',
        btn_refresh_token: '更新凭证',
        btn_preprocess: '预处理',
        
        // 功能区标签
        section_load_sheets: '一、加载表格',
        section_preprocess: '二、预处理',
        section_compose: '三、合成',
        section_watch: '四、监听',
        
        // 状态指示
        status_connected: '已连接',
        status_offline: '未连接',
        status_ready: '就绪',
        
        // Google Sheets 区域
        sheets_title: 'Google Sheets',
        btn_load_sheets: '加载表格',
        sheets_status_not_loaded: '未加载',
        sheets_status_loading: '读取中...',
        sheets_status_loaded: '已加载 {count} 条',
        sheets_status_failed: '加载失败',
        sheets_status_error: '出错',
        sheets_hint: '表格链接在设置中配置',
        
        // SKU 区域
        sku_title: 'SKU 列表（从表格识别）',
        sku_search_placeholder: '搜索 SKU...',
        sku_count: '共 {count} 个 SKU',
        btn_select_all: '全选',
        sku_image_status_unknown: '❓',
        sku_image_status_matched: '✅',
        sku_image_status_unmatched: '❌',
        
        // 本地图片区域
        local_image_title: '本地原始图片',
        local_image_status_not_scanned: '未扫描',
        local_image_status_scanning: '扫描中...',
        local_image_status_scanned: '已扫描',
        local_image_status_failed: '扫描失败',
        local_image_status_error: '出错',
        local_image_count: '共 {count} 张图片',
        
        // 匹配结果区域
        match_title: '匹配结果',
        match_status_not_matched: '未匹配',
        match_status_matching: '正在识别匹配...',
        match_count: '✅ 匹配成功: {matched} | ❌ 未匹配: {unmatched}',
        match_images_count: '{count} 张图片',
        
        // 日志区域
        log_title: '运行日志',
        btn_clear_log: '清空',
        
        // 设置弹窗
        settings_title: '设置',
        settings_close: '×',
        settings_sheets_label: 'Google Sheets 链接:',
        settings_sheets_placeholder: 'https://docs.google.com/spreadsheets/d/...',
        settings_api_key_label: 'Google API Key (可选):',
        settings_api_key_placeholder: 'AIzaSyBZslqAPF1s3cP1hmROZcNcP-TIEtwqgYs',
        settings_api_key_hint: '填写后将使用 API Key 访问 Google Sheets，无需 OAuth 凭证',
        settings_local_folder_label: '本地图片文件夹:'
        settings_local_folder_placeholder: 'C:\\Images\\products',
        settings_output_folder_label: '合成输出文件夹:',
        settings_output_folder_placeholder: 'C:\\Images\\output',
        settings_preprocess_input_label: '预处理输入文件夹:',
        settings_preprocess_input_placeholder: 'C:\\Images\\raw',
        settings_drive_folder_label: 'Google Drive 文件夹 ID:',
        settings_drive_folder_placeholder: '1ABC123xyz...',
        settings_drive_folder_hint: '从 Google Drive 文件夹 URL 中提取 ID',
        settings_sku_column_label: 'SKU 列名:',
        settings_status_column_label: '状态列名:',
        settings_active_status_label: '活跃状态值:',
        settings_compose_width_label: '合成宽度:',
        settings_compose_height_label: '合成高度:',
        settings_watermark_enabled_label: '启用水印功能',
        settings_watermark_path_label: '水印图路径:',
        settings_watermark_width_label: '水印宽度 (px):',
        settings_watch_enabled_label: '启用自动监听',
        settings_watch_interval_label: '监听间隔 (秒):',
        btn_save_settings: '保存配置',
        btn_cancel_settings: '取消',
        
        // 新增 SKU 弹窗
        new_sku_title: '检测到新增 SKU',
        new_sku_message: '检测到以下新增 SKU，请确认是否继续处理：',
        new_sku_hint: '点击"继续"将自动进行预处理和合成',
        btn_new_sku_continue: '继续处理',
        btn_new_sku_cancel: '稍后处理',
        
        // 语言选择弹窗
        language_title: '选择语言 / Select Language',
        language_hint: '可再右上角点击按钮进行切换语言\nYou can switch language by clicking the button in the top right corner',
        btn_language_zh: '中文',
        btn_language_en: 'English',
        
        // 语言切换按钮
        btn_language: '中/EN',
        
        // 提示消息
        alert_sheets_url_required: '请先在设置中配置 Google Sheets 链接',
        alert_match_required: '请先进行匹配对照',
        
        // 日志消息
        log_app_started: 'Image Composer v0.6.0 已启动',
        log_backend_connected: '后端服务已连接',
        log_backend_offline: '无法连接后端服务',
        log_credentials_valid: '凭证已验证有效，无需再次验证',
        log_credentials_invalid: '凭证未验证或已过期，请检查设置',
        log_sheets_loading: '开始读取 Google Sheets...',
        log_sheets_loaded: '✅ Sheets 加载完成: {total} 行, 识别到 {filtered} 个 SKU',
        log_sheets_failed: '❌ Sheets 加载失败: {error}',
        log_sheets_error: '❌ Sheets 出错: {error}',
        log_sheets_auto_loading: '检测到保存的表格链接，正在自动加载...',
        log_local_scanning: '开始扫描本地图片文件夹...',
        log_local_scanned: '✅ 本地图片扫描完成: 找到 {count} 张图片',
        log_local_failed: '❌ 扫描失败: {error}',
        log_local_error: '❌ 扫描出错: {error}',
        log_auto_matching: '自动识别图片匹配状态...',
        log_match_done: '识别完成: 匹配成功 {matched}, 未匹配 {unmatched}',
        log_match_failed: '识别失败: {error}',
        log_match_error: '识别出错: {error}',
        log_compose_start: '开始合成 {count} 个 SKU 的图片...',
        log_compose_done: '合成完成: 成功 {count} 张',
        log_compose_output: '输出目录: {folder}',
        log_compose_failed: '合成失败: {error}',
        log_compose_error: '合成出错: {error}',
        log_compose_errors: '有 {count} 个错误',
        log_process_all_start: '=== 开始一键处理 ===',
        log_process_all_done: '一键处理完成！',
        log_process_all_sheets: '表格识别: {count} 个 SKU',
        log_process_all_images: '本地图片: {count} 张',
        log_process_all_matched: '匹配成功: {count} 个',
        log_process_all_unmatched: '未匹配: {count} 个',
        log_process_all_composed: '合成完成: {count} 张',
        log_process_all_failed: '一键处理失败: {error}',
        log_process_all_error: '一键处理出错: {error}',
        log_config_loading: '正在保存配置...',
        log_config_saved: '✅ 配置已保存到本地！',
        log_config_failed: '❌ 保存配置失败: {error}',
        log_config_load_failed: '加载配置失败: {error}',
        log_watch_started: '监听已开始，每分钟检查一次',
        log_watch_stopped: '监听已停止',
        log_watch_interval: '监听间隔: {interval} 秒',
        log_watch_checking: '🔍 正在检查更新...',
        log_watch_failed: '监听检查失败: {error}',
        log_watch_error: '监听检查出错: {error}',
        log_watch_removed: '检测到下架 SKU: {count} 个，正在删除...',
        log_watch_deleting: '🔍 正在扫描输出目录，删除不在表格中的文件...',
        log_watch_deleted: '✅ 已删除 {count} 个下架文件',
        log_watch_kept: '📁 保留 {count} 个文件',
        log_watch_new: '⚠️ 检测到新增 SKU: {count} 个',
        log_watch_no_update: '✅ 无更新',
        log_new_sku_start: '开始处理 {count} 个新增 SKU...',
        log_new_sku_scanning: '🔍 正在扫描本地产品图...',
        log_new_sku_found: '✅ 找到 {count} 个产品图，直接合成',
        log_new_sku_composed: '✅ 合成完成: {count} 个 SKU',
        log_new_sku_preprocess_needed: '📦 还有 {count} 个SKU需要预处理原图...',
        log_new_sku_no_product: '⚠️ 没有找到产品图，开始预处理原图...',
        log_new_sku_no_local: '⚠️ 没有本地图片，开始预处理原图...',
        log_new_sku_not_found: '⚠️ 未能找到任何图片，请检查原图文件夹和 Google Drive',
        log_new_sku_done: '🎉 新增 SKU 处理完成！',
        log_new_sku_error: '❌ 处理新增 SKU 出错: {error}',
        log_preprocess_start: '📦 正在进行预处理（原图→产品图）...',
        log_preprocess_done: '✅ 预处理完成: 处理 {count} 个',
        log_preprocess_not_found: '⚠️ 本地未找到原图: {count} 个，尝试从 Google Drive 下载...',
        log_drive_downloaded: '✅ 从 Google Drive 下载了 {count} 个图片',
        log_drive_scanned: '📊 Google Drive 扫描了 {count} 个图片文件',
        log_drive_not_found: '⚠️ Google Drive 中也未找到: {count} 个',
        log_drive_failed: '❌ Google Drive 下载失败: {error}',
        log_product_scanning: '🔍 正在扫描生成的产品图...',
        log_preprocess_failed: '❌ 预处理失败: {error}',
        log_preprocess_error: '❌ 预处理出错: {error}',
        log_flow_info: '新版本流程：匹配后自动合成所有',
        log_refresh_token_start: '正在更新凭证...',
        log_refresh_token_success: '✅ 凭证更新成功！',
        log_refresh_token_failed: '❌ 凭证更新失败: {error}',
        log_refresh_token_error: '❌ 凭证更新出错: {error}',
        
        // 状态消息
        status_loading_sheets: '正在读取表格...',
        status_refreshing_token: '正在更新凭证...',
        status_token_refreshed: '凭证已更新',
        status_refresh_failed: '凭证更新失败',
        status_preprocessing: '正在预处理...',
        status_preprocess_done: '预处理完成',
        status_preprocess_failed: '预处理失败',
        
        // 提示消息
        alert_no_skus: '请先加载表格获取 SKU 列表',
        status_sheets_loaded: '已识别 {count} 个 SKU',
        status_sheets_failed: '加载失败',
        status_sheets_error: '出错',
        status_scanning: '正在扫描本地图片...',
        status_scanned: '找到 {count} 张图片',
        status_scan_failed: '扫描失败',
        status_scan_error: '出错',
        status_matching: '正在识别匹配...',
        status_matched: '匹配成功 {count} 个',
        status_composing: '正在合成图片...',
        status_composed: '合成完成',
        status_compose_failed: '合成失败',
        status_compose_error: '合成出错',
        status_processing: '正在一键处理...',
        status_processed: '处理完成: 合成 {count} 张图片',
        status_process_failed: '处理失败',
        status_process_error: '处理出错',
        
        // 其他
        watermark_path_default: 'E:\\DESTOP\\se\\image-composer-electron\\watermark.png'
    },
    
    // 英文语言包
    en: {
        // 标题和版本
        app_title: 'Image Composer',
        version: 'v0.6.0',
        
        // 工具栏按钮
        btn_process_all: 'Process All',
        btn_scan_local: 'Scan Images',
        btn_compose: 'Start Compose',
        btn_watch: 'Start Watch',
        btn_stop_watch: 'Stop Watch',
        btn_settings: 'Settings',
        btn_refresh_token: 'Refresh Token',
        btn_preprocess: 'Preprocess',
        
        // 功能区标签
        section_load_sheets: '1. Load Sheets',
        section_preprocess: '2. Preprocess',
        section_compose: '3. Compose',
        section_watch: '4. Watch',
        
        // 状态指示
        status_connected: 'Connected',
        status_offline: 'Offline',
        status_ready: 'Ready',
        
        // Google Sheets 区域
        sheets_title: 'Google Sheets',
        btn_load_sheets: 'Load Sheets',
        sheets_status_not_loaded: 'Not Loaded',
        sheets_status_loading: 'Loading...',
        sheets_status_loaded: 'Loaded {count} items',
        sheets_status_failed: 'Load Failed',
        sheets_status_error: 'Error',
        sheets_hint: 'Configure sheet link in Settings',
        
        // SKU 区域
        sku_title: 'SKU List (from Sheets)',
        sku_search_placeholder: 'Search SKU...',
        sku_count: 'Total {count} SKUs',
        btn_select_all: 'Select All',
        sku_image_status_unknown: '❓',
        sku_image_status_matched: '✅',
        sku_image_status_unmatched: '❌',
        
        // 本地图片区域
        local_image_title: 'Local Raw Images',
        local_image_status_not_scanned: 'Not Scanned',
        local_image_status_scanning: 'Scanning...',
        local_image_status_scanned: 'Scanned',
        local_image_status_failed: 'Scan Failed',
        local_image_status_error: 'Error',
        local_image_count: 'Total {count} images',
        
        // 匹配结果区域
        match_title: 'Match Results',
        match_status_not_matched: 'Not Matched',
        match_status_matching: 'Matching...',
        match_count: '✅ Matched: {matched} | ❌ Unmatched: {unmatched}',
        match_images_count: '{count} images',
        
        // 日志区域
        log_title: 'Logs',
        btn_clear_log: 'Clear',
        
        // 设置弹窗
        settings_title: 'Settings',
        settings_close: '×',
        settings_sheets_label: 'Google Sheets URL:',
        settings_sheets_placeholder: 'https://docs.google.com/spreadsheets/d/...',
        settings_api_key_label: 'Google API Key (Optional):',
        settings_api_key_placeholder: 'AIzaSyBZslqAPF1s3cP1hmROZcNcP-TIEtwqgYs',
        settings_api_key_hint: 'Use API Key to access Google Sheets without OAuth credentials',
        settings_local_folder_label: 'Local Image Folder:',
        settings_local_folder_placeholder: 'C:\\Images\\products',
        settings_output_folder_label: 'Output Folder:',
        settings_output_folder_placeholder: 'C:\\Images\\output',
        settings_preprocess_input_label: 'Preprocess Input Folder:',
        settings_preprocess_input_placeholder: 'C:\\Images\\raw',
        settings_drive_folder_label: 'Google Drive Folder ID:',
        settings_drive_folder_placeholder: '1ABC123xyz...',
        settings_drive_folder_hint: 'Extract ID from Google Drive folder URL',
        settings_sku_column_label: 'SKU Column:',
        settings_status_column_label: 'Status Column:',
        settings_active_status_label: 'Active Status Value:',
        settings_compose_width_label: 'Compose Width:',
        settings_compose_height_label: 'Compose Height:',
        settings_watermark_enabled_label: 'Enable Watermark',
        settings_watermark_path_label: 'Watermark Path:',
        settings_watermark_width_label: 'Watermark Width (px):',
        settings_watch_enabled_label: 'Enable Auto Watch',
        settings_watch_interval_label: 'Watch Interval (sec):',
        btn_save_settings: 'Save',
        btn_cancel_settings: 'Cancel',
        
        // 新增 SKU 弹窗
        new_sku_title: 'New SKUs Detected',
        new_sku_message: 'Detected new SKUs, please confirm to continue:',
        new_sku_hint: 'Click "Continue" to auto preprocess and compose',
        btn_new_sku_continue: 'Continue',
        btn_new_sku_cancel: 'Later',
        
        // 语言选择弹窗
        language_title: '选择语言 / Select Language',
        language_hint: '可再右上角点击按钮进行切换语言\nYou can switch language by clicking the button in the top right corner',
        btn_language_zh: '中文',
        btn_language_en: 'English',
        
        // 语言切换按钮
        btn_language: '中/EN',
        
        // 提示消息
        alert_sheets_url_required: 'Please configure Google Sheets URL in Settings first',
        alert_match_required: 'Please match images first',
        
        // 日志消息
        log_app_started: 'Image Composer v0.6.0 started',
        log_backend_connected: 'Backend service connected',
        log_backend_offline: 'Cannot connect to backend service',
        log_credentials_valid: 'Credentials verified, no need to re-verify',
        log_credentials_invalid: 'Credentials not verified or expired, please check settings',
        log_sheets_loading: 'Loading Google Sheets...',
        log_sheets_loaded: '✅ Sheets loaded: {total} rows, {filtered} SKUs identified',
        log_sheets_failed: '❌ Sheets load failed: {error}',
        log_sheets_error: '❌ Sheets error: {error}',
        log_sheets_auto_loading: 'Saved sheet link detected, auto loading...',
        log_local_scanning: 'Scanning local image folder...',
        log_local_scanned: '✅ Local images scanned: {count} images found',
        log_local_failed: '❌ Scan failed: {error}',
        log_local_error: '❌ Scan error: {error}',
        log_auto_matching: 'Auto matching images...',
        log_match_done: 'Matching done: {matched} matched, {unmatched} unmatched',
        log_match_failed: 'Matching failed: {error}',
        log_match_error: 'Matching error: {error}',
        log_compose_start: 'Composing {count} SKU images...',
        log_compose_done: 'Compose done: {count} images',
        log_compose_output: 'Output folder: {folder}',
        log_compose_failed: 'Compose failed: {error}',
        log_compose_error: 'Compose error: {error}',
        log_compose_errors: '{count} errors',
        log_process_all_start: '=== Starting Process All ===',
        log_process_all_done: 'Process all completed!',
        log_process_all_sheets: 'Sheets identified: {count} SKUs',
        log_process_all_images: 'Local images: {count}',
        log_process_all_matched: 'Matched: {count}',
        log_process_all_unmatched: 'Unmatched: {count}',
        log_process_all_composed: 'Composed: {count}',
        log_process_all_failed: 'Process all failed: {error}',
        log_process_all_error: 'Process all error: {error}',
        log_config_loading: 'Saving config...',
        log_config_saved: '✅ Config saved locally!',
        log_config_failed: '❌ Save config failed: {error}',
        log_config_load_failed: 'Load config failed: {error}',
        log_watch_started: 'Watch started, checking every minute',
        log_watch_stopped: 'Watch stopped',
        log_watch_interval: 'Watch interval: {interval} sec',
        log_watch_checking: '🔍 Checking for updates...',
        log_watch_failed: 'Watch check failed: {error}',
        log_watch_error: 'Watch check error: {error}',
        log_watch_removed: 'Removed SKUs detected: {count}, deleting...',
        log_watch_deleting: '🔍 Scanning output folder, deleting inactive files...',
        log_watch_deleted: '✅ Deleted {count} inactive files',
        log_watch_kept: '📁 Kept {count} files',
        log_watch_new: '⚠️ New SKUs detected: {count}',
        log_watch_no_update: '✅ No updates',
        log_new_sku_start: 'Processing {count} new SKUs...',
        log_new_sku_scanning: '🔍 Scanning local product images...',
        log_new_sku_found: '✅ Found {count} product images, composing directly',
        log_new_sku_composed: '✅ Compose done: {count} SKUs',
        log_new_sku_preprocess_needed: '📦 {count} SKUs need preprocess raw images...',
        log_new_sku_no_product: '⚠️ No product images found, preprocessing raw images...',
        log_new_sku_no_local: '⚠️ No local images, preprocessing raw images...',
        log_new_sku_not_found: '⚠️ No images found, please check raw folder and Google Drive',
        log_new_sku_done: '🎉 New SKU processing completed!',
        log_new_sku_error: '❌ New SKU processing error: {error}',
        log_preprocess_start: '📦 Preprocessing (raw→product)...',
        log_preprocess_done: '✅ Preprocess done: {count} processed',
        log_preprocess_not_found: '⚠️ Raw images not found locally: {count}, trying Google Drive...',
        log_drive_downloaded: '✅ Downloaded {count} images from Google Drive',
        log_drive_scanned: '📊 Google Drive scanned {count} image files',
        log_drive_not_found: '⚠️ Not found in Google Drive: {count}',
        log_drive_failed: '❌ Google Drive download failed: {error}',
        log_product_scanning: '🔍 Scanning generated product images...',
        log_preprocess_failed: '❌ Preprocess failed: {error}',
        log_preprocess_error: '❌ Preprocess error: {error}',
        log_flow_info: 'New flow: auto compose after matching',
        log_refresh_token_start: 'Refreshing token...',
        log_refresh_token_success: '✅ Token refreshed successfully!',
        log_refresh_token_failed: '❌ Token refresh failed: {error}',
        log_refresh_token_error: '❌ Token refresh error: {error}',
        
        // 状态消息
        status_loading_sheets: 'Loading sheets...',
        status_refreshing_token: 'Refreshing token...',
        status_token_refreshed: 'Token refreshed',
        status_refresh_failed: 'Token refresh failed',
        status_preprocessing: 'Preprocessing...',
        status_preprocess_done: 'Preprocess done',
        status_preprocess_failed: 'Preprocess failed',
        
        // 提示消息
        alert_no_skus: 'Please load sheets first to get SKU list',
        status_sheets_loaded: '{count} SKUs identified',
        status_sheets_failed: 'Load failed',
        status_sheets_error: 'Error',
        status_scanning: 'Scanning local images...',
        status_scanned: '{count} images found',
        status_scan_failed: 'Scan failed',
        status_scan_error: 'Error',
        status_matching: 'Matching...',
        status_matched: '{count} matched',
        status_composing: 'Composing images...',
        status_composed: 'Compose done',
        status_compose_failed: 'Compose failed',
        status_compose_error: 'Compose error',
        status_processing: 'Processing...',
        status_processed: 'Done: {count} images composed',
        status_process_failed: 'Process failed',
        status_process_error: 'Process error',
        
        // 其他
        watermark_path_default: 'E:\\DESTOP\\se\\image-composer-electron\\watermark.png'
    }
};

// 翻译函数
function t(key, params = {}) {
    const lang = window.currentLanguage || 'zh';
    let text = translations[lang][key] || translations['zh'][key] || key;
    
    // 替换参数
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    
    return text;
}

// 设置语言
function setLanguage(lang) {
    window.currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    
    // 触发语言变更事件
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

// 获取当前语言
function getLanguage() {
    return window.currentLanguage || localStorage.getItem('appLanguage') || 'zh';
}

// 初始化语言
function initLanguage() {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang) {
        window.currentLanguage = savedLang;
    } else {
        window.currentLanguage = 'zh';
    }
}

// 导出
window.i18n = {
    t,
    setLanguage,
    getLanguage,
    initLanguage,
    translations
};