# Lesson Plan Dropdown Issue Fix

## Problem Description

**Issue**: Nimjusha (class teacher for STD 10B) could not see approved schemes for STD 10A Malayalam in the lesson plan preparation dropdown, even though she teaches that class according to her timetable.

**Root Cause**: The approved schemes filtering logic was based on the teacher's **user profile assignments** (classes and subjects in the Users sheet) rather than their **actual timetable assignments**.

## Data Analysis

### Schemes Data
```
schemeId: d4331b7f-09d8-4907-826d-7bc2fc102181
teacherEmail: nimjusha@ayathanschool.com
class: STD 10A
subject: Malayalam
status: Approved
```

### User Profile vs Timetable Assignment
- **User Profile**: Nimjusha is class teacher for STD 10B
- **Timetable Assignment**: Nimjusha teaches STD 10A Malayalam according to timetable
- **Problem**: Dropdown filtering used user profile instead of timetable assignments

## Solution Implemented

### 1. Modified Filtering Logic in `App.jsx` (LessonPlansView)

**Before**:
```javascript
// Filtered based on user.classes and user.subjects from user profile
approved = allSchemes.filter(scheme => {
  const matchesClass = user.classes.some(cls => normKeyLocal(cls) === normKeyLocal(scheme.class));
  const matchesSubject = user.subjects.some(subj => normKeyLocal(subj) === normKeyLocal(scheme.subject));
  return matchesClass && matchesSubject && String(scheme.status || '').toLowerCase() === 'approved';
});
```

**After**:
```javascript
// Filter based on teacher's actual timetable assignments
if (Array.isArray(timetableData) && timetableData.length > 0) {
  // Get unique class-subject combinations from timetable
  const timetableAssignments = new Set();
  timetableData.forEach(slot => {
    if (slot.class && slot.subject) {
      timetableAssignments.add(`${normKeyLocal(slot.class)}|${normKeyLocal(slot.subject)}`);
    }
  });
  
  // Filter approved schemes to include those matching timetable assignments
  approved = allSchemes.filter(scheme => {
    const isApproved = String(scheme.status || '').toLowerCase() === 'approved';
    const matchesTimetable = timetableAssignments.has(`${normKeyLocal(scheme.class)}|${normKeyLocal(scheme.subject)}`);
    return isApproved && matchesTimetable;
  });
}
```

### 2. Added Debug Logging

Added console logging to help diagnose similar issues in the future:
- Teacher timetable assignments
- Available approved schemes
- Filtered approved schemes for lesson preparation

### 3. Fallback Logic

Maintained backward compatibility with fallback to user profile assignments if timetable data is not available.

## Key Improvements

1. **Timetable-Based Filtering**: Now uses actual teaching assignments from timetable
2. **Real-World Accuracy**: Reflects what teachers actually teach, not just their profile assignments
3. **Class Teacher Flexibility**: Class teachers can prepare lessons for any subject in classes they actually teach
4. **Debugging Support**: Added logging for easier troubleshooting

## Testing Verification

After the fix:
- Nimjusha should see STD 10A Malayalam approved scheme in lesson plan preparation dropdown
- Other teachers will see schemes based on their actual timetable assignments
- System maintains backward compatibility for edge cases

## Files Modified

- `frontend/src/App.jsx`: Modified approved schemes filtering logic in LessonPlansView component (lines ~1240-1270)

## Related Issues

This fix addresses the broader issue of ensuring that lesson plan preparation reflects real teaching assignments rather than administrative role assignments, which is especially important for:
- Class teachers who teach multiple subjects
- Teachers assigned to multiple classes
- Dynamic timetable changes during the academic year