# 🚀 IMMEDIATE DEPLOYMENT FIX - Google Apps Script Update

## Current Issue: "Unknown action" Error Persists

The Google Apps Script web app is still running the **old version** without the scheme-based lesson planning handlers. Here's the step-by-step fix:

## 📋 DEPLOYMENT STEPS (Follow Exactly)

### Step 1: Open Google Apps Script
1. Go to [script.google.com](https://script.google.com)
2. Find and open your **AyathanWorkflow** project
3. You should see your existing files

### Step 2: Update MainApp.gs
1. Click on `MainApp.gs` in the file list
2. **Select All** (Ctrl+A) and **Delete** the current content
3. **Copy and paste** the ENTIRE content from your local file:
   ```
   d:\Backup app\1610\AyathanWorkflow\Appscript\MainApp.gs
   ```
4. **Save** (Ctrl+S)

### Step 3: Add/Update SchemeLessonManager.gs
1. If `SchemeLessonManager.gs` doesn't exist:
   - Click the **+ (plus)** button next to "Files"
   - Select **"Script"**
   - Name it `SchemeLessonManager`
2. **Select All** content and **Delete**
3. **Copy and paste** the ENTIRE content from:
   ```
   d:\Backup app\1610\AyathanWorkflow\Appscript\SchemeLessonManager.gs
   ```
4. **Save** (Ctrl+S)

### Step 4: Update SheetHelpers.gs
1. Click on `SheetHelpers.gs`
2. **Select All** (Ctrl+A) and **Delete** the current content
3. **Copy and paste** the ENTIRE content from your local file:
   ```
   d:\Backup app\1610\AyathanWorkflow\Appscript\SheetHelpers.gs
   ```
4. **Save** (Ctrl+S)

### Step 5: Verify All Files Are Present
Ensure these files exist in your Google Apps Script project:
- ✅ `MainApp.gs` (with scheme handlers)
- ✅ `SchemeLessonManager.gs` (new file)
- ✅ `SheetHelpers.gs` (fixed _respond function)
- ✅ `AuthManager.gs`
- ✅ `Config.gs`
- ✅ `ExamManager.gs`
- ✅ `LessonProgressManager.gs`
- ✅ `SubstitutionManager.gs`
- ✅ `TimetableManager.gs`

### Step 6: Deploy New Version
1. Click the **"Deploy"** button (top-right corner)
2. Click **"New deployment"**
3. Under "Type", select **"Web app"**
4. Configuration:
   - **Description**: "Added scheme-based lesson planning support"
   - **Execute as**: "Me (your email)"
   - **Who has access**: "Anyone" (or your preferred setting)
5. Click **"Deploy"**
6. **Copy the new Web App URL** (if it changed)

### Step 7: Test the Deployment
After deployment, test these URLs:

**Test 1 - Ping (should work):**
```
https://your-web-app-url/exec?action=ping
```

**Test 2 - Scheme Planning (should NOT return "Unknown action"):**
```
https://your-web-app-url/exec?action=getApprovedSchemesForLessonPlanning&teacherEmail=test@example.com
```

## 🔍 Expected Results After Deployment

✅ **SUCCESS**: The scheme planning endpoint should return:
```json
{
  "status": 200,
  "data": {
    "success": true,
    "schemes": [...],
    "message": "Approved schemes retrieved successfully"
  }
}
```

❌ **FAILURE**: If you still see:
```json
{
  "status": 200,
  "data": {
    "error": "Unknown action: getApprovedSchemesForLessonPlanning"
  }
}
```

## 🚨 If Still Getting "Unknown action"

1. **Check the web app URL**: Make sure you're using the latest deployed URL
2. **Clear browser cache**: The old response might be cached
3. **Wait 1-2 minutes**: Google Apps Script sometimes takes time to update
4. **Check for syntax errors**: Look at the Google Apps Script console for errors
5. **Verify file content**: Ensure MainApp.gs actually contains the new handlers

## 📝 Quick Verification Checklist

Before testing, verify in Google Apps Script that MainApp.gs contains:

```javascript
// === SCHEME-BASED LESSON PLANNING ROUTES ===
if (action === 'getApprovedSchemesForLessonPlanning') {
  return _handleGetApprovedSchemesForLessonPlanning(e.parameter);
}

if (action === 'getAvailablePeriodsForLessonPlan') {
  return _handleGetAvailablePeriodsForLessonPlan(e.parameter);
}
```

And that SchemeLessonManager.gs contains:
```javascript
function getApprovedSchemesForLessonPlanning(teacherEmail) {
  // ... function implementation
}
```

## 🎯 Critical Notes

1. **You MUST deploy a new version** - just saving files is not enough
2. **Use the exact web app URL** from the new deployment
3. **All files must be updated** before deployment
4. **Test immediately** after deployment to verify success

Once deployed correctly, the frontend will work perfectly! 🚀