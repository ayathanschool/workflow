# Simplified Lesson Plan Logic

## Date: 2025-11-12

## Overview
The lesson plan preparation logic has been **simplified** to focus on chapter completion tracking. Teachers can now prepare lesson plans **any day** after completing the previous chapter's last session.

---

## New Logic Rules

### ✅ **Rule 1: Extended Sessions (Always Allowed)**
- **When**: Session number > original scheme session count
- **Example**: Scheme has 3 sessions, preparing session 4 or 5
- **Allowed**: ANY DAY
- **Reason**: `extended_session`

### ✅ **Rule 2: New Chapter After Completion (Core Logic)**
- **When**: Starting Session 1 of a new chapter
- **Requirement**: Previous chapter's **last session** must have "Chapter Complete" marked in DailyReports
- **Example**: 
  - Chapter 1, Session 3 (last) → Daily Report marked "Chapter Complete" ✅
  - Now can prepare Chapter 2, Session 1 → Allowed ANY DAY
- **Allowed**: ANY DAY (after previous chapter completion)
- **Blocked**: If previous chapter not marked complete
- **Reason**: `previous_chapter_completed`
- **Message**: `"New chapter can be prepared any day after completing previous chapter"`

### ✅ **Rule 3: Continuing Same Chapter**
- **When**: Preparing Session 2+ within same chapter
- **Requirement**: Previous session must exist in DailyReports
- **Example**: 
  - Preparing Session 3 → Checks if Session 2 has daily report
- **Allowed**: ANY DAY (if previous session reported)
- **Reason**: `continuing_chapter`
- **Message**: `"Continuing same chapter - session can be prepared any day"`

### ✅ **Rule 4: First Chapter (Special Case)**
- **When**: Teacher has no previous daily reports
- **Allowed**: ANY DAY
- **Reason**: `first_chapter`
- **Message**: `"First chapter of the scheme can be prepared any day"`

---

## Date Range: Till End of Current Month

### Previous Behavior
- Start: Today + 5 days
- End: Start + 7 days
- Example: Nov 12 → Show Nov 17 to Nov 23 (7 days)

### **New Behavior**
- Start: **Today**
- End: **Last day of current month**
- Example: Nov 12 → Show Nov 12 to Nov 30 (19 days)

### Benefits
- More flexible period selection
- Can plan further ahead within same month
- Aligns with monthly academic planning

---

## Period Availability Filter

Periods shown are filtered by:
1. ✅ **Date Range**: Today to end of month
2. ✅ **Weekdays Only**: Monday-Friday (no weekends)
3. ✅ **Matching Class**: Only periods for scheme's class
4. ✅ **Matching Subject**: Only periods for scheme's subject
5. ✅ **Matching Teacher**: Only teacher's own timetable periods
6. ✅ **Not Occupied**: Excludes slots with existing lesson plans

---

## Key Changes from Previous Logic

### Removed ❌
- ~~Preparation day restriction (Monday/Friday)~~
- ~~75% completion threshold checks~~
- ~~Incomplete session continuation logic~~
- ~~Settings-based deferred days and days ahead~~

### Simplified ✓
- **One Rule**: Mark "Chapter Complete" in last session's daily report
- **Any Day**: No day-of-week restrictions
- **Month View**: Show all available periods till month-end

---

## Workflow Example

### Scenario: Teacher Starting New Chapter

**Initial State:**
- Chapter 1 has 3 sessions
- Teacher taught Session 1, 2, 3
- Session 3 (last) → Daily Report submitted with "Chapter Complete" checkbox ✅

**Next Step:**
- Teacher opens Lesson Plan
- Selects Chapter 2, Session 1
- **System Check**: 
  - Is this Session 1? YES
  - Previous chapter completed? YES (Chapter 1 marked complete)
  - **Result**: ✅ ALLOWED ANY DAY

**Period Selection:**
- Shows: Nov 12 to Nov 30 (rest of month)
- Filters: Class 10A, Subject Math, Teacher's periods only
- Teacher selects any available period

**Submission:**
- Lesson plan created for Chapter 2, Session 1
- No day restrictions

---

## Scenario: Teacher Continuing Same Chapter

**Current State:**
- Chapter 1, Session 2 already has daily report
- Now preparing Session 3

**System Check:**
- Is this Session 1? NO (it's Session 3)
- Previous session (Session 2) exists? YES
- **Result**: ✅ ALLOWED ANY DAY (continuing chapter)

---

## Scenario: Extended Session

**Current State:**
- Scheme has 3 sessions for Chapter 1
- All 3 sessions completed
- Chapter 1 NOT marked complete (completion was low)

**Teacher Action:**
- Needs to prepare Session 4 (extended)

**System Check:**
- Is Session 4 > original count (3)? YES
- **Result**: ✅ ALLOWED ANY DAY (extended session)

**Note**: Extended sessions don't require previous chapter completion - they're remedial work for current chapter.

---

## Scenario: Blocked - Previous Chapter Not Complete

**Current State:**
- Chapter 1, Session 3 (last) completed
- Daily report submitted but **"Chapter Complete" NOT checked**

**Teacher Action:**
- Tries to prepare Chapter 2, Session 1

**System Check:**
- Is this Session 1? YES
- Previous chapter completed? NO (no "Chapter Complete" found)
- **Result**: ❌ BLOCKED

**Error Message**: 
> "Previous chapter must be completed (mark 'Chapter Complete' in last session's daily report) before starting new chapter"

**Solution**: 
1. Go back to Chapter 1, Session 3 daily report
2. Check "Chapter Complete" checkbox
3. Submit/update the daily report
4. Now Chapter 2, Session 1 will be allowed

---

## Implementation Details

### Code Location: `SchemeLessonManager.gs`

#### Function: `_isPreparationAllowedForSession()`
- Lines 8-134 (approx)
- Implements 4-tier permission check
- Returns: `{ allowed: boolean, reason: string, message: string }`

#### Function: `_calculateLessonPlanningDateRange()`
- Lines 137-165 (approx)
- Calculates date range till month-end
- Returns: `{ startDate, endDate, preparationDay: 'Any', canSubmit: true }`

### Code Location: `MainApp.gs`

#### Function: `_handleGetApprovedSchemesForLessonPlanning()`
- Lines 719-909 (approx)
- Backup implementation with same month-end logic
- Returns date range with schemes

---

## Configuration Changes

### Settings Sheet (No Longer Used)
The following settings are **no longer consulted** for lesson plan preparation:
- ~~`lessonplan_preparation_day`~~ (previously: Monday/Friday)
- ~~`lessonplan_deferred_days`~~ (previously: 0-5 days)
- ~~`lessonplan_days_ahead`~~ (previously: 7 days)

**Note**: These settings remain in the sheet for backward compatibility but are not used by the new logic.

---

## Testing Checklist

- [ ] First chapter (no previous reports) → Should allow any day
- [ ] Chapter 2, Session 1 with Chapter 1 complete → Should allow any day
- [ ] Chapter 2, Session 1 WITHOUT Chapter 1 complete → Should block
- [ ] Same chapter continuation (Session 2 after Session 1 reported) → Should allow
- [ ] Extended session (beyond scheme count) → Should allow any day
- [ ] Date range shows today to end of month
- [ ] Only weekdays displayed (no Sat/Sun)
- [ ] Periods filtered by class/subject/teacher
- [ ] Occupied slots marked correctly

---

## Benefits of Simplified Logic

1. **✅ Clear Progression**: Must complete chapter before moving forward
2. **✅ Flexibility**: No day-of-week restrictions
3. **✅ Accountability**: Teachers must explicitly mark chapters complete
4. **✅ Extended Planning**: Full month visibility
5. **✅ Reduced Complexity**: Easier to understand and debug
6. **✅ Better UX**: Teachers can plan when it makes sense, not on fixed days

---

## Migration Notes

### Existing Users
- No data migration needed
- Existing lesson plans remain valid
- New logic applies to future lesson plan creation only

### Admins
- Settings sheet values no longer affect lesson plan preparation timing
- "Chapter Complete" checkbox in Daily Reports is now the **key control mechanism**
- Educate teachers to mark chapters complete when last session is done

---

**Implementation Date**: 2025-11-12  
**Status**: ✅ Complete  
**Files Modified**:
- `Appscript/SchemeLessonManager.gs`
- `Appscript/MainApp.gs` (backup implementation)
