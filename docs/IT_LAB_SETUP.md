# IT Lab Semi-Automatic Substitution Setup

## Overview
This feature helps generate draft substitutions for IT Lab periods where 50% of students go to the lab and 50% stay in the classroom. The system suggests free teachers, but **HM must review and approve** before submission.

## Setup Instructions

### 1. Update Timetable Sheet
1. Open your Google Sheet
2. Go to the **Timetable** tab
3. Add a new column header: **`isITLab`**
4. For each IT Lab period row, enter **`TRUE`** in the `isITLab` column
5. Save the sheet

### 2. Create IT Lab Drafts Sheet
1. In your Google Sheet, create a new sheet named: **`IT Lab Drafts`**
2. Add these column headers (in this exact order):
   - `date`
   - `period`
   - `class`
   - `subject`
   - `absentTeacher`
   - `suggestedTeacher`
   - `status`
   - `notes`

### 3. Deploy Updated Code
1. Copy the entire updated `Code.gs` file
2. Open your Apps Script project
3. Replace the content
4. Click **Deploy > New deployment**
5. Deploy as **Version 30**
6. Copy the new deployment URL (if changed)

### 4. (Optional) Enable Daily Auto-Generation
If you want drafts to be automatically generated every morning at 6 AM:

1. In Apps Script Editor, select the function: **`setupITLabDailyTrigger`**
2. Click **Run**
3. Authorize if prompted
4. This will create a daily trigger at 6 AM

## Workflow

### For HM Users:

#### Step 1: Generate Drafts
- Click "Generate IT Lab Drafts" button (or drafts are auto-generated at 6 AM)
- System finds all IT Lab periods for the selected date
- System suggests free teachers for classroom supervision
- Drafts are saved with status: `pending`

#### Step 2: Review Drafts
- View all pending drafts in a table
- See suggested teacher for each period
- Check if suggestions are appropriate

#### Step 3: Modify (if needed)
- If you don't like a suggested teacher, click "Change Teacher"
- See list of all available free teachers for that period
- Select a different teacher

#### Step 4: Submit
- Click "Submit" button to approve all drafts
- Approved drafts become actual substitutions
- Draft status changes to `submitted`
- Your name is recorded as the creator

## API Endpoints

### 1. Generate Drafts
```javascript
{
  action: "generateITLabDrafts",
  date: "2025-10-28"  // Optional, defaults to today
}
```

### 2. Get Drafts
```javascript
{
  action: "getITLabDrafts",
  date: "2025-10-28"  // Optional, returns all pending if not specified
}
```

### 3. Update Draft
```javascript
{
  action: "updateITLabDraft",
  draftId: "3",  // Row index
  newTeacher: "Teacher Name"
}
```

### 4. Get Free Teachers
```javascript
{
  action: "getFreeTeachers",
  date: "2025-10-28",
  period: "3"
}
```

### 5. Submit Drafts
```javascript
{
  action: "submitITLabDrafts",
  date: "2025-10-28",
  userName: "Principal Name"
}
```

## Key Features

✅ **Semi-Automatic** - System suggests, HM approves  
✅ **Safe** - Drafts are separate from actual substitutions  
✅ **Flexible** - HM can change any suggestion  
✅ **Smart** - Automatically finds free teachers  
✅ **Auditable** - HM's name recorded on submission  
✅ **No Duplicates** - Checks existing substitutions  
✅ **Optional Auto-generation** - Daily drafts at 6 AM (optional)

## Troubleshooting

### "No IT Lab periods for this day"
- Check that `isITLab` column exists in Timetable sheet
- Verify that IT Lab periods are marked with `TRUE`
- Ensure the day of week matches

### "NO FREE TEACHER" in suggestions
- All teachers are busy for that period
- HM must manually assign a teacher or skip that period

### Drafts not appearing
- Check that "IT Lab Drafts" sheet exists
- Verify column headers match exactly
- Check browser console for errors

## Notes

- Drafts are NOT substitutions until HM submits them
- Drafts can be deleted manually from the sheet
- Only `pending` status drafts will be submitted
- System won't create duplicates (checks both substitutions and existing drafts)
