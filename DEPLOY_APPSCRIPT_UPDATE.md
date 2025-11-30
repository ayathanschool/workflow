# Deploy AppScript Updates to Production

## Issue
Production is not showing available periods because it's running old code that doesn't filter by class/subject properly.

## Files That Need Deployment

1. **SheetHelpers.gs** - Fixed `_ensureHeaders()` function (additive approach)
2. **Config.gs** - Updated LessonPlans schema with missing columns

## Deployment Steps

### Method 1: Google Apps Script Web IDE (Recommended)

1. **Open Apps Script Editor**
   - Go to: https://script.google.com
   - Open your "EnhanceFlow" project

2. **Update SheetHelpers.gs**
   - Find `SheetHelpers.gs` in the file list
   - Copy the ENTIRE contents from: `d:\Backup app\enhanceflow\Appscript\SheetHelpers.gs`
   - Paste and replace all content
   - **Save** (Ctrl+S)

3. **Update Config.gs**
   - Find `Config.gs` in the file list
   - Copy the ENTIRE contents from: `d:\Backup app\enhanceflow\Appscript\Config.gs`
   - Paste and replace all content
   - **Save** (Ctrl+S)

4. **Deploy New Version**
   - Click **Deploy** → **Manage deployments**
   - Click ✏️ **Edit** next to your active deployment
   - Change "Version" to **New version**
   - Add description: "Fixed period filtering and header management"
   - Click **Deploy**

5. **Test**
   - Go to https://workflow-wine.vercel.app
   - Try creating a lesson plan in Scheme-Based Planning
   - You should now see the 26 periods matching your class/subject

### Method 2: clasp (Command Line)

```powershell
# If you have clasp installed and configured
cd "D:\Backup app\enhanceflow\Appscript"
clasp push
clasp deploy
```

## Verification

After deployment, the production app should:
- ✅ Show available periods filtered by scheme's class and subject
- ✅ Not auto-change sheet headers anymore
- ✅ Preserve manual column additions

## What Changed

### SheetHelpers.gs
- Changed `_ensureHeaders()` from **destructive** (overwrites all) to **additive** (only adds missing)
- Prevents loss of manually added columns

### Config.gs  
- Added 8 missing columns to LessonPlans schema:
  - `reviewComments`, `reviewedAt`, `uniqueKey`
  - `originalDate`, `originalPeriod`
  - `cancelledAt`, `cancelReason`, `forRevision`

## Why This Fixes the Issue

The period filtering code was already correct in your codebase:
- Backend properly receives `class` and `subject` parameters
- Backend filters timetable to match scheme's class/subject
- Frontend properly sends these parameters

**The problem:** Production was running old code without these changes!

Once deployed, production will match localhost behavior.
