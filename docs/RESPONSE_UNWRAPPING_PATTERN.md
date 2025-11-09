# API Response Unwrapping Pattern

## 🎯 **Critical Pattern to Remember**

All API responses in this application are wrapped by the backend:

```javascript
// Backend response structure (_respond function):
{
  status: 200,
  data: { ok: true, submitted: true, ... },  // ← Actual response data
  timestamp: "2025-11-04T05:27:08.551Z"
}
```

## ✅ **Correct Pattern (Always Use This)**

```javascript
// Step 1: Call API
const response = await api.someFunction(...);

// Step 2: Unwrap the response
const result = response.data || response;

// Step 3: Use the unwrapped result
if (result.ok) {
  // Success handling
} else if (result.error) {
  // Error handling
}
```

## ❌ **Incorrect Pattern (Causes "Failed" errors)**

```javascript
const response = await api.someFunction(...);

// DON'T check response.ok directly!
if (response.ok) {  // ❌ This will always be false/undefined
  // This never executes even if submission succeeded
}
```

## 🔍 **How to Identify This Issue**

**Symptoms:**
- Frontend shows "Failed to submit..." error
- But sheet/database shows data was successfully saved
- Console shows `{status: 200, data: {...}, timestamp: ...}`

**Solution:**
Add response unwrapping: `const result = response.data || response;`

## 📋 **Files Already Fixed**

| File | Function | Status |
|------|----------|--------|
| `App.jsx` | Scheme submission (line ~1048) | ✅ Fixed |
| `DailyReportTimetable.jsx` | Daily report submission (line 300) | ✅ Fixed |
| `SchemeLessonPlanning.jsx` | Lesson plan creation (line 263) | ✅ Already correct |

## 🚨 **Files That May Need Checking**

When adding new API calls or if you encounter similar issues:

1. **App.jsx** - `submitLessonPlanDetails` (line ~1636-1649)
   - Currently checks `res.error` - may need unwrapping
   
2. **ExamManagement.jsx** - Various exam submission handlers
   - Check if they unwrap responses properly

3. **Any new submission handlers** you add in the future

## 🛠️ **Quick Fix Template**

When you see a "Failed" error but data is saved:

```javascript
// Find this pattern:
const response = await api.someFunction(...);
if (response.ok) { ... }

// Replace with:
const response = await api.someFunction(...);
const result = response.data || response;  // ← Add this line
if (result.ok) { ... }                      // ← Change response to result
```

## 💡 **Why This Happens**

The backend `_respond()` function (in `SheetHelpers.gs`) wraps all responses for consistency:

```javascript
function _respond(obj, status) {
  const response = {
    status: status || 200,
    data: obj,           // ← Your actual response is wrapped here
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
```

This is a good pattern for API consistency, but requires frontend to always unwrap!

## ✨ **Best Practice**

**Always unwrap immediately after API call:**

```javascript
async function handleSubmit() {
  try {
    const response = await api.submitData(data);
    const result = response.data || response;  // ← Do this FIRST
    
    // Now work with result
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.error);
    }
  } catch (err) {
    showError(err.message);
  }
}
```

---

**Last Updated:** November 4, 2025  
**Related Files:** `SheetHelpers.gs`, `api.js`, `App.jsx`, `DailyReportTimetable.jsx`
