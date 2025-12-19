# Fix Permission Denied Error for tsc

## Problem
Getting "Permission denied" when running `tsc` on VPS.

## Solution 1: Use npx (Recommended - Already Applied)
Updated `package.json` scripts to use `npx tsc` instead of `tsc`. This ensures npm finds the correct binary with proper permissions.

## Solution 2: Fix Permissions (Alternative)
If you still have issues, run these commands on your VPS:

```bash
# Fix permissions on node_modules/.bin
chmod +x node_modules/.bin/*
chmod +x frontend/node_modules/.bin/*

# Or reinstall dependencies
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install && cd ..
```

## Solution 3: Use Full Path
You can also use the full path to tsc:

```bash
# Backend
./node_modules/.bin/tsc

# Frontend
cd frontend && ./node_modules/.bin/tsc && vite build
```

## Why This Happens
- File permissions on `node_modules/.bin/tsc` might be incorrect
- Files copied from Windows to Linux might lose execute permissions
- Git might not preserve execute permissions

## Verification
After applying the fix, try:
```bash
npm run build:backend
npm run build:frontend
```

Both should work now with `npx tsc`.

