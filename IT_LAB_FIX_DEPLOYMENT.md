# IT Lab Fix - Deployment Instructions

## Problem Identified and Fixed

**ROOT CAUSE**: The IT Lab API handlers were incorrectly placed inside the `doGet` function instead of `doPost`. 
- `doGet` handles GET requests (browser URLs)
- `doPost` handles POST requests (API calls from frontend)
- Frontend uses POST via `callAPI()`, so handlers MUST be in `doPost`

## What Was Fixed

### 1. Moved IT Lab Handlers from doGet to doPost
**Removed from doGet** (were at lines ~2470-2606):
- `if (action === 'generateITLabDrafts')`
- `if (action === 'getITLabDrafts')`  
- `if (action === 'submitITLabDrafts')`
- `if (action === 'updateITLabDraft')`
- `if (action === 'getFreeTeachers')`

**Added to doPost** (now at lines ~4445-4549):
- All 5 IT Lab handlers are now correctly placed inside `doPost` function
- Positioned before the "Unknown action" return statement
- Proper indentation and scope maintained

### 2. Verification Complete
✅ No syntax errors
✅ No duplicate handlers
✅ All implementation functions remain at end of file (correct location)
✅ doPost structure intact with proper closing

## Deployment Steps

### Step 1: Copy Updated Code.gs
1. Open your Google Apps Script project: https://script.google.com
2. Open the `Code.gs` file in the editor
3. **Select ALL content** (Ctrl+A)
4. **Delete** all existing code
5. Open `Appscript/Code.gs` from this workspace
6. **Copy ALL content** 
7. **Paste** into Google Apps Script editor

### Step 2: Save and Deploy
1. Click **Save** (disk icon or Ctrl+S)
2. Wait for "Saved" confirmation
3. Click **Deploy** → **Manage deployments**
4. Click **✏️ Edit** on the active deployment
5. Under "Version", click **New version**
6. Add description: `Fixed IT Lab handlers - moved from doGet to doPost`
7. Click **Deploy**
8. **IMPORTANT**: Copy the new deployment URL (should be same as before)
9. Expected version: **34**

### Step 3: Verify Deployment
After deployment completes:

1. **Test from Frontend**:
   - Login as HM user
   - Navigate to "IT Lab Substitutions"
   - Click "Generate Drafts"
   - Should see success message and draft list (NOT "Unknown action")

2. **Check Logs** (if needed):
   - Go to **Executions** in Apps Script
   - Check recent POST requests
   - Should see "Handling POST request for action: generateITLabDrafts"

### Step 4: Confirm Fix
Expected behavior after fix:
- ✅ "Generate Drafts" button works
- ✅ Draft list loads without errors
- ✅ Teacher dropdown populates
- ✅ "Submit to Substitutions" works
- ✅ No more "Unknown action" errors

## Technical Details

### File Changes Made
**File**: `Appscript/Code.gs`
- **Lines removed**: ~2470-2606 (from doGet function)
- **Lines added**: ~4445-4549 (to doPost function)
- **Net change**: -138 lines (removed duplicate/misplaced code)

### Function Structure (Verified)
```
doGet(e) {                          // Line 667
  ... handles GET requests ...
  // IT Lab handlers REMOVED from here
}                                    // Line ~2930

doPost(e) {                          // Line 3006
  ... handles POST requests ...
  
  // IT Lab handlers NOW CORRECTLY HERE
  if (action === 'generateITLabDrafts') { ... }    // Line 4445
  if (action === 'getITLabDrafts') { ... }          // Line 4451
  if (action === 'submitITLabDrafts') { ... }       // Line 4488
  if (action === 'updateITLabDraft') { ... }        // Line 4495
  if (action === 'getFreeTeachers') { ... }         // Line 4502
  
  return _respond({ error: 'Unknown action' });     // Line 4551
}                                    // Line 4555

// Implementation functions (unchanged, correct location)
generateITLabDrafts(targetDate) { ... }             // Line 5370
submitITLabDrafts(targetDate, userName) { ... }     // Line 5522
updateITLabDraft(draftId, newTeacher) { ... }       // Line 5594
```

## Why This Fixes the Issue

1. **Before Fix**: 
   - Frontend makes POST request → hits `doPost` function
   - `doPost` checks action handlers
   - IT Lab handlers were in `doGet`, NOT `doPost`
   - No match found → "Unknown action" error returned

2. **After Fix**:
   - Frontend makes POST request → hits `doPost` function  
   - `doPost` checks action handlers
   - IT Lab handlers NOW IN `doPost`
   - Match found → correct function called → success!

## No Other Changes Needed

- ✅ Frontend code (`ITLabManagement.jsx`) - correct as-is
- ✅ API helper (`api.js`) - correct as-is
- ✅ Implementation functions - correct location
- ✅ Navigation & routing - correct as-is
- ✅ Role checking - correct as-is
- ✅ `.env` file - correct URL configured

**ONLY** the Apps Script deployment needs updating.

## Support

If deployment succeeds but issues persist:
1. Clear browser cache and reload
2. Check browser console for errors (F12)
3. Verify HM role in Users sheet format: `hm` or `h m`
4. Check Apps Script Executions tab for detailed logs

---
**Date**: 2024
**Version**: 34 (after deployment)
**Status**: Ready to deploy
