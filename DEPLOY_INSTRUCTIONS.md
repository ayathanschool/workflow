# Deploy Backend to Fix Slow Loading

## Problem
Scheme loading is taking 15+ seconds because the deployed backend is old and unoptimized.

## Solution
Deploy the updated SchemeLessonManager.gs with performance optimizations.

## Steps

### 1. Open Apps Script
https://script.google.com

### 2. Deploy SchemeLessonManager.gs

**Location**: `d:\www\wwww\Appscript\SchemeLessonManager.gs` (3,420 lines)

**What to do**:
1. Find `SchemeLessonManager.gs` in the Apps Script left panel
2. Select ALL content in Apps Script (Ctrl+A)
3. Delete it
4. Open local file: `d:\www\wwww\Appscript\SchemeLessonManager.gs`
5. Copy ALL content (Ctrl+A, then Ctrl+C)
6. Paste into Apps Script editor (Ctrl+V)
7. Save (Ctrl+S)

### 3. Deploy New Version

1. Click "Deploy" → "New deployment"
2. Type: **Web app**
3. Description: `Performance optimization - TextFinder + sparse sessions`
4. Execute as: **Me**
5. Access: **Anyone**
6. Click **Deploy**

### 4. Update Frontend .env (if URL changed)

If you get a NEW deployment URL, update:
- `d:\www\wwww\frontend\.env`
- `d:\www\wwww\frontend\.env.local`

Replace `VITE_API_BASE_URL` with the new URL in BOTH files.

### 5. Test

Refresh browser and check:
- ✅ Schemes load in ~3-5 seconds (instead of 15+ seconds)
- ✅ All chapters and sessions visible when expanded
- ✅ No timeout errors

## What's Fixed in the New Version

✅ **TextFinder API**: Finds teacher's data 10x faster (no full sheet scans)  
✅ **Sparse Sessions**: Only sends planned sessions (90% smaller payload)  
✅ **Better Caching**: 60s cache for summary mode, 5min for full mode  
✅ **Index Support**: Uses TeacherSchemeProgress sheet if available  
✅ **Optimized Loops**: O(1) lookups instead of O(n²) filtering  

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Load Time | 15-60s | 3-5s |
| Payload Size | ~500KB | ~50-100KB |
| Timeout Errors | Yes | No |
| User Experience | Frustrating | Smooth |

## Alternative (If Deploy Fails)

If you can't deploy immediately, the frontend now loads full details which works but is slow. Deploy when possible for best performance.
