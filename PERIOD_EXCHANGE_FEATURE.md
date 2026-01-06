# Period Exchange Feature

## Overview
The Period Exchange system allows two teachers to formally swap their teaching periods. Unlike one-way substitutions (where one teacher is absent), exchanges are mutual swaps where both teachers remain active but teach each other's classes.

## Use Case Example

**Scenario:** Teachers want to adjust their schedule to complete syllabus portions

- **Teacher A (Shilpa)**: Has Period 3 with 6A teaching English
- **Teacher B (Deepa)**: Has Period 3 with 7B teaching Hindi

**Exchange:** They swap periods for a specific date
- **Result:** 
  - Shilpa teaches 7B Hindi in Period 3
  - Deepa teaches 6A English in Period 3
  - Both are marked as BUSY during Period 3
  - Both are FREE during their original scheduled periods

## Database Schema

### PeriodExchanges Sheet
| Column | Description |
|--------|-------------|
| date | Date of exchange (YYYY-MM-DD) |
| teacher1Email | First teacher's email |
| teacher1Name | First teacher's name |
| period1 | First teacher's original period number |
| class1 | First teacher's original class |
| subject1 | First teacher's original subject |
| teacher2Email | Second teacher's email |
| teacher2Name | Second teacher's name |
| period2 | Second teacher's period number |
| class2 | Second teacher's class |
| subject2 | Second teacher's subject |
| note | Optional note/reason for exchange |
| createdBy | Who created this exchange |
| createdAt | Timestamp |

## API Functions

### 1. Create Period Exchange
```javascript
createPeriodExchange({
  date: '2026-01-05',
  teacher1Email: 'shilpa@ayathanschool.com',
  teacher1Name: 'Shilpa',
  period1: '3',
  class1: '6A',
  subject1: 'English',
  teacher2Email: 'deepa@ayathanschool.com',
  teacher2Name: 'Deepa',
  period2: '3',
  class2: '7B',
  subject2: 'Hindi',
  note: 'Completing syllabus portions',
  createdBy: 'hm@ayathanschool.com'
})
```

### 2. Get Exchanges for Date
```javascript
getPeriodExchangesForDate('2026-01-05')
// Returns: { date, exchanges: [...] }
```

### 3. Delete Period Exchange
```javascript
deletePeriodExchange({
  date: '2026-01-05',
  teacher1Email: 'shilpa@ayathanschool.com',
  teacher2Email: 'deepa@ayathanschool.com',
  period1: '3',
  period2: '3'
})
```

## How It Works

### 1. Free Teacher Logic (`getAvailableTeachers`)
When checking who's free for Period 3:
- ✅ **Shilpa**: Originally scheduled → Now FREE (period exchanged away)
- ✅ **Deepa**: Originally scheduled → Now FREE (period exchanged away)
- ❌ **Other teachers**: If they're taking exchange periods → BUSY

### 2. Teacher Daily Timetable (`getTeacherDailyTimetable`)
For Shilpa on exchange day:
- ❌ Removes: Period 3, 6A, English (exchanged away)
- ✅ Adds: Period 3, 7B, Hindi (exchange period)
- Shows `isExchange: true` flag

### 3. HM Live View (`getDailyTimetableWithSubstitutions`)
Shows the complete picture:
- Period 3, 6A: Shows Deepa (marked as exchange)
- Period 3, 7B: Shows Shilpa (marked as exchange)
- Includes `isExchange` flag and `exchangeNote`

## Integration with Substitution System

### Priority Order
When processing a period slot:
1. **Check for Substitution** (teacher absent)
2. **Check for Exchange** (if no substitution)
3. **Use Regular Timetable** (if no substitution or exchange)

### Combined Scenarios
- ✅ **Exchange + Later Absence**: Teacher can be in an exchange, then later be marked absent (substitution overrides exchange)
- ✅ **Multiple Exchanges**: Same teacher can have multiple exchanges on different periods
- ❌ **Cannot Double-Book**: A teacher cannot exchange the same period twice

## Frontend Integration

### API Endpoints
```
GET ?action=createPeriodExchange&date=...&teacher1Email=...&period1=...
GET ?action=getPeriodExchangesForDate&date=2026-01-05
GET ?action=deletePeriodExchange&date=...&teacher1Email=...
```

### Display in UI
```javascript
if (period.isExchange) {
  // Show exchange indicator
  // Display: "📊 Exchange: Originally [teacher]'s class"
  // Show note if present
}
```

## Benefits

1. **Accurate Tracking**: System knows exactly who's teaching what
2. **Correct Free Teacher List**: Teachers show as available when their period is exchanged
3. **Syllabus Flexibility**: Teachers can adjust schedules to complete portions
4. **Audit Trail**: All exchanges recorded with timestamps and reasons
5. **No Manual Timetable Updates**: Temporary changes without modifying base timetable

## Examples

### Example 1: Same Period Swap
```javascript
// Both have Period 3, different classes
{
  teacher1: { email: 'shilpa@...', period: 3, class: '6A', subject: 'English' },
  teacher2: { email: 'deepa@...', period: 3, class: '7B', subject: 'Hindi' }
}
// Result: They swap classes for that period
```

### Example 2: Different Period Swap
```javascript
// Shilpa has P3, Deepa has P5
{
  teacher1: { email: 'shilpa@...', period: 3, class: '6A', subject: 'English' },
  teacher2: { email: 'deepa@...', period: 5, class: '7B', subject: 'Hindi' }
}
// Result: 
// - P3, 6A: Deepa teaches English
// - P5, 7B: Shilpa teaches Hindi
```

## Notes

- Exchanges are date-specific (not recurring)
- Both teachers must have valid timetable entries for their periods
- HM or authorized users can create exchanges
- Teachers see exchange periods in their daily timetable
- Daily reports should be marked for the ACTUAL class taught (after exchange)
