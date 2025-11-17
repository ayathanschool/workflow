# Extended Session Debug Guide

## Current Setup

### Your Data:
- **Scheme**: LUCK chapter, `noOfSessions = 2`
- **Daily Reports**:
  - Session 1: 50% complete
  - Session 2: 45% complete
- **Expected**: Session 3 (Extended) should be creatable

### Code Flow:

1. **Frontend Display** (`getApprovedSchemesForLessonPlanning`):
   - Calls `_generateSessionsForChapter()`
   - Checks daily reports
   - Session 1: 50% < 75% ✓
   - Session 2: 45% < 75% ✓
   - **Result**: `extendedSessionCount = 3` ✓
   - **Shows**: Session 1, 2, 3 (Extended) ✓

2. **Lesson Plan Creation** (`createSchemeLessonPlan`):
   - Gets scheme details via `_getSchemeDetails(schemeId)`
   - Calls `_isPreparationAllowedForSession(chapter, 3, scheme)`
   - **Check**: Is `3 > scheme.noOfSessions (2)`?
   - **Should return**: ALLOWED (extended_session)

## Debug Steps

### Step 1: Verify Scheme Data

Check Google Apps Script logs for:
```
=== FETCHING SCHEME DETAILS ===
Scheme ID: SCH_1762852592249_597
✅ Scheme found:
  - Chapter: LUCK
  - noOfSessions: 2 (type: number)
```

**If `noOfSessions` is NOT 2**: The scheme sheet has wrong data

### Step 2: Verify Permission Check

Check logs for:
```
=== PERMISSION CHECK ===
Chapter: LUCK
Session Number: 3 (type: number)
Original Session Count: 2
Scheme ID: SCH_1762852592249_597
✅ Session 3 is EXTENDED (beyond original 2) - ALLOWED ANY DAY
```

**If Session Number is string "3"**: Type conversion issue
**If Original Session Count is NOT 2**: Scheme data issue
**If "NOT extended" message appears**: Logic issue

### Step 3: Verify Extended Session Generation

Check logs for:
```
=== EXTENDED SESSION CHECK ===
Found 2 daily reports for chapter LUCK
✓ Session 1: 50% complete (sessionNo: 1)
  → Session 1 INCOMPLETE (50% < 75%)
✓ Session 2: 45% complete (sessionNo: 2)
  → Session 2 INCOMPLETE (45% < 75%)
Has incomplete sessions: true
🔄 EXTENDING: Sessions count 2 → 3 (due to incomplete sessions)
```

## Potential Issues & Fixes

### Issue 1: Type Mismatch
**Symptom**: `sessionNumber` is string "3" instead of number 3
**Fix**: Ensure `parseInt()` is called consistently

### Issue 2: Scheme Data Missing
**Symptom**: `noOfSessions` is empty or wrong type
**Fix**: Check Schemes sheet data quality

### Issue 3: Cache/Timing Issue
**Symptom**: Works sometimes, fails others
**Fix**: Clear browser cache, hard refresh

### Issue 4: Frontend Not Passing Session Number
**Symptom**: Session number is undefined
**Fix**: Check frontend code sending the request

## Manual Test

Run this in Apps Script Editor to test the logic:

```javascript
function testExtendedSessionLogic() {
  const scheme = {
    schemeId: 'SCH_1762852592249_597',
    chapter: 'LUCK',
    noOfSessions: 2,
    teacherEmail: 'shilpa@ayathanschool.com',
    class: 'STD 10A',
    subject: 'English'
  };
  
  const chapter = { name: 'LUCK', number: 1 };
  const sessionNumber = 3;
  
  const result = _isPreparationAllowedForSession(chapter, sessionNumber, scheme);
  
  Logger.log('=== TEST RESULT ===');
  Logger.log(`Allowed: ${result.allowed}`);
  Logger.log(`Reason: ${result.reason}`);
  Logger.log(`Message: ${result.message}`);
  
  // Expected:
  // Allowed: true
  // Reason: extended_session
  // Message: Extended session 3 can be prepared any day
}
```

## What to Check in Frontend

1. **Network Tab**: Check the request payload when clicking Session 3
```json
{
  "action": "createSchemeLessonPlan",
  "schemeId": "SCH_1762852592249_597",
  "chapter": "LUCK",
  "session": "3",  // Should be number or string?
  "teacherEmail": "shilpa@ayathanschool.com",
  "selectedDate": "2025-11-13",
  "selectedPeriod": "1"
}
```

2. **Check if `session` is sent as string or number**
3. **Verify `schemeId` matches exactly**

## Expected Log Output (Success Case)

```
=== FETCHING SCHEME DETAILS ===
Scheme ID: SCH_1762852592249_597
Total schemes in sheet: 2
✅ Scheme found:
  - Chapter: LUCK
  - noOfSessions: 2 (type: number)
  - Class: STD 10A
  - Subject: English
  - Teacher: shilpa@ayathanschool.com

=== PERMISSION CHECK ===
Chapter: LUCK
Session Number: 3 (type: number)
Original Session Count: 2
Scheme ID: SCH_1762852592249_597
Scheme noOfSessions: 2
✅ Session 3 is EXTENDED (beyond original 2) - ALLOWED ANY DAY

✅ Preparation allowed: Extended session 3 can be prepared any day (extended_session)

Lesson plan created successfully
```

## Next Steps

1. **Deploy the code** with all the logging
2. **Try to create Session 3 lesson plan**
3. **Check Google Apps Script logs** (Executions → Latest execution → View logs)
4. **Copy the exact logs here**
5. **We'll identify the exact failure point**

The logs will reveal:
- Is scheme data being fetched correctly?
- Is session number being passed correctly?
- Is the comparison `3 > 2` working?
- Where exactly is it failing?

---

**Important**: The logic is sound. The issue is either:
1. Data quality (scheme `noOfSessions` is wrong)
2. Type mismatch (string vs number)
3. Scheme ID mismatch (wrong scheme being fetched)
4. Cache issue (old code still running)

The detailed logs will pinpoint it immediately! 🎯
