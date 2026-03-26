# Fix: SWC Package Platform Mismatch

## Issue

The `@next/swc-darwin-arm64` package was in `dependencies`, causing installation failures on Linux x64 servers:

```
npm error notsup Actual os: linux
npm error notsup Valid cpu: arm64
npm error Actual cpu: x64
```

## Solution

Moved `@next/swc-darwin-arm64` from `dependencies` to `devDependencies` because:

1. **Platform-specific**: Only needed for local macOS ARM64 development
2. **Server doesn't need it**: Linux x64 server will use `@next/swc-linux-x64-gnu` automatically
3. **Next.js auto-detects**: Next.js automatically installs the correct SWC binary for the platform

## Changes Made

**Before:**
```json
"dependencies": {
  "@next/swc-darwin-arm64": "^16.1.2",
  ...
}
```

**After:**
```json
"dependencies": {
  ...
},
"devDependencies": {
  "@next/swc-darwin-arm64": "^16.1.2",
  ...
}
```

## Deployment

On the server, run:
```bash
cd /var/www/decleanup/frontend
npm install --production  # Skips devDependencies
# OR
npm install  # Will skip platform-incompatible packages automatically
npm run build
```

## Next.js SWC Binary Selection

Next.js automatically selects the correct SWC binary:
- **macOS ARM64**: `@next/swc-darwin-arm64`
- **macOS x64**: `@next/swc-darwin-x64`
- **Linux x64**: `@next/swc-linux-x64-gnu` (auto-installed)
- **Linux ARM64**: `@next/swc-linux-arm64-gnu`
- **Windows**: Various `@next/swc-win32-*` packages

You don't need to manually specify these - Next.js handles it automatically.

---

**Status**: ✅ Fixed - Package moved to devDependencies
