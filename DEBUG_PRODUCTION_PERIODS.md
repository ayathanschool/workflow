# Debug Steps for Production Period Loading Issue

## Quick Diagnostics

### 1. Check Browser Console
Open browser DevTools (F12) and check:

```javascript
// Look for these log messages in Console tab:
- "Loading available periods with params:"
- "Available periods response:"
```

**What to look for:**
- Are `class` and `subject` parameters being sent?
- Is the response showing `success: true` or `success: false`?
- What does `availableSlots` array contain?

### 2. Check Network Tab
1. Open DevTools → Network tab
2. Click on the session to create lesson plan
3. Find the request to `script.google.com/macros/s/AKfy...`
4. Check **Query String Parameters**:
   - Should have: `class=STD 9A` and `subject=Malayalam`

### 3. Check AppScript Logs
1. Go to https://script.google.com
2. Open your project
3. Click **Executions** (left sidebar)
4. Find the most recent execution
5. Check logs for:
   ```
   Getting available periods for [email] - Class: STD 9A, Subject: Malayalam
   ```

## Potential Issues

### Issue A: Timetable Data Mismatch
Your timetable might have different formatting for class/subject.

**Check:**
```javascript
// In Google Sheet Timetable tab:
- Column "class": Is it "STD 9A" or "9A" or "IX A"?
- Column "subject": Is it "Malayalam" exactly?
```

### Issue B: Case Sensitivity
The code uses `.toLowerCase().trim()` but original values might not match.

**Example:**
- Scheme has: `class: "STD 9A"`
- Timetable has: `class: "9A"` ← Won't match!

### Issue C: Deployment Cache
Even though deployment ID is correct, AppScript might be serving cached version.

**Fix:**
1. Go to https://script.google.com
2. Deploy → **New deployment** (don't edit existing)
3. Select type: **Web app**
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy NEW deployment URL
8. Update `.env` file with new URL
9. Rebuild frontend: `npm run build`

## Immediate Fix

Add debug logging to see what's being compared:

1. Open Apps Script Editor
2. Find `SchemeLessonManager.gs` line ~695
3. Add this after the filtering line:

```javascript
Logger.log(`Filtering periods for class: ${schemeClass}, subject: ${schemeSubject}`);

// ADD THIS:
Logger.log(`Teacher has ${teacherTimetable.length} total periods`);
teacherTimetable.forEach(slot => {
  Logger.log(`  Period: class="${slot.class}" subject="${slot.subject}" day="${slot.dayOfWeek}" period="${slot.period}"`);
});
Logger.log(`After filtering for ${schemeClass}/${schemeSubject}: checking matches...`);

// Then continue with existing code...
const dayPeriods = teacherTimetable.filter(slot => {
```

4. Save and deploy new version
5. Try again and check Executions log

## Most Likely Cause

**Class name format mismatch!**

Your scheme might say `"STD 9A"` but timetable says `"9A"`.

**Quick Test:**
1. Open Google Sheet
2. Go to Timetable tab
3. Find a row for this teacher teaching Malayalam to 9A
4. Check EXACTLY what's in the "class" column
5. Compare with what's in Schemes "class" column

If they don't match EXACTLY (including spaces, capitalization), the filter will return 0 periods.

## SessionDependencies: When It Populates

- Purpose: Tracks cascading impacts when a session is not fully completed (e.g., Session 1 incomplete affects Session 2).
- Automatic trigger: On session completion updates via API (`updateSessionCompletion`) when `completionPercentage < 100`.
- What happens: `_trackSessionDependencies()` appends an entry linking the incomplete `prerequisiteSession` to each `dependentSession`, with `impactLevel`, `recommendedAction`, and timestamp.
- Batch backfill: Admin/HM can populate from historical DailyReports using the `syncSessionDependenciesFromReports` API route.
- Recommended schedule: Optional nightly cron trigger to run `syncSessionDependenciesFromReports()` for consistency.

If the sheet is empty, likely causes:
- No incomplete sessions have been submitted yet.
- The `updateSessionCompletion` flow isn’t being used (teachers not reporting).
- The batch sync hasn’t been run after importing historical reports.
