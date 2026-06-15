#!/usr/bin/env python3
"""
bridge.py - Image Composer Electron Python 后端桥接 v0.6.0

提供 HTTP API 供 Electron 前端调用 Google Drive API 和图片合成功能

新流程：
1. 加载表格 → 识别需要的 SKU
2. 扫描本地原始图片文件夹
3. 图片与 SKU 自动匹配对照
4. 匹配成功则合成
"""

import os
import sys
import re
import io
import json
import time
import logging
import glob
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Google Drive API
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

# 图片处理
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL 未安装，图片合成功能不可用")

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    encoding='utf-8'
)
logger = logging.getLogger('ImageComposerBridge')

app = Flask(__name__)
CORS(app)

# 全局变量
DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

# 判断是否为 PyInstaller 打包模式
if getattr(sys, 'frozen', False):
    # PyInstaller 打包后，exe 所在目录的上级（项目根目录）
    _BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(sys.executable)))
else:
    # 开发模式，bridge.py 所在目录的上级
    _BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# 确保路径是绝对路径
_BASE_DIR = os.path.abspath(_BASE_DIR)

CREDENTIALS_FILE = os.path.join(_BASE_DIR, 'credentials', 'token.json')
CONFIG_FILE = os.path.join(_BASE_DIR, 'config.yaml')

logger.info(f"项目根目录: {_BASE_DIR}")
logger.info(f"配置文件: {CONFIG_FILE}")

# 内存缓存
drive_service = None
sheets_service = None
config_cache = {}
credentials_valid = False  # 凭证是否有效


def load_credentials():
    """
    加载 Google API 凭证
    凭证验证一次后会自动刷新，无需重复验证
    """
    global drive_service, sheets_service, credentials_valid

    # 如果凭证已经有效，直接返回
    if credentials_valid and drive_service and sheets_service:
        logger.info("使用缓存的凭证（已验证有效）")
        return True

    if not os.path.exists(CREDENTIALS_FILE):
        logger.error(f"凭证文件不存在: {CREDENTIALS_FILE}")
        return False

    try:
        creds = Credentials.from_authorized_user_file(CREDENTIALS_FILE, DRIVE_SCOPES + SHEETS_SCOPES)

        # 如果凭证过期但有刷新令牌，自动刷新
        if creds and creds.expired and creds.refresh_token:
            logger.info("凭证已过期，正在自动刷新...")
            creds.refresh(Request())
            # 保存刷新后的凭证
            with open(CREDENTIALS_FILE, 'w') as f:
                f.write(creds.to_json())
            logger.info("凭证已刷新并保存")

        if not creds or not creds.valid:
            logger.error("凭证无效或已过期")
            return False

        # 创建服务
        drive_service = build('drive', 'v3', credentials=creds)
        sheets_service = build('sheets', 'v4', credentials=creds)
        credentials_valid = True
        
        logger.info("Google API 已连接（Drive + Sheets）")
        return True

    except Exception as e:
        logger.error(f"加载凭证失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def load_config():
    """加载配置文件"""
    global config_cache

    logger.info(f"尝试加载配置文件: {CONFIG_FILE}")
    
    if not os.path.exists(CONFIG_FILE):
        logger.warning(f"配置文件不存在，将创建新文件")
        config_cache = {}
        return

    try:
        import yaml
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config_cache = yaml.safe_load(f) or {}
        
        # 确保水印配置有默认值
        if 'watermark' not in config_cache:
            config_cache['watermark'] = {}
        if 'enabled' not in config_cache['watermark']:
            config_cache['watermark']['enabled'] = False
        if 'width' not in config_cache['watermark']:
            config_cache['watermark']['width'] = 1080
        if 'position_y' not in config_cache['watermark']:
            config_cache['watermark']['position_y'] = 0
            
        logger.info(f"配置文件已加载")
    except Exception as e:
        logger.error(f"加载配置失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        config_cache = {}


def apply_watermark(image, watermark_path=None, watermark_width=1080, position_y=0):
    """
    应用水印到图片
    
    参数:
        image: PIL Image 对象
        watermark_path: 水印图片路径
        watermark_width: 水印宽度（高度等比缩放）
        position_y: 水印 Y 轴位置（默认 0，紧贴顶部）
    
    返回:
        带有水印的 PIL Image 对象
    """
    if not PIL_AVAILABLE or not watermark_path or not os.path.exists(watermark_path):
        return image
    
    try:
        # 打开水印图片
        with Image.open(watermark_path) as watermark:
            # 保持 RGBA 模式以支持透明通道
            watermark = watermark.convert('RGBA')
            
            # 计算缩放比例，保持宽高比
            orig_width, orig_height = watermark.size
            scale = watermark_width / orig_width
            new_height = int(orig_height * scale)
            
            # 调整水印大小
            watermark_resized = watermark.resize((watermark_width, new_height), Image.LANCZOS)
            
            # 确保主图也是 RGBA 模式
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # 创建输出图片（和原图一样大）
            output = Image.new('RGBA', image.size, (255, 255, 255, 0))
            
            # 计算水平居中的 X 坐标
            canvas_width, canvas_height = image.size
            x = (canvas_width - watermark_width) // 2
            
            # 将水印放置在顶部（y=position_y，默认0）
            y = position_y
            
            # 使用 alpha 通道混合
            output.paste(watermark_resized, (x, y), watermark_resized)
            
            # 将主图合成到输出图片
            if image.mode == 'RGBA':
                # 将主图放在水印下面
                combined = Image.alpha_composite(output, image)
            else:
                combined = image
            
            # 转换回原模式
            if image.mode == 'RGB':
                combined = combined.convert('RGB')
            
            return combined
            
    except Exception as e:
        logger.error(f"应用水印失败: {e}")
        return image


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'version': '0.6.0',
        'drive_connected': drive_service is not None,
        'sheets_connected': sheets_service is not None,
        'credentials_valid': credentials_valid,
        'pil_available': PIL_AVAILABLE
    })


@app.route('/api/config', methods=['GET'])
def get_config():
    """获取配置"""
    return jsonify(config_cache)


@app.route('/api/config', methods=['POST'])
def save_config():
    """保存配置"""
    try:
        config = request.json
        logger.info(f"保存配置: {config}")
        
        import yaml
        
        # 确保目录存在
        config_dir = os.path.dirname(CONFIG_FILE)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
            logger.info(f"创建配置目录: {config_dir}")
        
        # 保存配置
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
        
        # 验证保存是否成功
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved_content = f.read()
            logger.info(f"配置已保存，文件大小: {len(saved_content)} 字节")
        
        config_cache.update(config)
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"保存配置失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/drive/scan', methods=['POST'])
def scan_drive():
    """扫描 Google Drive 图片"""
    if not drive_service:
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google Drive'}), 401

    data = request.json
    sku = data.get('sku', '').strip()

    if not sku:
        return jsonify({'success': False, 'error': '缺少 SKU 参数'}), 400

    try:
        logger.info(f"开始扫描 SKU: {sku}")

        # 搜索包含 SKU 的文件
        query = f"name contains '{sku}' and mimeType contains 'image/' and trashed = false"
        results = drive_service.files().list(
            q=query,
            pageSize=50,
            fields="files(id, name, thumbnailLink, webContentLink, size)"
        ).execute()

        files = results.get('files', [])
        logger.info(f"找到 {len(files)} 个文件")

        return jsonify({
            'success': True,
            'files': files,
            'count': len(files)
        })

    except HttpError as e:
        logger.error(f"Google Drive API 错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"扫描失败: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/drive/download', methods=['POST'])
def download_images():
    """下载 Google Drive 图片"""
    if not drive_service:
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google Drive'}), 401

    data = request.json
    file_ids = data.get('file_ids', [])

    if not file_ids:
        return jsonify({'success': False, 'error': '缺少 file_ids 参数'}), 400

    output_dir = config_cache.get('localFolder', './downloads')
    os.makedirs(output_dir, exist_ok=True)

    downloaded = 0
    errors = []

    try:
        for file_id in file_ids:
            try:
                file_metadata = drive_service.files().get(fileId=file_id).execute()
                file_name = file_metadata['name']
                output_path = os.path.join(output_dir, file_name)

                request = drive_service.files().get_media(fileId=file_id)
                fh = io.FileIO(output_path, 'wb')
                downloader = MediaIoBaseDownload(fh, request)

                done = False
                while not done:
                    status, done = downloader.next_chunk()

                fh.close()
                downloaded += 1
                logger.info(f"下载成功: {file_name}")

            except Exception as e:
                error_msg = f"文件 {file_id} 下载失败: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        return jsonify({
            'success': True,
            'downloaded': downloaded,
            'total': len(file_ids),
            'errors': errors
        })

    except Exception as e:
        logger.error(f"下载过程出错: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/drive/search-download', methods=['POST'])
def search_and_download():
    """
    根据SKU列表搜索Google Drive图片并下载
    返回搜索和下载结果
    
    优化：支持指定根文件夹，递归搜索所有子文件夹
    """
    data = request.json or {}
    
    skus = data.get('skus', [])
    if not skus:
        return jsonify({'success': False, 'error': '缺少 SKU 列表'}), 400
    
    if not drive_service:
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google Drive'}), 401
    
    # 可以指定下载到的文件夹，默认为预处理输入文件夹
    output_dir = data.get('output_folder') or config_cache.get('preprocessInput', './downloads')
    os.makedirs(output_dir, exist_ok=True)
    
    # 获取配置的 Drive 文件夹 ID
    drive_folder_id = data.get('folder_id') or config_cache.get('driveFolderId', '')
    
    try:
        logger.info(f"开始从 Google Drive 搜索 {len(skus)} 个 SKU 的图片...")
        if drive_folder_id:
            logger.info(f"搜索范围: 文件夹 {drive_folder_id}")
        else:
            logger.warning("未指定 Google Drive 文件夹 ID，将搜索整个云端硬盘（可能很慢）")
        
        # 支持的图片格式
        image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
        
        not_found = []
        errors = []
        downloaded = 0
        found_skus = []  # 记录找到的 SKU
        
        # 预扫描所有图片文件
        all_image_files = []
        
        if drive_folder_id:
            logger.info("正在递归扫描文件夹...")
            
            def get_all_images(folder_id, depth=0):
                try:
                    files_in_folder = []
                    folders_in_folder = []
                    
                    # 获取该文件夹中的所有文件和子文件夹
                    page_token = None
                    while True:
                        query = f"'{folder_id}' in parents and trashed = false"
                        results = drive_service.files().list(
                            q=query,
                            pageSize=100,
                            fields="nextPageToken, files(id, name, mimeType, size)",
                            pageToken=page_token
                        ).execute()
                        
                        for f in results.get('files', []):
                            mime_type = f.get('mimeType', '')
                            if mime_type == 'application/vnd.google-apps.folder':
                                folders_in_folder.append(f)
                            elif any(mime_type == f"image/{ext}" for ext in image_extensions):
                                files_in_folder.append(f)
                        
                        page_token = results.get('nextPageToken')
                        if not page_token:
                            break
                    
                    all_image_files.extend(files_in_folder)
                    logger.info(f"[深度{depth}] 文件夹 {folder_id}: {len(files_in_folder)} 张图片, {len(folders_in_folder)} 个子文件夹")
                    
                    # 递归处理子文件夹
                    for folder in folders_in_folder:
                        get_all_images(folder['id'], depth + 1)
                        
                except Exception as e:
                    logger.error(f"扫描文件夹 {folder_id} 失败: {e}")
            
            # 开始递归扫描
            get_all_images(drive_folder_id)
            logger.info(f"递归扫描完成: 共找到 {len(all_image_files)} 个图片文件")
        else:
            # 没有指定文件夹，使用全文搜索（效率较低）
            mime_query = " or ".join([f"mimeType='image/{ext}'" for ext in image_extensions])
            query = f"({mime_query}) and trashed = false"
            
            page_token = None
            while True:
                results = drive_service.files().list(
                    q=query,
                    pageSize=100,
                    fields="nextPageToken, files(id, name, mimeType, size)",
                    pageToken=page_token
                ).execute()
                
                all_image_files.extend(results.get('files', []))
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            logger.info(f"全文搜索完成: 共找到 {len(all_image_files)} 个图片文件")
        
        # 打印扫描到的部分文件名，方便调试
        if all_image_files:
            sample_names = [f['name'] for f in all_image_files[:10]]
            logger.info(f"扫描到的部分文件名: {sample_names}")
        
        # 遍历 SKU 列表进行匹配和下载
        for sku_item in skus:
            sku = sku_item.get('sku', '') if isinstance(sku_item, dict) else str(sku_item)
            if not sku:
                continue
            
            try:
                found = None
                sku_lower = sku.lower()
                
                # 在预扫描的文件中查找
                for file in all_image_files:
                    file_name_lower = file['name'].lower()
                    # 精确匹配或包含匹配
                    if sku_lower == file_name_lower or sku_lower in file_name_lower:
                        found = file
                        break
                
                if not found:
                    not_found.append(sku)
                    continue
                
                # 下载文件
                file_id = found['id']
                file_name = found['name']
                
                # 重命名为 SKU
                ext = os.path.splitext(file_name)[1].lower()
                new_file_name = f"{sku}{ext}"
                output_path = os.path.join(output_dir, new_file_name)
                
                request = drive_service.files().get_media(fileId=file_id)
                fh = io.FileIO(output_path, 'wb')
                downloader = MediaIoBaseDownload(fh, request)
                
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                
                fh.close()
                downloaded += 1
                found_skus.append(sku)
                logger.info(f"已下载: {new_file_name}")
                
            except Exception as e:
                errors.append(f"SKU {sku} 处理失败: {e}")
                logger.error(f"SKU {sku} 处理失败: {e}")
        
        logger.info(f"Google Drive 搜索完成: 下载 {downloaded} 个, 未找到 {len(not_found)} 个")
        
        return jsonify({
            'success': True,
            'downloaded': downloaded,
            'not_found': not_found,
            'found_skus': found_skus,
            'total_scanned': len(all_image_files),
            'errors': errors,
            'output_folder': output_dir
        })
        
    except Exception as e:
        logger.error(f"Google Drive 搜索下载出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/drive/folders', methods=['GET'])
def list_drive_folders():
    """
    获取 Google Drive 根目录下的文件夹列表
    用于用户选择要搜索的文件夹
    """
    if not drive_service:
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google Drive'}), 401
    
    folder_id = request.args.get('folder_id', '')
    
    try:
        if folder_id:
            # 获取指定文件夹下的内容
            query = f"'{folder_id}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'"
        else:
            # 获取根目录下的文件夹
            query = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents"
        
        results = drive_service.files().list(
            q=query,
            pageSize=100,
            fields="files(id, name, mimeType)",
            orderBy="name"
        ).execute()
        
        folders = results.get('files', [])
        
        return jsonify({
            'success': True,
            'folders': folders
        })
        
    except Exception as e:
        logger.error(f"获取文件夹列表出错: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sheets/load', methods=['POST'])
def load_sheets():
    """读取 Google Sheets 数据并筛选"""
    data = request.json or {}
    
    sheets_url = data.get('sheets_url', '').strip()
    if not sheets_url:
        return jsonify({'success': False, 'error': '缺少 sheets_url 参数'}), 400
    
    # 从配置或请求中获取列名
    sku_col = data.get('sku_column', config_cache.get('sku_column', 'SKU')).strip()
    name_col = data.get('product_name_column', config_cache.get('product_name_column', 'title')).strip()
    status_col = data.get('status_column', config_cache.get('status_column', 'Status')).strip()
    active_status = data.get('active_status', config_cache.get('active_status', 'active')).strip().lower()
    exclude_kws = [kw.strip().lower() for kw in data.get('exclude_keywords', config_cache.get('exclude_keywords', []))]
    
    try:
        # 加载凭证（复用于 Sheets 和 Drive）
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google API，请先配置凭证'}), 401
        
        # 提取 spreadsheet ID
        spreadsheet_id = None
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'spreadsheet=([a-zA-Z0-9-_]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, sheets_url)
            if match:
                spreadsheet_id = match.group(1)
                break
        if not spreadsheet_id:
            if re.match(r'^[a-zA-Z0-9-_]+$', sheets_url):
                spreadsheet_id = sheets_url
            else:
                return jsonify({'success': False, 'error': f'无法解析 Spreadsheet ID: {sheets_url}'}), 400
        
        # 提取 gid（工作表 ID）
        gid = None
        gid_match = re.search(r'[?#]gid=(\d+)', sheets_url)
        if gid_match:
            gid = int(gid_match.group(1))
        
        # 确定工作表名称
        range_str = None
        if gid is not None:
            sheet_metadata = sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id,
                fields="sheets(properties(title,sheetId))"
            ).execute()
            sheets = sheet_metadata.get('sheets', [])
            sheet_name = None
            for sheet in sheets:
                props = sheet.get('properties', {})
                if props.get('sheetId') == gid:
                    sheet_name = props.get('title')
                    break
            if sheet_name is None:
                return jsonify({'success': False, 'error': f'找不到 gid={gid} 的工作表'}), 400
            range_str = sheet_name
        else:
            range_str = data.get('sheet_name', config_cache.get('sheet_name', 'Sheet1'))
        
        logger.info(f"读取 Google Sheets: {spreadsheet_id} / {range_str}")
        
        # 读取数据
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_str
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return jsonify({'success': True, 'items': [], 'total_rows': 0, 'filtered': 0})
        
        headers = [h.strip() for h in values[0]]
        
        # 查找列索引（不区分大小写）
        sku_idx = name_idx = status_idx = None
        for i, h in enumerate(headers):
            hl = h.lower()
            if hl == sku_col.lower():
                sku_idx = i
            if hl == name_col.lower():
                name_idx = i
            if hl == status_col.lower():
                status_idx = i
        
        if sku_idx is None or name_idx is None or status_idx is None:
            return jsonify({
                'success': False,
                'error': f'表格中找不到列: sku={sku_col}, name={name_col}, status={status_col}',
                'available_columns': headers
            }), 400
        
        # 筛选数据
        items = []
        for row in values[1:]:
            if len(row) <= max(sku_idx, name_idx, status_idx):
                continue
            sku = row[sku_idx].strip()
            product_name = row[name_idx].strip()
            status = row[status_idx].strip().lower()
            
            if status != active_status:
                continue
            
            # 排除关键词
            skip = False
            for kw in exclude_kws:
                if kw in sku.lower() or kw in product_name.lower():
                    skip = True
                    break
            if skip:
                continue
            
            items.append({
                'sku': sku,
                'product_name': product_name,
                'status': row[status_idx].strip(),
                'product_selector': f"{sku}_Selector"
            })
        
        logger.info(f"Sheets 筛选完成: {len(values)-1} 行, 匹配 {len(items)}")
        return jsonify({
            'success': True,
            'items': items,
            'total_rows': len(values) - 1,
            'filtered': len(items),
            'headers': headers
        })
        
    except Exception as e:
        logger.error(f"读取 Sheets 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/local/scan', methods=['POST'])
def scan_local_images():
    """
    扫描本地图片文件夹
    返回所有找到的图片文件及其文件名（用于后续匹配SKU）
    """
    data = request.json or {}
    
    # 获取扫描路径
    local_folder = data.get('folder', config_cache.get('localFolder', ''))
    if not local_folder:
        return jsonify({'success': False, 'error': '未配置本地图片文件夹'}), 400
    
    if not os.path.exists(local_folder):
        return jsonify({'success': False, 'error': f'文件夹不存在: {local_folder}'}), 400
    
    # 支持的图片格式
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
    
    try:
        images = []
        scanned_dirs = set()
        
        # 递归扫描
        for root, dirs, files in os.walk(local_folder):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in image_extensions:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, local_folder)
                    
                    # 获取文件大小
                    try:
                        size = os.path.getsize(file_path)
                    except:
                        size = 0
                    
                    images.append({
                        'filename': file,
                        'filename_no_ext': os.path.splitext(file)[0],
                        'path': file_path,
                        'relative_path': rel_path,
                        'size': size,
                        'extension': ext
                    })
        
        logger.info(f"扫描本地文件夹完成: {local_folder}, 找到 {len(images)} 张图片")
        return jsonify({
            'success': True,
            'folder': local_folder,
            'images': images,
            'count': len(images)
        })
        
    except Exception as e:
        logger.error(f"扫描本地文件夹失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/match', methods=['POST'])
def match_images_with_skus():
    """
    将本地图片与 SKU 进行匹配对照
    匹配规则：图片文件名包含 SKU 编号
    """
    data = request.json or {}
    
    skus = data.get('skus', [])
    images = data.get('images', [])
    
    if not skus:
        return jsonify({'success': False, 'error': '缺少 SKU 列表'}), 400
    
    if not images:
        return jsonify({'success': False, 'error': '缺少图片列表'}), 400
    
    try:
        # 构建匹配结果
        matched = []      # 匹配成功的
        unmatched_skus = []  # 未匹配到图片的 SKU
        unmatched_images = []  # 未匹配到 SKU 的图片
        
        # 为每个 SKU 查找匹配的图片
        matched_image_paths = set()
        
        for sku_item in skus:
            sku = sku_item.get('sku', '')
            sku_lower = sku.lower()
            
            # 查找匹配的图片
            found_images = []
            for img in images:
                filename_lower = img['filename_no_ext'].lower()
                
                # 匹配规则：文件名包含 SKU（精确匹配或包含）
                if sku_lower == filename_lower or sku_lower in filename_lower:
                    found_images.append(img)
                    matched_image_paths.add(img['path'])
            
            if found_images:
                matched.append({
                    'sku': sku,
                    'product_name': sku_item.get('product_name', ''),
                    'images': found_images,
                    'image_count': len(found_images)
                })
            else:
                unmatched_skus.append({
                    'sku': sku,
                    'product_name': sku_item.get('product_name', '')
                })
        
        # 找出未匹配到 SKU 的图片
        for img in images:
            if img['path'] not in matched_image_paths:
                unmatched_images.append(img)
        
        logger.info(f"匹配完成: 成功 {len(matched)}, 未匹配SKU {len(unmatched_skus)}, 未匹配图片 {len(unmatched_images)}")
        
        return jsonify({
            'success': True,
            'matched': matched,
            'unmatched_skus': unmatched_skus,
            'unmatched_images': unmatched_images,
            'stats': {
                'total_skus': len(skus),
                'total_images': len(images),
                'matched_count': len(matched),
                'unmatched_sku_count': len(unmatched_skus),
                'unmatched_image_count': len(unmatched_images)
            }
        })
        
    except Exception as e:
        logger.error(f"匹配失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/compose', methods=['POST'])
def compose_images():
    """
    合成选择器图片（原图/产品图 → 选择器）
    根据匹配结果，将图片合成并保存到输出目录
    
    输出两个版本：
    - {SKU}.png — 原始合成图（无水印）
    - {SKU}_UP.png — 带水印版本（后缀 _UP）
    """
    data = request.json or {}
    
    # 获取匹配数据
    matched_items = data.get('matched', [])
    
    if not matched_items:
        return jsonify({'success': False, 'error': '缺少匹配数据'}), 400
    
    output_dir = config_cache.get('outputFolder', './output')
    os.makedirs(output_dir, exist_ok=True)
    
    # 合成配置
    width = config_cache.get('composeWidth', 800)
    height = config_cache.get('composeHeight', 800)
    quality = config_cache.get('composeQuality', 95)
    format_type = config_cache.get('composeFormat', 'png')
    
    # 水印配置
    watermark_config = config_cache.get('watermark', {})
    watermark_enabled = watermark_config.get('enabled', False)
    watermark_path = watermark_config.get('path', os.path.join(_BASE_DIR, 'watermark.png'))
    watermark_width = watermark_config.get('width', 1080)
    watermark_position_y = watermark_config.get('position_y', 0)
    
    # 检查水印文件是否存在
    if watermark_enabled and not os.path.exists(watermark_path):
        logger.warning(f"水印文件不存在: {watermark_path}，将跳过水印")
        watermark_enabled = False
    
    composed = 0
    errors = []
    
    try:
        for item in matched_items:
            sku = item.get('sku', '')
            images = item.get('images', [])
            
            if not images:
                continue
            
            try:
                logger.info(f"合成 SKU: {sku}, 图片数量: {len(images)}")
                
                # 如果有 PIL，进行实际合成
                if PIL_AVAILABLE:
                    # 取第一张图片作为主图（产品图）
                    main_image_path = images[0]['path']
                    
                    # 打开图片
                    with Image.open(main_image_path) as img:
                        # 调整大小
                        img_resized = img.resize((width, height), Image.LANCZOS)
                        
                        # ===== 保存原始版本（无水印）=====
                        output_filename = f"{sku}.{format_type}"
                        output_path = os.path.join(output_dir, output_filename)
                        
                        if format_type.lower() == 'png':
                            img_resized.save(output_path, 'PNG')
                        else:
                            img_resized.save(output_path, 'JPEG', quality=quality)
                        
                        logger.info(f"已保存原始图: {output_path}")
                        
                        # ===== 保存水印版本 =====
                        if watermark_enabled:
                            # 应用水印
                            img_with_watermark = apply_watermark(
                                img_resized, 
                                watermark_path, 
                                watermark_width, 
                                watermark_position_y
                            )
                            
                            # 保存带水印版本（后缀 _UP）
                            output_filename_up = f"{sku}_UP.{format_type}"
                            output_path_up = os.path.join(output_dir, output_filename_up)
                            
                            if format_type.lower() == 'png':
                                img_with_watermark.save(output_path_up, 'PNG')
                            else:
                                img_with_watermark.save(output_path_up, 'JPEG', quality=quality)
                            
                            logger.info(f"已保存水印版: {output_path_up}")
                        
                        composed += 1
                else:
                    # 没有 PIL，只记录日志
                    logger.warning(f"PIL 未安装，跳过实际合成: {sku}")
                    composed += 1
                    
            except Exception as e:
                error_msg = f"SKU {sku} 合成失败: {e}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return jsonify({
            'success': True,
            'composed': composed,
            'total': len(matched_items),
            'watermark_enabled': watermark_enabled,
            'errors': errors,
            'output_folder': output_dir
        })
        
    except Exception as e:
        logger.error(f"合成过程出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/preprocess', methods=['POST'])
def preprocess_images():
    """
    预处理原图（原图 → 产品图）
    扫描预处理输入文件夹，提取对应SKU的原图进行处理，输出到输出文件夹
    """
    data = request.json or {}
    
    skus = data.get('skus', [])
    if not skus:
        return jsonify({'success': False, 'error': '缺少 SKU 列表'}), 400
    
    preprocess_input = config_cache.get('preprocessInput', '')
    if not preprocess_input:
        return jsonify({'success': False, 'error': '未配置预处理输入文件夹'}), 400
    
    output_dir = config_cache.get('outputFolder', './output')
    os.makedirs(output_dir, exist_ok=True)
    
    # 预处理配置
    preprocess_width = config_cache.get('preprocessWidth', 800)
    preprocess_height = config_cache.get('preprocessHeight', 800)
    format_type = config_cache.get('composeFormat', 'png')
    
    if not os.path.exists(preprocess_input):
        return jsonify({'success': False, 'error': f'预处理输入文件夹不存在: {preprocess_input}'}), 400
    
    try:
        # 扫描预处理输入文件夹
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
        raw_images = []
        
        for root, dirs, files in os.walk(preprocess_input):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in image_extensions:
                    raw_images.append({
                        'filename': file,
                        'filename_no_ext': os.path.splitext(file)[0],
                        'path': os.path.join(root, file)
                    })
        
        logger.info(f"扫描预处理文件夹完成，找到 {len(raw_images)} 张原图")
        
        # 匹配 SKU 和原图
        processed = 0
        skipped = 0
        not_found = []
        errors = []
        
        for sku_item in skus:
            sku = sku_item.get('sku', '')
            sku_lower = sku.lower()
            
            # 查找匹配的原图
            matched_image = None
            for img in raw_images:
                if sku_lower == img['filename_no_ext'].lower() or sku_lower in img['filename_no_ext'].lower():
                    matched_image = img
                    break
            
            if not matched_image:
                not_found.append(sku)
                continue
            
            try:
                if PIL_AVAILABLE:
                    with Image.open(matched_image['path']) as img:
                        # 调整大小
                        img_processed = img.resize((preprocess_width, preprocess_height), Image.LANCZOS)
                        
                        # 保存（直接使用SKU命名，无后缀）
                        output_filename = f"{sku}.{format_type}"
                        output_path = os.path.join(output_dir, output_filename)
                        
                        if format_type.lower() == 'png':
                            img_processed.save(output_path, 'PNG')
                        else:
                            img_processed.save(output_path, 'JPEG', quality=95)
                        
                        logger.info(f"预处理完成: {sku} -> {output_filename}")
                        processed += 1
                else:
                    logger.warning(f"PIL 未安装，跳过预处理: {sku}")
                    processed += 1
                    
            except Exception as e:
                errors.append(f"SKU {sku} 预处理失败: {e}")
                logger.error(f"SKU {sku} 预处理失败: {e}")
        
        return jsonify({
            'success': True,
            'processed': processed,
            'skipped': skipped,
            'not_found': not_found,
            'errors': errors,
            'output_folder': output_dir
        })
        
    except Exception as e:
        logger.error(f"预处理过程出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/watch/check', methods=['POST'])
def watch_check():
    """
    监听检查：检测新增SKU、下架SKU、产品图变化
    返回需要处理的变更列表
    """
    data = request.json or {}
    
    sheets_url = data.get('sheets_url', '').strip()
    if not sheets_url:
        return jsonify({'success': False, 'error': '缺少表格链接'}), 400
    
    current_skus = data.get('current_skus', [])  # 当前已知的SKU列表
    current_skus_set = set(current_skus)
    
    try:
        # 加载凭证
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google API'}), 401
        
        # 提取 spreadsheet ID
        spreadsheet_id = None
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'spreadsheet=([a-zA-Z0-9-_]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, sheets_url)
            if match:
                spreadsheet_id = match.group(1)
                break
        if not spreadsheet_id:
            if re.match(r'^[a-zA-Z0-9-_]+$', sheets_url):
                spreadsheet_id = sheets_url
        
        if not spreadsheet_id:
            return jsonify({'success': False, 'error': '无法解析 Spreadsheet ID'}), 400
        
        # 读取表格数据
        sheet_name = config_cache.get('sheetName', 'Sheet1')
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=sheet_name
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return jsonify({'success': True, 'new_skus': [], 'removed_skus': [], 'unchanged': []})
        
        headers = [h.strip() for h in values[0]]
        
        # 查找列索引
        sku_col = config_cache.get('sku_column', 'SKU')
        status_col = config_cache.get('status_column', 'Status')
        active_status = config_cache.get('active_status', 'active').lower()
        
        sku_idx = status_idx = None
        for i, h in enumerate(headers):
            if h.lower() == sku_col.lower():
                sku_idx = i
            if h.lower() == status_col.lower():
                status_idx = i
        
        if sku_idx is None:
            return jsonify({'success': False, 'error': f'找不到 SKU 列: {sku_col}'}), 400
        
        # 获取表格中的活跃 SKU
        table_skus = {}
        for row in values[1:]:
            if len(row) <= sku_idx:
                continue
            sku = row[sku_idx].strip()
            if not sku:
                continue
            
            status = ''
            if status_idx and len(row) > status_idx:
                status = row[status_idx].strip().lower()
            
            # 如果有状态列，只取活跃的
            if status_idx and status != active_status:
                continue
            
            table_skus[sku] = True
        
        # 计算新增和下架
        new_skus = []
        removed_skus = []
        
        for sku in table_skus:
            if sku not in current_skus_set:
                new_skus.append({'sku': sku})
        
        for sku in current_skus:
            if sku not in table_skus:
                removed_skus.append(sku)
        
        logger.info(f"监听检查完成: 新增 {len(new_skus)}, 下架 {len(removed_skus)}")
        
        return jsonify({
            'success': True,
            'new_skus': new_skus,
            'removed_skus': removed_skus,
            'all_skus': list(table_skus.keys())
        })
        
    except Exception as e:
        logger.error(f"监听检查出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/watch/delete', methods=['POST'])
def watch_delete():
    """
    删除下架SKU对应的选择器文件
    扫描输出目录，找到所有包含SKU的选择器文件
    删除表格中不存在的SKU对应的文件
    """
    data = request.json or {}
    
    sheets_url = data.get('sheets_url', '').strip()
    if not sheets_url:
        return jsonify({'success': False, 'error': '缺少表格链接'}), 400
    
    output_dir = config_cache.get('outputFolder', './output')
    if not os.path.exists(output_dir):
        return jsonify({'success': True, 'deleted': 0, 'kept': 0})
    
    format_type = config_cache.get('composeFormat', 'png')
    
    try:
        # 获取表格中的活跃SKU
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google API'}), 401
        
        # 提取 spreadsheet ID
        spreadsheet_id = None
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'spreadsheet=([a-zA-Z0-9-_]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, sheets_url)
            if match:
                spreadsheet_id = match.group(1)
                break
        if not spreadsheet_id:
            if re.match(r'^[a-zA-Z0-9-_]+$', sheets_url):
                spreadsheet_id = sheets_url
        
        if not spreadsheet_id:
            return jsonify({'success': False, 'error': '无法解析 Spreadsheet ID'}), 400
        
        # 读取表格数据
        sheet_name = config_cache.get('sheetName', 'Sheet1')
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=sheet_name
        ).execute()
        
        values = result.get('values', [])
        
        # 提取表格中的SKU
        table_skus = set()
        if values:
            headers = [h.strip() for h in values[0]]
            sku_col = config_cache.get('sku_column', 'SKU')
            status_col = config_cache.get('status_column', 'Status')
            active_status = config_cache.get('active_status', 'active').lower()
            
            sku_idx = status_idx = None
            for i, h in enumerate(headers):
                if h.lower() == sku_col.lower():
                    sku_idx = i
                if h.lower() == status_col.lower():
                    status_idx = i
            
            for row in values[1:]:
                if sku_idx is not None and len(row) > sku_idx:
                    sku = row[sku_idx].strip()
                    status = ''
                    if status_idx is not None and len(row) > status_idx:
                        status = row[status_idx].strip().lower()
                    
                    # 如果有状态列，只取活跃的
                    if status_idx is not None and status != active_status:
                        continue
                    
                    if sku:
                        table_skus.add(sku)
        
        # 扫描输出目录，找到所有选择器文件
        deleted = 0
        kept = 0
        errors = []
        
        # 选择器文件后缀（不含后缀的SKU）
        selector_suffixes = ['', '_UP']
        
        for filename in os.listdir(output_dir):
            # 检查是否是图片文件
            if not filename.endswith(f'.{format_type}'):
                continue
            
            # 提取SKU（去掉后缀）
            base_name = filename.replace(f'.{format_type}', '')
            sku_found = None
            
            for suffix in selector_suffixes:
                if base_name.endswith(suffix):
                    potential_sku = base_name[:-len(suffix)]
                    if potential_sku:
                        sku_found = potential_sku
                        break
            
            if not sku_found:
                continue
            
            # 检查SKU是否在表格中存在
            if sku_found not in table_skus:
                # SKU不在表格中，删除文件
                filepath = os.path.join(output_dir, filename)
                try:
                    os.remove(filepath)
                    logger.info(f"已删除下架文件: {filename}")
                    deleted += 1
                except Exception as e:
                    errors.append(f"删除 {filename} 失败: {e}")
            else:
                kept += 1
        
        logger.info(f"扫描删除完成: 删除 {deleted} 个文件, 保留 {kept} 个文件")
        
        return jsonify({
            'success': True,
            'deleted': deleted,
            'kept': kept,
            'errors': errors
        })
        
    except Exception as e:
        logger.error(f"删除下架文件出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/process-all', methods=['POST'])
def process_all():
    """
    一键处理：加载表格 → 扫描本地图片 → 匹配 → 合成
    这是完整流程的自动化接口
    """
    data = request.json or {}
    
    sheets_url = data.get('sheets_url', '').strip()
    if not sheets_url:
        return jsonify({'success': False, 'error': '缺少表格链接'}), 400
    
    try:
        # 步骤1：加载表格（直接调用内部逻辑）
        logger.info("=== 步骤1: 加载表格 ===")
        
        # 加载凭证
        if not load_credentials():
            return jsonify({'success': False, 'error': '未连接到 Google API'}), 401
        
        # 提取 spreadsheet ID
        spreadsheet_id = None
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'spreadsheet=([a-zA-Z0-9-_]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, sheets_url)
            if match:
                spreadsheet_id = match.group(1)
                break
        if not spreadsheet_id:
            if re.match(r'^[a-zA-Z0-9-_]+$', sheets_url):
                spreadsheet_id = sheets_url
            else:
                return jsonify({'success': False, 'error': f'无法解析 Spreadsheet ID'}), 400
        
        # 提取 gid
        gid = None
        gid_match = re.search(r'[?#]gid=(\d+)', sheets_url)
        if gid_match:
            gid = int(gid_match.group(1))
        
        # 确定工作表名称
        range_str = None
        if gid is not None:
            sheet_metadata = sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id,
                fields="sheets(properties(title,sheetId))"
            ).execute()
            sheets = sheet_metadata.get('sheets', [])
            for sheet in sheets:
                props = sheet.get('properties', {})
                if props.get('sheetId') == gid:
                    range_str = props.get('title')
                    break
            if not range_str:
                return jsonify({'success': False, 'error': f'找不到 gid={gid} 的工作表'}), 400
        else:
            range_str = data.get('sheet_name', config_cache.get('sheet_name', 'Sheet1'))
        
        # 读取数据
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_str
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return jsonify({'success': True, 'message': '表格为空', 'stats': {'skus_found': 0}})
        
        headers = [h.strip() for h in values[0]]
        
        # 查找列索引
        sku_col = config_cache.get('sku_column', 'SKU')
        name_col = config_cache.get('product_name_column', 'title')
        status_col = config_cache.get('status_column', 'Status')
        active_status = config_cache.get('active_status', 'active').lower()
        
        sku_idx = name_idx = status_idx = None
        for i, h in enumerate(headers):
            hl = h.lower()
            if hl == sku_col.lower():
                sku_idx = i
            if hl == name_col.lower():
                name_idx = i
            if hl == status_col.lower():
                status_idx = i
        
        if sku_idx is None:
            return jsonify({'success': False, 'error': f'找不到 SKU 列: {sku_col}', 'available_columns': headers}), 400
        
        # 筛选 SKU
        skus = []
        for row in values[1:]:
            if len(row) <= sku_idx:
                continue
            sku = row[sku_idx].strip()
            if not sku:
                continue
            
            product_name = row[name_idx].strip() if name_idx and len(row) > name_idx else ''
            status = row[status_idx].strip().lower() if status_idx and len(row) > status_idx else ''
            
            # 如果有状态列，只取 active 的
            if status_idx and status != active_status:
                continue
            
            skus.append({'sku': sku, 'product_name': product_name})
        
        if not skus:
            return jsonify({'success': True, 'message': '没有符合条件的 SKU', 'stats': {'skus_found': 0}})
        
        logger.info(f"表格加载完成，找到 {len(skus)} 个 SKU")
        
        # 步骤2：扫描本地图片
        logger.info("=== 步骤2: 扫描本地图片 ===")
        local_folder = config_cache.get('localFolder', '')
        if not local_folder:
            return jsonify({'success': False, 'error': '未配置本地图片文件夹'}), 400
        
        if not os.path.exists(local_folder):
            return jsonify({'success': False, 'error': f'文件夹不存在: {local_folder}'}), 400
        
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
        images = []
        
        for root, dirs, files in os.walk(local_folder):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in image_extensions:
                    file_path = os.path.join(root, file)
                    images.append({
                        'filename': file,
                        'filename_no_ext': os.path.splitext(file)[0],
                        'path': file_path,
                        'extension': ext
                    })
        
        logger.info(f"本地图片扫描完成，找到 {len(images)} 张图片")
        
        # 步骤3：匹配对照
        logger.info("=== 步骤3: SKU与图片匹配 ===")
        matched = []
        unmatched_skus = []
        matched_image_paths = set()
        
        for sku_item in skus:
            sku = sku_item.get('sku', '')
            sku_lower = sku.lower()
            
            found_images = []
            for img in images:
                filename_lower = img['filename_no_ext'].lower()
                if sku_lower == filename_lower or sku_lower in filename_lower:
                    found_images.append(img)
                    matched_image_paths.add(img['path'])
            
            if found_images:
                matched.append({
                    'sku': sku,
                    'product_name': sku_item.get('product_name', ''),
                    'images': found_images
                })
            else:
                unmatched_skus.append(sku_item)
        
        logger.info(f"匹配完成: 成功 {len(matched)}, 未匹配 {len(unmatched_skus)}")
        
        if not matched:
            return jsonify({
                'success': True,
                'message': '没有匹配成功的 SKU',
                'stats': {
                    'skus_from_sheets': len(skus),
                    'images_found': len(images),
                    'matched_skus': 0,
                    'unmatched_skus': len(unmatched_skus)
                },
                'unmatched_skus': unmatched_skus
            })
        
        # 步骤4：合成图片
        logger.info("=== 步骤4: 合成图片 ===")
        output_dir = config_cache.get('outputFolder', './output')
        os.makedirs(output_dir, exist_ok=True)
        
        width = config_cache.get('composeWidth', 800)
        height = config_cache.get('composeHeight', 800)
        quality = config_cache.get('composeQuality', 95)
        format_type = config_cache.get('composeFormat', 'png')
        
        # 水印配置
        watermark_config = config_cache.get('watermark', {})
        watermark_enabled = watermark_config.get('enabled', False)
        watermark_path = watermark_config.get('path', os.path.join(_BASE_DIR, 'watermark.png'))
        watermark_width = watermark_config.get('width', 1080)
        watermark_position_y = watermark_config.get('position_y', 0)
        
        # 检查水印文件
        if watermark_enabled and not os.path.exists(watermark_path):
            logger.warning(f"水印文件不存在: {watermark_path}，将跳过水印")
            watermark_enabled = False
        
        composed = 0
        errors = []
        
        for item in matched:
            sku = item.get('sku', '')
            images_list = item.get('images', [])
            
            if not images_list:
                continue
            
            try:
                if PIL_AVAILABLE:
                    main_image_path = images_list[0]['path']
                    
                    with Image.open(main_image_path) as img:
                        img_resized = img.resize((width, height), Image.LANCZOS)
                        
                        # ===== 保存原始版本（无水印）=====
                        output_filename = f"{sku}.{format_type}"
                        output_path = os.path.join(output_dir, output_filename)
                        
                        if format_type.lower() == 'png':
                            img_resized.save(output_path, 'PNG')
                        else:
                            img_resized.save(output_path, 'JPEG', quality=quality)
                        
                        logger.info(f"已保存原始图: {output_filename}")
                        
                        # ===== 保存水印版本 =====
                        if watermark_enabled:
                            img_with_watermark = apply_watermark(
                                img_resized, 
                                watermark_path, 
                                watermark_width, 
                                watermark_position_y
                            )
                            
                            output_filename_up = f"{sku}_UP.{format_type}"
                            output_path_up = os.path.join(output_dir, output_filename_up)
                            
                            if format_type.lower() == 'png':
                                img_with_watermark.save(output_path_up, 'PNG')
                            else:
                                img_with_watermark.save(output_path_up, 'JPEG', quality=quality)
                            
                            logger.info(f"已保存水印版: {output_filename_up}")
                        
                        composed += 1
                else:
                    logger.warning(f"PIL 未安装，跳过合成: {sku}")
                    composed += 1
                    
            except Exception as e:
                errors.append(f"SKU {sku} 合成失败: {e}")
                logger.error(f"SKU {sku} 合成失败: {e}")
        
        logger.info(f"全部处理完成: 合成 {composed} 张, 水印: {'开启' if watermark_enabled else '关闭'}")
        
        return jsonify({
            'success': True,
            'message': '处理完成',
            'stats': {
                'skus_from_sheets': len(skus),
                'images_found': len(images),
                'matched_skus': len(matched),
                'unmatched_skus': len(unmatched_skus),
                'composed': composed,
                'errors_count': len(errors)
            },
            'matched': matched,
            'unmatched_skus': unmatched_skus,
            'errors': errors,
            'output_folder': output_dir
        })
        
    except Exception as e:
        logger.error(f"处理过程出错: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


def start_server(host='127.0.0.1', port=5000):
    """启动 HTTP 服务器"""
    load_config()
    load_credentials()

    logger.info(f"Image Composer Bridge v0.5.2 启动在 http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    start_server()
