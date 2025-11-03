# Public Static Assets

This directory contains static assets served by the X402 Gateway.

## Favicon Files

Multiple favicon formats and sizes are provided for maximum browser compatibility:

- `favicon.png` (64x64) - Primary favicon, served for `/favicon.ico` and `/favicon.png`
- `favicon-16x16.png` - Small size favicon
- `favicon-32x32.png` - Medium size favicon
- `favicon-48x48.png` - Large size favicon
- `favicon.icns` - macOS icon format
- `logo.png` - Full-size logo (original from root)

## Accessing Static Files

Static files are served via these routes:

- `/favicon.ico` → `public/favicon.png`
- `/favicon.png` → `public/favicon.png`
- `/logo.png` → `public/logo.png`
- `/public/*` → All files in this directory

## Generating Favicons

The favicon files were generated from `logo.png` using macOS `sips` utility:

```bash
# Generate different sizes
sips -s format png -z 16 16 logo.png --out public/favicon-16x16.png
sips -s format png -z 32 32 logo.png --out public/favicon-32x32.png
sips -s format png -z 48 48 logo.png --out public/favicon-48x48.png
sips -s format png -z 64 64 logo.png --out public/favicon.png
sips -s format icns -z 256 256 logo.png --out public/favicon.icns
```

## Build Process

The `public` directory is automatically copied to `dist/public` during the build process via the `pnpm build` script.
