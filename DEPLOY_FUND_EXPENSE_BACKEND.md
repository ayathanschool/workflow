# Deploy Fund Collection & Expense Management Backend

## Current Issue
You're getting `"Unknown action: getStudentsForClass"` because the updated code is only in your local file. You need to deploy it to Google Apps Script.

## Deployment Steps

### Method 1: Manual Deployment via Web Interface

1. **Open Google Apps Script Editor:**
   - Go to: https://script.google.com
   - Sign in with your Google account
   - Find and open your school management project

2. **Update MainApp.gs:**
   - In the Files panel (left side), click on **MainApp.gs**
   - Select ALL the existing code (Ctrl+A)
   - Delete it
   - Open your local file: `d:\www\wwww\Appscript\MainApp.gs`
   - Copy ALL the content (Ctrl+A then Ctrl+C)
   - Paste into the Apps Script editor (Ctrl+V)
   - Click **Save** (disk icon or Ctrl+S)

3. **Deploy the Updated Version:**
   - Click **Deploy** → **Manage deployments**
   - Find your existing deployment (Web app)
   - Click the **Edit** icon (pencil) on the right
   - Under "Version", select **New version**
   - Description: "Added Fund & Expense Management endpoints"
   - Click **Deploy**
   - Copy the Web App URL (should be the same)

4. **Verify Deployment:**
   - Wait 30-60 seconds for changes to propagate
   - Test this URL in your browser:
   ```
   https://script.google.com/macros/s/AKfycbyCKJuK19sa4ibM_YrkqSNYj2KgYLmsRLiEqKyx96vUN6NSnsmFFZ6kfqo_HM5fK18Ipw/exec?action=getStudentsForClass&class=1A
   ```
   - You should see: `{"success":true,"class":"1A",...}`
   - If you still see "Unknown action", wait another minute and try again

### Method 2: Using clasp (Command Line)

If you have clasp installed:

```powershell
cd d:\www\wwww\Appscript
clasp push
clasp deploy --description "Fund & Expense Management"
```

## Files That Need Deployment

Make sure ALL these files are deployed to Apps Script:

- ✅ **MainApp.gs** (updated with new endpoints)
- ✅ **FundCollectionManager.gs** (new file)
- ✅ **ExpenseManager.gs** (new file)
- ✅ **FinancialApprovalManager.gs** (new file)
- ✅ **Config.gs** (updated with new sheet configs)

## Verification Checklist

After deployment, verify these endpoints work:

1. **Classes endpoint:**
   ```
   ?action=getAllClasses
   ```
   Should return: `["1A","2A","3A",...]`

2. **Students endpoint:**
   ```
   ?action=getStudentsForClass&class=1A
   ```
   Should return: `{"success":true,"students":[...]}`

3. **Fund requests endpoint:**
   ```
   ?action=getTeacherFundRequests&email=teacher@school.com
   ```
   Should return: `{"success":true,"requests":[]}`

## Common Issues

### "Unknown action" persists
- Wait 1-2 minutes after deployment for changes to propagate
- Clear your browser cache (Ctrl+Shift+Delete)
- Try in incognito/private window
- Verify you deployed the correct project (check URL matches .env.local)

### "Reference Error: getStudentsForClass is not defined"
- You need to deploy **FundCollectionManager.gs** file
- Go to Apps Script, click **+** → Add file → Paste FundCollectionManager.gs
- Save and redeploy

### "Cannot read property 'data' of undefined"
- The Students sheet might be empty or missing
- Check if your spreadsheet has a "Students" sheet with data
- Column names should match Config.gs expectations

## Next Steps After Deployment

Once deployment is successful:

1. Refresh your frontend (Ctrl+F5)
2. Navigate to Fund Collection → Create Request
3. Select a class (e.g., 1A)
4. Students should load automatically
5. Fill the form and create your first request!

## Need Help?

If deployment fails:
1. Check the Apps Script execution log (View → Logs)
2. Look for syntax errors or missing functions
3. Verify all 5 manager files are present in the project
4. Check that the Web App is deployed with "Anyone" access
