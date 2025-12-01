# 🚀 Deploy AI Feature to AppScript Backend

**Status:** Frontend is ready ✅ | Backend needs deployment ⏳

## Error You're Seeing:
```
Failed to get AI suggestions. Try the search buttons instead.
```

**Cause:** The AI functions exist locally but haven't been uploaded to script.google.com

---

## ⚡ Quick Deploy (3 Steps)

### Step 1️⃣: Go to AppScript Editor
1. Open: **https://script.google.com**
2. Find your project: **"Lesson Planning System"** (or whatever you named it)

---

### Step 2️⃣: Add New File - AIHelper.gs

1. Click **"+"** next to **Files**
2. Choose **Script**
3. Name it: `AIHelper`
4. **Paste this entire code:**

```javascript
// Copy from: D:\Backup app\enhanceflow\Appscript\AIHelper.gs
// OR use the content below (pre-filled for you):
```

**⚠️ IMPORTANT:** I'll open the file for you to copy!

---

### Step 3️⃣: Update Config.gs

**Add these 2 lines at the top** (after any header comments):

```javascript
const GEMINI_API_KEY = 'AIzaSyCwYCZJmJ-g8_7RpoiV4lXy-kqixqtfdpI';
const AI_SUGGESTIONS_ENABLED = true;
```

**Example:**
```javascript
// ====== CONFIGURATION ======
const GEMINI_API_KEY = 'AIzaSyCwYCZJmJ-g8_7RpoiV4lXy-kqixqtfdpI';
const AI_SUGGESTIONS_ENABLED = true;
const SPREADSHEET_ID = '1t1PZS...' // your existing config
```

---

### Step 4️⃣: Update MainApp.gs Route

**Find this section** (around line 907):

```javascript
if (action === 'createBulkSchemeLessonPlans') {
  return _respond(createBulkSchemeLessonPlans(data));
}
```

**Add RIGHT AFTER it:**

```javascript
if (action === 'getAILessonSuggestions') {
  return _respond(getAILessonSuggestions(data.context || data));
}
```

---

### Step 5️⃣: Deploy New Version

1. Click **Deploy** → **Manage deployments**
2. Click **✏️ Edit** (pencil icon on active deployment)
3. **Version:** Choose **"New version"**
4. **Description:** `Add AI lesson plan suggestions`
5. Click **Deploy**
6. **✅ Copy the new Web App URL** (if it changed)

---

## 🧪 Test After Deploy

1. Go back to **http://localhost:5173**
2. **Hard refresh:** `Ctrl + Shift + R`
3. Navigate: **Scheme-Based Planning** → Click session
4. Click **"✨ Get AI Suggestions"**
5. Should see: Loading spinner → Fields auto-fill

---

## 🐛 If Still Not Working

**Check Console:**
- Press `F12` → **Console** tab
- Look for errors

**Verify API Key:**
- Go to: https://aistudio.google.com/app/apikey
- Check if key is still active: `AIzaSyCwYCZJmJ-g8_7RpoiV4lXy-kqixqtfdpI`

**Check AppScript Logs:**
1. In script.google.com
2. Click **Executions** (left sidebar)
3. Look for errors when you click the AI button

---

## 📋 Files Changed (For Reference)

### Backend (AppScript):
- ✅ `Config.gs` - Added GEMINI_API_KEY
- ✅ `AIHelper.gs` - **NEW FILE** (200+ lines)
- ✅ `MainApp.gs` - Added route at line ~907

### Frontend (Local):
- ✅ `api.js` - Added getAILessonSuggestions()
- ✅ `SchemeLessonPlanning.jsx` - Added AI button

---

## 🎯 What Happens When It Works

1. User clicks **"✨ Get AI Suggestions"**
2. Frontend sends: `{ action: 'getAILessonSuggestions', context: {...} }`
3. Backend calls: `getAILessonSuggestions()` in AIHelper.gs
4. AIHelper calls: Google Gemini API
5. Gemini returns: JSON with 4 fields
6. Frontend auto-fills:
   - Learning Objectives
   - Teaching Methodology
   - Resources Required
   - Assessment Methods

**Time:** ~2-3 seconds ⚡

---

## Need Help?

Copy the exact error from browser console (F12) if deployment doesn't work!
