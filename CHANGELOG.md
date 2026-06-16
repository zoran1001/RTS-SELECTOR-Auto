# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Initial Release

### Added
- Electron desktop app foundation
- Fixed 1080 x 1080 selector output flow
- SKU-based output naming
- Settings page for Google Sheet/Drive configuration
- Products page for loading and managing products
- Preview page for single product processing
- Local configuration persistence with electron-store
- Image matching based on SKU
- Processing logging system
- Tailwind CSS styling

### Changed
- Migrated from Next.js Web App to Electron desktop app
- Removed template system (single fixed 1080x1080 output)
- Simplified configuration structure

### Known Issues
- Google Sheet connection requires further validation
- Google Drive image matching requires further testing
- No auto-update mechanism yet
