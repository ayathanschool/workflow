# ClassSubjects Sheet Setup Guide

## Step 1: Create the Sheet

1. Open your Google Spreadsheet
2. Create a new sheet named exactly: **ClassSubjects**
3. Add the following headers in row 1:
   - Column A: `class`
   - Column B: `subjects`

## Step 2: Add Sample Data

Add rows for each class with comma-separated subjects:

| class | subjects |
|-------|----------|
| Std 1A | English,Malayalam,EVS,Math,Hindi |
| Std 1B | English,Malayalam,EVS,Math,Hindi |
| Std 2A | English,Malayalam,EVS,Math,Hindi |
| Std 3A | English,Malayalam,EVS,Math,Hindi,Social |
| Std 4A | English,Malayalam,Social,Math,Hindi,Science |
| Std 5A | English,Malayalam,Social,Math,Hindi,Science |
| Std 6A | English,Malayalam,Social,Math,Hindi,Science |
| Std 7A | English,Malayalam,Social,Math,Hindi,Science |
| Std 8A | English,Malayalam,Social Studies,Math,Hindi,Physics,Chemistry,Biology |
| Std 9A | English,Malayalam,Social Studies,Math,Hindi,Physics,Chemistry,Biology |
| Std 10A | English,Malayalam,Social Studies,Math,Hindi,Physics,Chemistry,Biology |

## Step 3: Verify the Implementation

1. Open the frontend and navigate to Exam Management
2. Select a class from the dropdown
3. Open browser console (F12)
4. Look for log messages:
   - ✅ `Loaded X subjects from ClassSubjects` - Success!
   - ⚠️ `Found X subjects in timetable` - Falling back to Timetable

## Format Notes

- Class names are flexible: "Std 1A", "1A", "Std1A" all work
- Subjects must be comma-separated with NO spaces after commas (or spaces will be trimmed)
- Subject names should match exactly what teachers use

## Testing the API Directly

You can test if the backend is working by calling:
```javascript
// In browser console on your frontend:
const result = await fetch('YOUR_APPS_SCRIPT_URL?action=getClassSubjects&class=Std 10A');
const data = await result.json();
console.log(data);
```

Expected response:
```json
{
  "data": {
    "success": true,
    "subjects": ["English", "Malayalam", "Social Studies", "Math", "Hindi", "Physics", "Chemistry", "Biology"],
    "source": "ClassSubjects"
  }
}
```

## Troubleshooting

**If subjects still come from Timetable:**
1. Check sheet name is exactly "ClassSubjects" (case-sensitive)
2. Verify headers are exactly "class" and "subjects" (lowercase)
3. Ensure there's at least one data row
4. Check console for error messages
5. Clear browser cache and refresh

**If you see errors:**
- Check Apps Script execution logs for detailed errors
- Verify the sheet is in the same spreadsheet as other sheets
- Ensure MainApp.gs has been deployed with the latest code
