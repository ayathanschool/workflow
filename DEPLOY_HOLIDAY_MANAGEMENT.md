# Deploy Holiday Management Feature to Apps Script

## Current Status
✅ **Frontend**: All changes deployed (running on localhost:5173)
✅ **Git Repository**: All code committed and pushed to GitHub
❌ **Apps Script Backend**: NOT YET DEPLOYED (causing "Permission denied" errors)

## What Needs to be Deployed

The following Apps Script files have been updated and need to be deployed:

1. **HolidayManager.gs** (NEW FILE) - Holiday management and lesson cascading logic
2. **MainApp.gs** (MODIFIED) - Added 4 new API routes (lines 723-751)
3. **Config.gs** (MODIFIED) - Added UndeclaredHolidays sheet definition
4. **AuditLogger.gs** (MODIFIED) - Added holiday audit actions

## Deployment Steps

### Step 1: Open Your Apps Script Project
1. Go to https://script.google.com
2. Find and open your "SchoolFlow" (or equivalent) project
3. You should see all your .gs files in the left sidebar

### Step 2: Update the Files

#### A. Create New File: HolidayManager.gs
1. Click the **+ (Add a file)** button in the Files section
2. Select "Script" and name it `HolidayManager`
3. Copy the entire contents from: `d:\Backup app\0912\0912\Appscript\HolidayManager.gs`
4. Paste into the new file in Apps Script editor
5. Click **Save** (Ctrl+S)

#### B. Update Config.gs
1. Open `Config.gs` in the Apps Script editor
2. Find the `SHEETS` object (around line 10-30)
3. After the `AuditLog` entry, add this line:
   ```javascript
   UndeclaredHolidays: ['id','date','reason','markedBy','markedAt','status'],
   ```
4. Click **Save** (Ctrl+S)

#### C. Update AuditLogger.gs
1. Open `AuditLogger.gs` in the Apps Script editor
2. Find the `AUDIT_ACTIONS` object (around lines 20-30)
3. Add these three new actions:
   ```javascript
   MARK_HOLIDAY: 'marked_undeclared_holiday',
   DELETE_HOLIDAY: 'deleted_holiday',
   CASCADE_LESSONS: 'cascaded_lesson_plans',
   ```
4. Find the `AUDIT_ENTITIES` object (around lines 40-50)
5. Add this entity:
   ```javascript
   HOLIDAY: 'Holiday',
   ```
6. Click **Save** (Ctrl+S)

#### D. Update MainApp.gs
1. Open `MainApp.gs` in the Apps Script editor
2. Find the end of your action routing section (around line 720-750)
3. After the `exportAuditLogs` action, add these 4 new routes:

```javascript
    // ========== HOLIDAY MANAGEMENT ==========
    if (action === 'markUndeclaredHoliday') {
        if (!isHMOrSuperAdmin(data.email || e.parameter.email)) {
            return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(markUndeclaredHoliday(data.date, data.reason, data.userEmail, data.userName));
    }

    if (action === 'getUndeclaredHolidays') {
        if (!isHMOrSuperAdmin(data.email || e.parameter.email)) {
            return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond({ holidays: getUndeclaredHolidays(data.activeOnly) });
    }

    if (action === 'deleteUndeclaredHoliday') {
        if (!isHMOrSuperAdmin(data.email || e.parameter.email)) {
            return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(deleteUndeclaredHoliday(data.holidayId, data.userEmail, data.userName));
    }

    if (action === 'cascadeLessonPlans') {
        if (!isHMOrSuperAdmin(data.email || e.parameter.email)) {
            return _respond({ error: 'Permission denied. HM or Super Admin access required.' });
        }
        return _respond(cascadeLessonPlansFromDate(data.startDate, data.userEmail, data.userName));
    }
```

4. Click **Save** (Ctrl+S)

### Step 3: Deploy the Updated Web App

**CRITICAL**: You must create a NEW DEPLOYMENT VERSION for changes to take effect.

1. Click on **Deploy** → **Manage deployments** (top-right corner)
2. Click the **pencil icon** (Edit) next to your active deployment
3. Under "Version", click **New version**
4. Add a description: "Added Holiday Management feature"
5. Click **Deploy**
6. **IMPORTANT**: Copy the Web App URL (it should remain the same)
7. Click **Done**

### Step 4: Verify Deployment

1. Go to your frontend (http://localhost:5173)
2. Log in as **HM** or **Super Admin**
3. You should now see **"Holiday Management"** in the sidebar menu
4. Click on it and try to:
   - View the holiday list (should load without errors)
   - Mark a future date as a holiday
   - Verify the holiday appears in the list

### Step 5: Test Full Functionality

#### Test as HM Role:
1. Navigate to Holiday Management
2. Mark today or a future date as a holiday
3. Verify success message appears
4. Check that the holiday appears in the active holidays list
5. Try cascading lesson plans
6. Verify audit log entry created

#### Test as Super Admin:
1. Log in as Super Admin
2. Verify Holiday Management menu item is visible
3. Perform same tests as HM role
4. Verify all functionality works

## Troubleshooting

### Still Getting "Unknown action: markUndeclaredHoliday"?
- You didn't deploy a new version. Go back to Step 3 and create a NEW VERSION.
- You might be using the wrong web app URL. Check that frontend is pointing to the correct endpoint.

### Getting "Permission denied" error?
- Verify you're logged in as HM or Super Admin role
- Check that `isHMOrSuperAdmin()` function exists in AuthManager.gs
- Check browser console for authentication token issues

### Holiday Management menu not showing?
- For Super Admin: Should now be visible (fixed in latest commit)
- For HM: Should be visible
- For other roles: Should NOT be visible (intentional)
- Clear browser cache and refresh if menu doesn't update

### Functions not found errors?
- Make sure HolidayManager.gs file was created with correct name
- Verify all functions are saved in Apps Script
- Check for typos in function names

## Files Changed Summary

| File | Change Type | Lines Modified |
|------|-------------|----------------|
| HolidayManager.gs | NEW | 283 lines |
| MainApp.gs | MODIFIED | Added ~40 lines (routes) |
| Config.gs | MODIFIED | Added 1 line |
| AuditLogger.gs | MODIFIED | Added 4 lines |
| App.jsx (frontend) | MODIFIED | Added menu item for Super Admin |

## What This Feature Does

Once deployed, the Holiday Management feature allows:

1. **Mark Undeclared Holidays**: HM/Super Admin can mark any date as an undeclared holiday with a reason
2. **View Holiday List**: See all active holidays sorted by date
3. **Delete Holidays**: Remove holidays that were marked in error
4. **Cascade Lesson Plans**: Automatically shift all future pending lesson plans forward by skipping holidays
5. **Audit Trail**: All holiday operations are logged for compliance

## Next Steps After Deployment

1. Test the feature thoroughly with both HM and Super Admin accounts
2. Train HM staff on how to use the holiday management feature
3. Document the process for marking holidays in your school's operational manual
4. Monitor audit logs to track holiday management activities
