# Internal Marks Configuration Documentation

## Overview
The AyathanWorkflow system now automatically determines which classes have internal marks (CE/TE system) based on the academic standard. This document explains the configuration and implementation.

## Class-Based Internal Marks Logic

### Standards WITH Internal Marks (CE + TE)
- **STD 8, STD 9, STD 10**
- These classes use the **Continuous Evaluation (CE) + Terminal Evaluation (TE)** system
- Internal marks include: UT1, UT2, CE, TE
- Default configuration: CE (Internal) = 20 marks, TE (External) = 80 marks, Total = 100 marks

### Standards WITHOUT Internal Marks
- **STD 1, STD 2, STD 3, STD 4, STD 5, STD 6, STD 7**
- These classes only use external/total marks
- No CE/TE breakdown required
- Default configuration: External = 100 marks, Total = 100 marks

## Automatic Detection Function

### `_classHasInternalMarks(className)`
This function automatically determines if a class should have internal marks:

```javascript
function _classHasInternalMarks(cls) {
  if (!cls) return false;
  // Extract number from class name (e.g., "STD 10A" → 10, "9B" → 9)
  const m = String(cls).match(/(\d+)/);
  if (!m) return false;
  const n = Number(m[1]);
  // Return true only for standards 8, 9, 10
  return n >= 8 && n <= 10;
}
```

**Examples:**
- `"STD 10A"` → `true` (has internal marks)
- `"9B"` → `true` (has internal marks)
- `"STD 8"` → `true` (has internal marks)
- `"STD 7A"` → `false` (no internal marks)
- `"5th Grade"` → `false` (no internal marks)

## Enhanced Exam Creation

### Automatic Configuration
When creating exams, the system now:

1. **Automatically detects** if the class needs internal marks
2. **Sets `hasInternalMarks`** flag accordingly
3. **Applies appropriate** marking scheme from GradeTypes

### Manual Override
Teachers and HM can still manually override the `hasInternalMarks` setting if needed.

## Standard Grade Types

### For STD 8, 9, 10 (With Internal Marks)
```
Term 1: Internal=20, External=80, Total=100
Term 2: Internal=20, External=80, Total=100  
Term 3: Internal=20, External=80, Total=100
```

### For STD 1-7 (External Only)
```
Term 1 (Primary): Internal=0, External=100, Total=100
Term 2 (Primary): Internal=0, External=100, Total=100
Term 3 (Primary): Internal=0, External=100, Total=100
```

## Setup Function

### `setupStandardGradeTypes()`
Run this function in Apps Script to automatically create the standard grade type configurations:

```javascript
setupStandardGradeTypes()
```

This will create grade types for all three terms with appropriate internal/external mark distributions.

## ExamMarks Schema

The ExamMarks table includes all necessary columns for both marking systems:

### Fields for ALL Standards
- `examId`, `class`, `subject`, `teacherEmail`, `teacherName`
- `admNo`, `studentName`
- `external`, `total`, `grade`, `createdAt`

### Additional Fields for STD 8, 9, 10 Only
- `ut1` - Unit Test 1 marks
- `ut2` - Unit Test 2 marks  
- `ce` - Continuous Evaluation (internal marks)
- `te` - Terminal Evaluation (external marks)
- `internal` - Combined internal marks (calculated from UT1, UT2, CE)

## Report Card Integration

### Multi-Term Assessment Display
The Report Card system automatically:

1. **Detects class standard** using `_classHasInternalMarks()`
2. **Shows appropriate columns** based on internal marks availability
3. **Displays CE/TE breakdown** for STD 8, 9, 10
4. **Shows only total marks** for STD 1-7

### Role-Based Access
- **HM**: Can see all classes and create/view reports for any standard
- **Class Teachers**: See assigned class reports with appropriate marking scheme
- **Subject Teachers**: See subject-specific reports with correct mark columns

## Implementation Status

### ✅ Completed Features
- [x] Automatic internal marks detection based on class standard
- [x] Enhanced exam creation with class-based logic
- [x] Updated exam update function with auto-detection
- [x] Standard grade types setup function
- [x] Role-based report card generation
- [x] Multi-term assessment display
- [x] ExamMarks schema with UT1, UT2, CE, TE columns

### 🔄 Ready for Testing
- Report card generation for different standards
- Grade type configuration verification
- Internal marks calculation and display
- Term-based exam filtering

## Usage Examples

### Creating Exam for STD 10A
```javascript
// System automatically sets hasInternalMarks = true
createExam({
  class: "STD 10A",
  subject: "Mathematics", 
  examType: "Term 1",
  // hasInternalMarks: automatically set to true
  internalMax: 20,
  externalMax: 80,
  totalMax: 100
})
```

### Creating Exam for STD 5B
```javascript
// System automatically sets hasInternalMarks = false  
createExam({
  class: "STD 5B",
  subject: "Mathematics",
  examType: "Term 1 (Primary)", 
  // hasInternalMarks: automatically set to false
  internalMax: 0,
  externalMax: 100, 
  totalMax: 100
})
```

## Testing Recommendations

1. **Test class detection**: Verify `_classHasInternalMarks()` correctly identifies STD 8, 9, 10
2. **Test exam creation**: Create exams for different standards and verify hasInternalMarks flag
3. **Test report generation**: Generate reports for both primary and secondary standards
4. **Test grade types**: Run `setupStandardGradeTypes()` and verify proper configurations
5. **Test role access**: Verify HM and Class Teachers see appropriate classes and marking schemes

---

**Last Updated**: October 25, 2025  
**Version**: 2.0 - Enhanced with class-based internal marks detection