# SchoolFlow - Exam Management & Subject API Updates

## Overview
This document consolidates all updates made to the Exam Management system and Subject API implementation in the SchoolFlow application.

## Recent Updates

### 1. Permission Logic for Class Teachers
**Problem**: Class teachers couldn't view/edit marks for subjects in their class or subjects they teach in other classes.

**Solution**: 
- Fixed permission logic to allow class teachers to view/edit marks for:
  - Subjects in the class they are assigned as class teacher
  - Subjects they teach in other classes
- Implemented proper role normalization to ensure consistent permissions
- Added clear UI indicators for permission-based access

### 2. Hard-Coded Subject Lists Removal
**Problem**: Multiple components had hard-coded subject lists causing confusion when users saw subjects not assigned to them.

**Solution**:
- Removed all hard-coded subject lists from components
- Components now dynamically determine available subjects based on:
  - User role (headmaster, class teacher, regular teacher)
  - User's assigned subjects
  - Class teacher assignments

### 3. Centralized Subject API Implementation
**Problem**: No centralized source for retrieving subjects, leading to inconsistencies across components.

**Solution**: Added a comprehensive Subject API system:

#### Backend (Google Apps Script)
- Added a new `getSubjects` endpoint in `Code.gs`
- The endpoint collects subjects from all data sources:
  - Timetable sheet
  - Exams sheet
  - Schemes sheet
  - Lesson Plans sheet
- Removes duplicates and returns a sorted list

#### API Client
- Added a new `getSubjects()` function in `api.js`
- Returns a Promise that resolves to an array of subject names
- Uses the existing caching mechanism to avoid unnecessary API calls

#### Frontend Components
Updated components to use the new API:
- `src/components/ExamManagement.jsx`
- `src/App.jsx`
- Added fallback mechanisms in all components in case the API call fails

### 4. Component Consolidation
**Problem**: Duplicate ExamManagement components existed causing maintenance issues.

**Solution**:
- Identified and removed duplicate ExamManagement component
- Consolidated to use a single implementation in `src/components/ExamManagement.jsx`
- Removed empty directories and deprecated files

### 5. Codebase Cleanup
**Problem**: Multiple backup files, test fixtures, and temporary files cluttered the repository.

**Solution**: Removed unnecessary files:
- `src/App.jsx.fixed` (backup file)
- `src/components/exams/ExamManagement.deprecated.jsx` (duplicate component)
- `src/tests/substitutionTest.js` (hardcoded test data)
- Various `.txt` documentation files
- Empty directories

### 6. UI Improvements
- Added visual indicators for permission-based access
- Improved error handling and user feedback
- Added loading states for better user experience
- Enhanced UX for empty subject lists

## Technical Implementation Details

### Backend Endpoint Code
```javascript
if (action === 'getSubjects') {
  // Get subjects from multiple sources
  const ttSheet = _getSheet('Timetable');
  const ttHeaders = _headers(ttSheet);
  const ttList = _rows(ttSheet).map(r => _indexByHeader(r, ttHeaders));
  const timetableSubjects = ttList.map(x => String(x.subject || '')).filter(Boolean);
  
  // Get subjects from exams, schemes, lesson plans...
  // Merge all subjects and deduplicate
  const allSubjectsSet = new Set([
    ...timetableSubjects,
    ...examSubjects, 
    ...schemeSubjects,
    ...lessonPlanSubjects
  ]);
  
  const subjects = Array.from(allSubjectsSet).sort();
  return _respond({ subjects });
}
```

### API Client Function
```javascript
export async function getSubjects() {
  return getJSON(`${BASE_URL}?action=getSubjects`)
    .then(result => result.subjects || [])
}
```

### Component Pattern
All updated components follow this pattern:
1. Call the `api.getSubjects()` function
2. Filter results based on user role:
   - **Headmasters**: show all subjects
   - **Class teachers**: show subjects they teach + subjects from their class
   - **Regular teachers**: show only subjects they teach
3. Provide fallback mechanism if API call fails

## Benefits
- ✅ Centralized source of truth for all subjects
- ✅ No more hard-coded subject lists
- ✅ Consistent subject lists across all components
- ✅ Easier maintenance when adding new subjects
- ✅ Improved user experience for all user roles
- ✅ Cleaner, more maintainable codebase
- ✅ Proper permission-based access control

## Current File Structure
```
src/
├── components/
│   ├── ExamManagement.jsx (consolidated, main implementation)
│   ├── AdminTools.jsx
│   ├── Dashboard.jsx
│   └── ... (other components)
├── api.js (includes new getSubjects function)
├── App.jsx (updated to use new API)
└── ... (other core files)
```

## Future Improvements
- Add UI for managing subjects directly from the admin panel
- Implement better caching strategies for API responses
- Add validation to ensure consistent subject naming across sheets
- Add unit tests for the new Subject API functionality
- Consider adding subject categories or groupings