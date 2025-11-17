# URGENT: Update API URL

## After you deploy to Google Apps Script:

1. Copy the NEW deployment URL from Google Apps Script
2. Replace line 4 in `frontend/src/api.js` with your new URL:

```javascript
const BASE_URL = 'YOUR_NEW_DEPLOYMENT_URL_HERE';
```

## Example:
If your new URL is: 
`https://script.google.com/macros/s/AKfycbx123.../exec`

Replace line 4 with:
```javascript
const BASE_URL = 'https://script.google.com/macros/s/AKfycbx123.../exec';
```

## Test Steps:
1. Save the file
2. Refresh your browser at http://localhost:5173
3. Login and check if errors are gone
4. Look for "Session Tracking" in navigation (Teacher role)
5. Look for "Teacher Performance" and "Session Analytics" in navigation (HM role)