# Fund Collection & Expense Management Module

## Overview

This module provides a complete dual-purpose financial management system for schools:
1. **Fund Collection Workflow**: Teachers can request to collect funds from students (e.g., field trips, athletic meets) with multi-step approval
2. **Expense Reimbursement Workflow**: Teachers can submit expense requests for approval and disbursement

## Architecture

### Backend (Google Apps Script)
Located in `/Appscript/` directory:
- **FundCollectionManager.gs**: Handles all fund collection operations
- **ExpenseManager.gs**: Manages expense/reimbursement requests
- **FinancialApprovalManager.gs**: Provides dashboards and analytics
- **Config.gs**: Updated with new sheet definitions

### Frontend (React)
Located in `/frontend/src/components/`:
- **FundCollectionModule.jsx**: Complete UI for fund collection management
- **ExpenseManagementModule.jsx**: Complete UI for expense management
- **FinancialDashboard.jsx**: Unified dashboard showing overview

### Data Storage (Google Sheets)
Two new sheets are created automatically:
- **FundCollectionRequests**: Stores all fund collection requests
- **ExpenseRequests**: Stores all expense reimbursement requests

## Features

### 1. Fund Collection Workflow

#### For Teachers:
- **Create Request**: Select class, purpose, amount per student, collection period
- **Student Selection**: 
  - View all students in a class
  - Select individual students or use "Select All"
  - Visual checkbox interface
- **Submit for Approval**: Send to Admin/HM for review
- **Track Status**: Monitor approval status in real-time
- **Start Collection**: Begin collecting funds after approval
- **Complete Collection**: Submit total collected amount
- **Status Tracking**: Draft → Pending → Approved → In Progress → Completed

#### For Admin/HM:
- **Review Requests**: View all pending fund collection requests
- **Approve**: Authorize fund collection
- **Reject**: Deny with reason
- **Request Revision**: Ask teacher to modify request
- **Dashboard**: Overview of all requests and pending approvals

#### For Accounts Department:
- **View Approved Collections**: See all authorized collections
- **Acknowledge Funds**: Confirm receipt of collected funds
- **Track Discrepancies**: Monitor expected vs. collected amounts
- **Dashboard**: Focus on items requiring acknowledgment

### 2. Expense Reimbursement Workflow

#### For Teachers:
- **Create Request**: Amount, reason, category, expense date
- **Upload Receipt**: Optional Google Drive link for receipt
- **Submit for Approval**: Send to Admin for review
- **Track Status**: Monitor approval and disbursement
- **Status Tracking**: Draft → Pending → Approved → Disbursed

#### For Admin/HM:
- **Review Requests**: View all pending expense requests
- **Approve**: Authorize expense for payment
- **Reject**: Deny with reason
- **Dashboard**: Overview of pending approvals

#### For Accounts Department:
- **View Approved Expenses**: See all expenses awaiting payment
- **Disburse Funds**: Mark payment as complete
- **Payment Details**: Record payment mode (Cash, Cheque, UPI, etc.)
- **Transaction Reference**: Store cheque number, transaction ID
- **Dashboard**: Focus on items requiring disbursement

### 3. Unified Financial Dashboard

- **Role-Based Views**: Different dashboards for Teachers, Admin, and Accounts
- **Real-Time Statistics**: 
  - Pending approvals count
  - Total amounts pending
  - Recent activity timeline
  - Status breakdowns
- **Quick Actions**: Direct links to pending items
- **Visual Analytics**: Clear metrics and indicators

## API Functions

### Fund Collection Functions

```javascript
// Create a new fund collection request
createFundCollectionRequest(data)
// Parameters: teacherEmail, class, purpose, amountPerStudent, startDate, endDate, selectedStudents, notes

// Submit request for approval
submitFundCollectionRequest(requestId)

// Get students in a class
getStudentsForClass(className)

// Get teacher's requests
getTeacherFundRequests(teacherEmail, status?)

// Get all requests (Admin)
getAllFundRequests(status?, className?)

// Approve request
approveFundRequest(requestId, approverEmail, notes?)

// Reject request
rejectFundRequest(requestId, rejectorEmail, reason)

// Request revision
requestFundRevision(requestId, revisorEmail, revisionNotes)

// Start collection
startFundCollection(requestId, teacherEmail)

// Complete collection
completeFundCollection(requestId, teacherEmail, collectedAmount)

// Acknowledge receipt (Accounts)
acknowledgeFundCollection(requestId, accountsEmail)

// Delete request (drafts only)
deleteFundCollectionRequest(requestId, teacherEmail)
```

### Expense Management Functions

```javascript
// Create expense request
createExpenseRequest(data)
// Parameters: teacherEmail, amount, reason, category, expenseDate, receiptUrl?, notes?

// Submit request
submitExpenseRequest(requestId)

// Get teacher's expenses
getTeacherExpenseRequests(teacherEmail, status?)

// Get all expenses (Admin/Accounts)
getAllExpenseRequests(status?, category?)

// Approve expense
approveExpenseRequest(requestId, approverEmail, notes?)

// Reject expense
rejectExpenseRequest(requestId, rejectorEmail, reason)

// Disburse expense (Accounts)
disburseExpense(requestId, accountsEmail, disbursementMode?, disbursementReference?)

// Update request (drafts only)
updateExpenseRequest(requestId, data)

// Delete request (drafts only)
deleteExpenseRequest(requestId, teacherEmail)

// Get expense categories
getExpenseCategories()

// Get expense summary/analytics
getExpenseSummary(params)
```

### Dashboard Functions

```javascript
// Get Admin dashboard
getAdminFinancialDashboard(userEmail)

// Get Accounts dashboard
getAccountsFinancialDashboard(userEmail)

// Get Teacher dashboard
getTeacherFinancialDashboard(userEmail)

// Get financial report
getFinancialReport(params)
// Parameters: startDate?, endDate?, includeDetails?

// Get pending count (for badges)
getPendingFinancialCount(userEmail, userRole)

// Get activity log
getFinancialActivityLog(params)
// Parameters: limit?, type?
```

## User Roles & Permissions

### Teacher
- Create fund collection and expense requests
- Edit drafts
- Submit for approval
- Start/complete fund collections
- View own requests and history
- Delete own drafts

### Admin/HM
- View all requests
- Approve/reject fund collections
- Approve/reject expenses
- Request revisions
- View comprehensive analytics
- Access admin dashboard

### Accounts
- View approved fund collections
- Acknowledge collected funds
- View approved expenses
- Disburse funds
- Record payment details
- Access accounts dashboard

## Status Flow

### Fund Collection
```
Draft → Pending → Approved → In Progress → Completed
                ↓          ↘
             Rejected    Revised (back to Pending)
```

### Expense Reimbursement
```
Draft → Pending → Approved → Disbursed
              ↓
           Rejected
```

## Notifications

The system automatically sends email notifications for:
- New request submission (to Admin/HM)
- Request approved (to Teacher)
- Request rejected (to Teacher)
- Revision requested (to Teacher)
- Fund collection approved (to Accounts)
- Fund collection completed (to Accounts)
- Funds acknowledged (to Teacher)
- Expense approved (to Teacher and Accounts)
- Expense disbursed (to Teacher)

## Installation & Setup

### 1. Backend Setup (Apps Script)
1. Files are already created in `/Appscript/` directory
2. Deploy the Apps Script project
3. Sheets will be created automatically on first use
4. Ensure email notification function is available

### 2. Frontend Integration
1. Components are created in `/frontend/src/components/`
2. Import and add routes in your main routing file:

```javascript
import FundCollectionModule from './components/FundCollectionModule';
import ExpenseManagementModule from './components/ExpenseManagementModule';
import FinancialDashboard from './components/FinancialDashboard';

// Add to your routes
<Route path="/fund-collection" element={<FundCollectionModule />} />
<Route path="/expense-management" element={<ExpenseManagementModule />} />
<Route path="/financial-dashboard" element={<FinancialDashboard />} />
```

3. Update navigation menu to include links:

```javascript
// For Teachers
{ name: 'Fund Collection', path: '/fund-collection', icon: <DollarSign /> }
{ name: 'Expense Claims', path: '/expense-management', icon: <Receipt /> }
{ name: 'Financial Overview', path: '/financial-dashboard', icon: <BarChart3 /> }

// For Admin
{ name: 'Financial Approvals', path: '/fund-collection', icon: <CheckCircle /> }
{ name: 'Expense Approvals', path: '/expense-management', icon: <CheckCircle /> }

// For Accounts
{ name: 'Fund Acknowledgment', path: '/fund-collection', icon: <DollarSign /> }
{ name: 'Expense Disbursement', path: '/expense-management', icon: <DollarSign /> }
```

### 3. API Integration
Ensure your `/frontend/src/api.js` can call the backend functions:

```javascript
// Example API implementation
export async function call(functionName, ...args) {
  // Your existing API call logic
  const response = await google.script.run
    .withSuccessHandler(onSuccess)
    .withFailureHandler(onFailure)
    [functionName](...args);
  return response;
}
```

## Data Structure

### FundCollectionRequests Sheet
```
requestId, teacherEmail, teacherName, class, purpose, amountPerStudent, 
totalStudents, expectedAmount, startDate, endDate, selectedStudents (JSON),
status, notes, createdAt, submittedAt, approvedBy, approvedAt, 
rejectedBy, rejectedAt, rejectionReason, revisedBy, revisedAt, 
revisionNotes, collectedAmount, acknowledgedBy, acknowledgedAt, completedAt
```

### ExpenseRequests Sheet
```
requestId, teacherEmail, teacherName, amount, reason, category, 
expenseDate, receiptUrl, notes, status, createdAt, submittedAt, 
approvedBy, approvedAt, rejectedBy, rejectedAt, rejectionReason, 
disbursedBy, disbursedAt, disbursementMode, disbursementReference
```

## Best Practices

### For Teachers
1. **Accurate Student Selection**: Double-check student list before submission
2. **Clear Purpose**: Use descriptive purpose text (e.g., "Annual Day Costume Fee")
3. **Realistic Dates**: Set appropriate collection period
4. **Complete on Time**: Submit collected amounts promptly
5. **Keep Receipts**: For expenses, upload receipts to Google Drive and link

### For Admins
1. **Prompt Review**: Review requests within 24 hours
2. **Clear Communication**: If requesting revision, be specific about changes needed
3. **Verify Details**: Check amounts and purpose before approval
4. **Document Reasons**: Always provide clear rejection reasons

### For Accounts
1. **Timely Acknowledgment**: Process collected funds same day
2. **Verify Amounts**: Cross-check expected vs. collected amounts
3. **Record Details**: Always record payment mode and reference
4. **Track Discrepancies**: Follow up on missing or excess amounts

## Security Features

- **Role-Based Access**: Users only see functions they're authorized for
- **Email Verification**: All actions tied to authenticated user email
- **Status Validation**: Users can only perform actions valid for current status
- **Audit Trail**: All actions logged with timestamps and user info
- **Data Isolation**: Teachers can only modify their own draft requests

## Troubleshooting

### Common Issues

**Issue**: Students not loading
- **Solution**: Verify Students sheet exists and has correct headers
- **Check**: Class name format (case-insensitive matching)

**Issue**: Request not submitting
- **Solution**: Ensure at least one student is selected
- **Check**: All required fields filled

**Issue**: Approval button not showing
- **Solution**: Verify user has admin/hm role
- **Check**: Request status is "Pending" or "Revised"

**Issue**: Email notifications not sending
- **Solution**: Check sendEmailNotification function exists
- **Verify**: Gmail quota not exceeded

## Future Enhancements

Potential additions for future versions:
1. **Bulk Import**: Import student selection from CSV
2. **Payment Integration**: Direct UPI/payment gateway integration
3. **Receipt OCR**: Automatic receipt data extraction
4. **Budget Tracking**: Set and monitor expense budgets
5. **Multi-Currency**: Support for different currencies
6. **Reports**: Detailed financial reports and analytics
7. **Recurring Expenses**: Templates for regular expenses
8. **Approval Chains**: Multiple approval levels
9. **Mobile App**: Dedicated mobile application
10. **WhatsApp Integration**: Status updates via WhatsApp

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in browser console
3. Verify Google Sheet permissions
4. Check Apps Script execution logs

## Version History

**Version 1.0.0** (Current)
- Initial release
- Fund collection workflow
- Expense reimbursement workflow
- Role-based dashboards
- Email notifications
- Complete UI components
- Comprehensive backend API

## Credits

Developed for school management system integration.
Built with:
- **Backend**: Google Apps Script
- **Frontend**: React, Tailwind CSS, Lucide Icons
- **Storage**: Google Sheets

---

*End of Documentation*
