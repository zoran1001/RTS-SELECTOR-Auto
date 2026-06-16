# RTS Selector Auto v0.1

## Version Information
- Display Version: 0.1
- Package Version: 0.1.0
- Git Tag: v0.1

## Release Date
2026-06-16

## Added
- Electron desktop app foundation
- Fixed 1080 x 1080 selector output flow
- SKU-based output naming ({SKU}.png)
- Settings page for Google Sheet/Drive configuration
- Products page for loading and managing products
- Preview page for single product processing
- Local configuration persistence (electron-store)
- Image matching based on SKU
- Processing logging system
- Tailwind CSS styling

## Changed
- Migrated from Next.js Web App to Electron desktop app
- Removed template system (single fixed 1080x1080 output)
- Simplified configuration structure

## Known Issues
- Google Sheet connection requires further validation
- Google Drive image matching requires further testing
- No auto-update mechanism yet

## How to Test
1. Run `npm install` to install dependencies
2. Run `npm run dev` to start development mode
3. Configure Google Sheet ID, Drive Folder ID, and output path in Settings
4. Click "Load Sheet" to load products
5. Click "Match Images" to match product images
6. Click "Process Ready" to process products
7. Check output folder for generated images
