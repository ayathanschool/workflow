# Exam Marks Submission Fix

## Issue
When teachers try to save exam marks, they get the error:
```
Failed to save marks: Failed to save marks
```

## Root Cause
**Field Name Mismatch:**
- **Frontend** sends marks with field names: `internal` and `external`
- **Backend** expected field names: `ce` (Continuous Evaluation) and `te` (Term Exam)

The backend code was only checking for `ce` and `te`, so when it received `internal` and `external`, it couldn't find the values and returned `0` for both marks.

## Fix Applied
Modified `Appscript/ExamManager.gs` line 117-118 to accept **both** naming conventions:

```javascript
// BEFORE (only accepted ce/te):
const ce = parseInt(studentMark.ce) || 0;
const te = parseInt(studentMark.te) || 0;

// AFTER (accepts both ce/te AND internal/external):
const ce = parseInt(studentMark.ce || studentMark.internal) || 0;
const te = parseInt(studentMark.te || studentMark.external) || 0;
```

## Database Structure
The `ExamMarks` sheet stores marks with these column names:
- `ce` = Continuous Evaluation (Internal marks)
- `te` = Term Exam (External marks)
- `total` = ce + te
- `grade` = Calculated based on percentage

This naming is correct and matches the sheet structure defined in `Config.gs`.

## Deployment Steps

### 1. Open Google Apps Script Editor
1. Go to: https://script.google.com
2. Open your project: **AyathanWorkflow** (or whatever you named it)
3. Find the file: **ExamManager.gs**

### 2. Update the Code
Locate the `submitExamMarks` function (around line 96), and find this section:

```javascript
// Process each student's marks
for (const studentMark of marks) {
  const ce = parseInt(studentMark.ce) || 0;  // ← Change this line
  const te = parseInt(studentMark.te) || 0;  // ← Change this line
  const total = ce + te;
```

**Replace those two lines with:**
```javascript
  // Accept both ce/te (old) and internal/external (new) field names
  const ce = parseInt(studentMark.ce || studentMark.internal) || 0;
  const te = parseInt(studentMark.te || studentMark.external) || 0;
```

### 3. Deploy the Fix
1. Click **Deploy** → **Manage deployments**
2. Click the **Edit** icon (pencil) next to your active deployment
3. Under "Version", select **New version**
4. Add description: "Fix exam marks submission - accept internal/external field names"
5. Click **Deploy**
6. Copy the new **Web app URL** (should be the same as before)

### 4. Test the Fix
1. Go to your app: https://workflow-wine.vercel.app
2. Login as a teacher
3. Navigate to: **Exam Management** → **Enter Marks**
4. Select exam: **Term 1 - STD 6A - English** (or any exam)
5. Enter marks for students
6. Click **Save Marks**
7. ✅ Should succeed with message: "Marks Saved Successfully"

### 5. Verify Data in Google Sheets
1. Open your Google Sheet: `1sRD4gpE6CLtSOYF6OWNpLEoZfqGY9Oa8IOPj6c_rbXU`
2. Go to **ExamMarks** tab
3. Check that marks are saved with:
   - Correct `ce` (internal) values
   - Correct `te` (external) values
   - Correct `total` (ce + te)
   - Correct `grade` based on percentage

## Technical Details

### Frontend Marks Structure
```javascript
{
  examId: "TERM1_STD6A_ENGLISH",
  marks: [
    {
      admNo: "1001",
      studentName: "John Doe",
      internal: 18,  // ← Frontend uses 'internal'
      external: 72   // ← Frontend uses 'external'
    }
  ]
}
```

### Backend Processing
```javascript
// Now accepts BOTH naming conventions:
const ce = parseInt(studentMark.ce || studentMark.internal) || 0;
const te = parseInt(studentMark.te || studentMark.external) || 0;

// Stores in sheet as:
// ce | te | total | grade
// 18 | 72 |  90   | A+
```

### Why This Works
- **Backward Compatibility**: If old code sends `ce`/`te`, it still works
- **Forward Compatibility**: New code sending `internal`/`external` now works
- **No Breaking Changes**: Existing marks in the sheet remain valid

## Current Deployment Status
- ✅ Code fixed in local repository: `d:\Backup app\1610\AyathanWorkflow\Appscript\ExamManager.gs`
- ⏳ **ACTION NEEDED**: Deploy to Google Apps Script (follow steps above)
- ⏳ **TEST**: Verify marks submission works after deployment

## Support
If the issue persists after deployment:
1. Check browser console (F12) for detailed error messages
2. Check Google Apps Script logs: **Executions** tab in Apps Script editor
3. Verify the deployment URL is correct in `frontend/src/api.js`
4. Clear browser cache and try again

## Version History
- **Version 127** (Current): Uses `ce`/`te` only → ❌ Broken
- **Version 128** (New): Accepts both `ce`/`te` AND `internal`/`external` → ✅ Fixed
