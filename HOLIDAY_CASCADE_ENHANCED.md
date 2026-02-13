# Enhanced Holiday Cascading System

## Overview
When today is declared as a holiday, all lesson plans scheduled for today need to be rescheduled to the next available working day. The cascading system has been **significantly enhanced** to properly handle this scenario.

## What Changed?

### Previous Behavior ❌
- Only updated the **date** of lesson plans
- Did NOT update the **period**
- Could result in conflicts:
  - Teacher might not have that period on the new date
  - Period slot might already be occupied by another lesson
  - Teachers with multiple periods for same class/subject in a day were not handled properly

### New Behavior ✅
- Updates **both date AND period** for lesson plans
- Uses `getNextAvailablePeriodForLessonPlan()` to find the proper slot
- Checks teacher's timetable for the specific class/subject
- Ensures the slot is not already occupied
- Handles teachers with multiple periods per day correctly
- Cascade history now stores old and new period information

## Key Features

### 1. Smart Period Selection
When cascading a lesson plan:
1. Finds the next working day (skips weekends and holidays)
2. Searches for the teacher's next available period for that class/subject
3. Checks if the period slot is free (not already occupied)
4. Updates both date AND period in the lesson plan

### 2. Handles Edge Cases
- Teachers with 2+ periods for the same subject/class in a day ✓
- Occupied period slots ✓
- Teachers without periods on the next day ✓
- Weekend and holiday skipping ✓

### 3. Error Tracking
- If a lesson cannot be rescheduled (no available slot found), it's logged in the errors array
- Audit log includes both successful and failed reschedules
- Console logging shows which lessons were successfully moved and which failed

## How to Use

### Option 1: Declare Today as Holiday & Auto-Cascade (Easiest!)
```javascript
// Declare today as holiday and automatically cascade all lessons
declareTodayAsHoliday('Sudden rain/emergency', userEmail, userName)

// Or without user info (uses system defaults)
declareTodayAsHoliday('Sudden rain/emergency')
```
This single function will:
- Add today to the UndeclaredHolidays sheet
- Find all lesson plans scheduled for today
- Reschedule each to the next available period on the next working day

### Option 2: Cascade Today's Lessons Only
```javascript
// Without parameters (uses system defaults)
cascadeTodaysLessonsToNextDay()

// Or with user credentials
cascadeTodaysLessonsToNextDay(userEmail, userName)
```
This will automatically:
- Get today's date
- Find all lesson plans scheduled for today
- Reschedule each to the next available period on the next working day

### Option 3: Cascade from a Specific Date
```javascript
// Cascade all lessons from a specific date onwards
cascadeLessonPlansFromDate('2026-02-12', userEmail, userName)
```

### Option 4: From UI (if integrated)
When declaring today as an undeclared holiday in the UI, the system should automatically call `declareTodayAsHoliday()`.

## API Functions

### declareTodayAsHoliday(reason, userEmail, userName)
**Easiest way to declare a sudden holiday and cascade lessons**

Combines holiday declaration + cascading in one call:
1. Adds today to UndeclaredHolidays sheet
2. Automatically calls cascadeTodaysLessonsToNextDay()
3. Returns both holiday info and cascade results

**Parameters:**
- `reason` (string): Reason for the holiday
- `userEmail` (optional): User email declaring the holiday
- `userName` (optional): User name

**Returns:**
```javascript
{
  ok: true,
  holiday: {
    holidayId: 'HOL_1739395200000',
    date: '2026-02-13',
    reason: 'Sudden rain/emergency',
    declaredBy: 'admin@school.com'
  },
  cascadeResult: {
    ok: true,
    affectedCount: 15,
    errorCount: 0,
    message: '...'
  },
  message: 'Declared 2026-02-13 as holiday and cascaded 15 lesson plans'
}
```

### cascadeTodaysLessonsToNextDay(userEmail, userName)
**Quick cascade of today's lessons without declaring holiday**

### cascadeLessonPlansFromDate(startDate, userEmail, userName)
**Cascade from a specific date**

## Return Value

```javascript
{
  ok: true,
  affectedCount: 15,        // Number of lessons successfully rescheduled
  updatedLessons: 15,       // Same as affectedCount
  errorCount: 2,            // Number of lessons that couldn't be rescheduled
  errors: [                 // Details of failed reschedules
    {
      lessonId: 'LP_123',
      class: '10A',
      subject: 'Mathematics',
      teacher: 'teacher@school.com',
      oldDate: '2026-02-12',
      error: 'No available period found'
    }
  ],
  holidays: ['2026-02-12'], // List of holiday dates being skipped
  message: 'Successfully cascaded 15 lesson plans to next day. 2 lessons could not be rescheduled.'
}
```

## Cascade History

The `CascadeHistory` sheet now stores:
- `cascadeId`: Unique ID for the cascade operation
- `oldDate`, `newDate`: Date changes
- **`oldPeriod`, `newPeriod`**: Period changes (NEW!)
- `teacherEmail`, `class`, `subject`: Lesson details
- `status`: 'cascaded' or 'undone'

## Undo Cascade

If a cascade operation needs to be undone:

```javascript
undoCascade(cascadeId, userEmail, userName)
```

This will restore **both dates AND periods** to their original values.

## Example Scenario

### Before Cascade:
```
Date: 2026-02-12 (Wednesday - declared as holiday)
Lessons scheduled:
- 10A Mathematics P2 (Teacher: john@school.com)
- 10B Science P4 (Teacher: mary@school.com)
- 10A Mathematics P5 (Teacher: john@school.com)  // Same day, 2nd period!
```

### After Cascade:
```
Date: 2026-02-13 (Thursday - next working day)
Rescheduled to:
- 10A Mathematics P2 → Thursday P2 (if available)
- 10B Science P4 → Thursday P3 (if P4 was occupied)
- 10A Mathematics P5 → Thursday P5 (if available)
  OR Friday P2 (if Thursday slots are full)
```

Each lesson finds its own next available slot, properly handling multiple periods per day.

## Technical Details

### Required Sheets
The system requires these sheets to be configured:
1. **UndeclaredHolidays** - Stores holiday declarations
   - Columns: `holidayId`, `date`, `reason`, `status`, `declaredBy`, `declaredAt`, `createdAt`
2. **CascadeHistory** - Stores cascade operations
   - Columns: includes `oldPeriod`, `newPeriod` (NEW!)
3. **LessonPlans** - Must have `selectedDate` and `selectedPeriod` columns

### Dependencies
- Uses `getNextAvailablePeriodForLessonPlan()` from SchemeLessonManager.gs
- Uses `getNextWorkingDay()` to skip weekends and holidays
- Uses `getAvailablePeriodsForLessonPlan()` to check timetable and occupancy

### Sheet Updates
1. **Config.gs**: 
   - Added `UndeclaredHolidays` sheet definition
   - Updated `CascadeHistory` headers to include `oldPeriod` and `newPeriod`
2. **HolidayManager.gs**: 
   - Enhanced `cascadeLessonPlansFromDate()` function
   - Enhanced `undoCascade()` function
   - Added `cascadeTodaysLessonsToNextDay()` convenience function
   - Added `declareTodayAsHoliday()` all-in-one function
   - Improved error handling in `getUndeclaredHolidays()`
3. **appsscript.json**:
   - Added `userinfo.email` OAuth scope (optional)

## Important Notes

⚠️ **For Teachers with Multiple Periods per Day:**
The system correctly handles this by finding the next available slot for each individual lesson plan. If a teacher has 2 periods for the same class/subject on the holiday, both lessons will be independently rescheduled to their next available slots.

⚠️ **No Available Slots:**
If no available period is found within the next 30 days (the search window), the lesson will be logged in the errors array and will NOT be rescheduled. Manual intervention may be needed.

⚠️ **Completed Lessons:**
Lessons with status 'completed' or 'Completed' are automatically skipped and not cascaded.

## Testing Recommendations

1. Create a test holiday on a date with multiple lesson plans
2. Ensure teachers have multiple periods for the same class/subject
3. Run `cascadeTodaysLessonsToNextDay()`
4. Verify:
   - Both dates and periods are updated
   - No conflicts with existing lesson plans
   - Error array captures any failures
   - Cascade history is properly recorded
5. Test undo functionality

## Future Enhancements

Possible improvements:
- Batch notification to teachers about rescheduled lessons
- UI preview of cascade changes before applying
- Configurable search window (currently 30 days)
- Priority-based rescheduling (urgent lessons first)
