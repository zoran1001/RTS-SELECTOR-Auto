import { useState, useEffect } from 'react';
import './index.css';

export interface Config {
  googleSheetId: string;
  sheetName: string;
  fieldMapping: {
    sku: string;
    productName: string;
    status: string;
  };
  drive: {
    sourceFolderId: string;
    outputFolderId: string;
  };
  local: {
    backgroundImagePath: string;
    outputFolder: string;
    logFolder: string;
  };
  selector: {
    canvasWidth: number;
    canvasHeight: number;
    outputFormat: string;
    conflictStrategy: string;
    processStatus: string;
    productPlacement: {
      maxWidth: number;
      maxHeight: number;
      centerX: number;
      centerY: number;
      offsetX: number;
      offsetY: number;
    };
  };
}

export interface Product {
  sku: string;
  productName: string;
  status: string;
  matchedImagePaths?: string[];
  errorMessage?: string;
}

type TabType = 'settings' | 'products' | 'preview';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [config, setConfig] = useState<Config | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const result = await window.electronAPI.getConfig();
    setConfig(result);
  }

  async function saveConfig() {
    if (config) {
      await window.electronAPI.saveConfig(config);
      alert('Config saved');
    }
  }

  async function selectBackground() {
    const path = await window.electronAPI.selectBackground();
    if (path && config) {
      setConfig({ ...config, local: { ...config.local, backgroundImagePath: path } });
    }
  }

  async function selectOutputFolder() {
    const path = await window.electronAPI.selectOutputFolder();
    if (path && config) {
      setConfig({ ...config, local: { ...config.local, outputFolder: path } });
    }
  }

  async function loadProducts() {
    if (!config) return;
    setLoading(true);
    const result = await window.electronAPI.loadProducts(config);
    if (result.success) {
      setProducts(result.data);
    } else {
      alert(`Error: ${result.error}`);
    }
    setLoading(false);
  }

  async function matchImages() {
    if (!config || products.length === 0) return;
    setLoading(true);
    const result = await window.electronAPI.matchImages(products, config.drive.sourceFolderId);
    if (result.success) {
      setProducts(result.data);
    } else {
      alert(`Error: ${result.error}`);
    }
    setLoading(false);
  }

  async function processSingle(product: Product) {
    if (!config) return;
    setProcessing(true);
    const result = await window.electronAPI.processSingle(product, config);
    if (result.success) {
      alert(`Processed: ${result.outputPath}`);
      loadProducts();
    } else {
      alert(`Error: ${result.error}`);
    }
    setProcessing(false);
  }

  async function processReady() {
    if (!config) return;
    const readyProducts = products.filter(p => p.status === 'Ready' && p.matchedImagePaths?.length);
    if (readyProducts.length === 0) {
      alert('No Ready products with matched images');
      return;
    }
    setProcessing(true);
    const result = await window.electronAPI.processBatch(readyProducts, config);
    if (result.success) {
      const successCount = result.data.filter(r => r.success).length;
      const failCount = result.data.filter(r => !r.success).length;
      alert(`Processed ${successCount} successfully, ${failCount} failed`);
      loadProducts();
    } else {
      alert(`Error: ${result.error}`);
    }
    setProcessing(false);
  }

  async function openOutputFolder() {
    if (config) {
      await window.electronAPI.openOutputFolder(config.local.outputFolder);
    }
  }

  async function openLogFolder() {
    await window.electronAPI.openLogFolder();
  }

  const stats = {
    ready: products.filter(p => p.status === 'Ready').length,
    done: products.filter(p => p.status === 'Done').length,
    error: products.filter(p => p.status === 'Error').length,
    missingImage: products.filter(p => p.status === 'Missing Image').length,
    needReview: products.filter(p => p.status === 'Need Review').length,
  };

  const getStatusClass = (status: string) => {
    const map: Record<string, string> = {
      'Ready': 'bg-green-100 text-green-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Done': 'bg-blue-100 text-blue-800',
      'Error': 'bg-red-100 text-red-800',
      'Missing Image': 'bg-orange-100 text-orange-800',
      'Need Review': 'bg-purple-100 text-purple-800',
      'Missing SKU': 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Selector - Image Processing Tool</h1>
        <p className="text-sm text-gray-500 mt-1">Output: {config?.selector.canvasWidth || 1080} x {config?.selector.canvasHeight || 1080} {config?.selector.outputFormat || 'png'}</p>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="flex">
          {[
            { id: 'settings' as TabType, label: 'Settings' },
            { id: 'products' as TabType, label: 'Products' },
            { id: 'preview' as TabType, label: 'Preview' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-6 py-6">
        {/* Settings Tab */}
        {activeTab === 'settings' && config && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
            
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Google Sheet Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Spreadsheet ID</label>
                    <input
                      type="text"
                      value={config.googleSheetId}
                      onChange={(e) => setConfig({ ...config, googleSheetId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Google Sheet ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sheet Name</label>
                    <input
                      type="text"
                      value={config.sheetName}
                      onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Sheet Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU Column Name</label>
                    <input
                      type="text"
                      value={config.fieldMapping.sku}
                      onChange={(e) => setConfig({ ...config, fieldMapping: { ...config.fieldMapping, sku: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="SKU"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name Column</label>
                    <input
                      type="text"
                      value={config.fieldMapping.productName}
                      onChange={(e) => setConfig({ ...config, fieldMapping: { ...config.fieldMapping, productName: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Product Name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Column Name</label>
                    <input
                      type="text"
                      value={config.fieldMapping.status}
                      onChange={(e) => setConfig({ ...config, fieldMapping: { ...config.fieldMapping, status: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Status"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Google Drive Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source Folder ID (Raw Images)</label>
                    <input
                      type="text"
                      value={config.drive.sourceFolderId}
                      onChange={(e) => setConfig({ ...config, drive: { ...config.drive, sourceFolderId: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Drive Folder ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Output Folder ID (Optional)</label>
                    <input
                      type="text"
                      value={config.drive.outputFolderId}
                      onChange={(e) => setConfig({ ...config, drive: { ...config.drive, outputFolderId: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Drive Folder ID"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Local Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.local.backgroundImagePath}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                      <button
                        onClick={selectBackground}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Output Folder</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.local.outputFolder}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                      <button
                        onClick={selectOutputFolder}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Selector Configuration</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Canvas Width</label>
                    <input
                      type="number"
                      value={config.selector.canvasWidth}
                      onChange={(e) => setConfig({ ...config, selector: { ...config.selector, canvasWidth: parseInt(e.target.value) || 1080 } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Canvas Height</label>
                    <input
                      type="number"
                      value={config.selector.canvasHeight}
                      onChange={(e) => setConfig({ ...config, selector: { ...config.selector, canvasHeight: parseInt(e.target.value) || 1080 } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                    <select
                      value={config.selector.outputFormat}
                      onChange={(e) => setConfig({ ...config, selector: { ...config.selector, outputFormat: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Process Status</label>
                    <select
                      value={config.selector.processStatus}
                      onChange={(e) => setConfig({ ...config, selector: { ...config.selector, processStatus: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Ready">Ready</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={saveConfig}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Products ({products.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={loadProducts}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Loading...' : 'Load Sheet'}
                </button>
                <button
                  onClick={matchImages}
                  disabled={loading || products.length === 0}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Match Images
                </button>
                <button
                  onClick={processReady}
                  disabled={processing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processing ? 'Processing...' : `Process Ready (${stats.ready})`}
                </button>
                <button
                  onClick={openOutputFolder}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Open Output Folder
                </button>
                <button
                  onClick={openLogFolder}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Open Logs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
                <div className="text-sm text-green-600">Ready</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.done}</div>
                <div className="text-sm text-blue-600">Completed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{stats.missingImage}</div>
                <div className="text-sm text-orange-600">Missing Image</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.needReview}</div>
                <div className="text-sm text-purple-600">Need Review</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matched Images</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{product.sku}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(product.status)}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.matchedImagePaths?.length || 0}</td>
                      <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate">{product.errorMessage || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setActiveTab('preview');
                          }}
                          className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          Preview
                        </button>
                        {product.status === 'Ready' && product.matchedImagePaths?.length && (
                          <button
                            onClick={() => processSingle(product)}
                            className="ml-2 px-3 py-1 text-xs text-green-600 hover:text-green-800"
                          >
                            Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No products loaded. Click "Load Sheet" to load products from Google Sheet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="max-w-4xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
            
            {selectedProduct ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-2">{selectedProduct.sku}</h3>
                <p className="text-gray-500 mb-4">{selectedProduct.productName}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Original Image</h4>
                    {selectedProduct.matchedImagePaths?.length ? (
                      <img
                        src={selectedProduct.matchedImagePaths[0]}
                        alt="Original"
                        className="max-h-64 w-full object-contain"
                      />
                    ) : (
                      <div className="h-32 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded">
                        No image
                      </div>
                    )}
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Background</h4>
                    {config?.local.backgroundImagePath ? (
                      <img
                        src={`file://${config.local.backgroundImagePath}`}
                        alt="Background"
                        className="max-h-64 w-full object-contain"
                      />
                    ) : (
                      <div className="h-32 bg-white border border-gray-300 rounded flex items-center justify-center text-gray-400">
                        White Background
                      </div>
                    )}
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (1080x1080)</h4>
                    {selectedProduct.matchedImagePaths?.length ? (
                      <div className="h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                        Preview will show here after processing
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded">
                        No preview available
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (selectedProduct && config) {
                        processSingle(selectedProduct);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Process This Product
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Back to List
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Select a product from the Products tab to preview</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
