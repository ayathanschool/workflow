# Deployment Guide - AyathanWorkflow

## Backend Deployment (Google Apps Script)

### Step 1: Setup Google Sheets
1. Create a new Google Sheets document
2. Note the Spreadsheet ID from the URL
3. The system will auto-create required sheets

### Step 2: Deploy Apps Script
1. Go to [script.google.com](https://script.google.com)
2. Create new project: "AyathanWorkflow"
3. Replace default Code.gs with content from `Appscript/Code.gs`
4. Update line 5: `const SPREADSHEET_ID = 'YOUR_SHEET_ID_HERE';`
5. Save the project (Ctrl+S)

### Step 3: Deploy as Web App
1. Click "Deploy" → "New Deployment"
2. Type: "Web app"
3. Execute as: "Me"
4. Who has access: "Anyone"
5. Click "Deploy"
6. Copy the deployment URL

## Frontend Deployment

### Option 1: Vercel (Recommended)
1. Push frontend folder to GitHub repository
2. Connect Vercel to the repository
3. Set environment variables:
   ```
   REACT_APP_API_URL=your_apps_script_deployment_url
   ```
4. Deploy automatically

### Option 2: Netlify
1. Drag and drop the frontend folder to Netlify
2. Set environment variables in Netlify dashboard
3. Enable automatic deployments

### Option 3: Manual Build
```bash
cd frontend
npm install
npm run build
# Upload build folder to your hosting provider
```

## Configuration

### Update API URL
1. Copy your Google Apps Script deployment URL
2. Update `REACT_APP_API_URL` in environment variables
3. Redeploy frontend

### Setup Users
1. Add users to the Users sheet in Google Sheets
2. Format: email, name, password, roles, classes, subjects, classTeacherFor
3. Roles: "h m", "class teacher", "teacher"

## Testing
1. Open your deployed frontend URL
2. Login with configured user credentials
3. Verify all features work correctly

## Troubleshooting
- Check Google Apps Script execution transcript for backend errors
- Verify CORS settings in Apps Script deployment
- Ensure Spreadsheet ID is correct
- Check user permissions in Google Sheets