# Fee Defaulters & Reminder Feature

## Overview
Added a new **Reminders** view in the Fee Collection module that allows class teachers and HM to view fee defaulters and send WhatsApp reminders to parents.

**IMPORTANT: HM and Class Teacher roles have RESTRICTED ACCESS - they can ONLY access the Reminders/Defaulters view. All other fee collection features (Dashboard, Payment, Transactions, Students, Outstanding) are hidden for these roles.**

## Features Implemented

### 1. Role-Based Access Control

#### Head Master (HM) Role
- **Access**: ONLY Reminders/Defaulters view
- **Visibility**: Can view defaulters from ALL classes
- **Restrictions**: Cannot access:
  - Dashboard (total collection view)
  - Payment page
  - Transactions history
  - Students list
  - Outstanding fees view
- **UI**: Tabs are hidden, shows "Fee Defaulters & Reminders - Head Master - All Classes"

#### Class Teacher Role
- **Access**: ONLY Reminders/Defaulters view
- **Visibility**: Can view defaulters ONLY from their assigned class (`user.classTeacherFor`)
- **Restrictions**: Cannot access:
  - Dashboard (total collection view)
  - Payment page
  - Transactions history
  - Students list
  - Outstanding fees view
- **UI**: Tabs are hidden, shows "Fee Defaulters & Reminders - Class Teacher - {className}"

#### Admin/Office Staff (Other Roles)
- **Access**: Full access to all Fee Collection features
- **Visibility**: Can access Dashboard, Payment, Transactions, Students, Outstanding, and Reminders
- **UI**: All tabs visible

### 2. Defaulters View Modes
- **Grouped by Student**: Shows one card per student with all unpaid fees grouped together
- **Itemized Table**: Shows individual rows for each unpaid fee head

### 3. WhatsApp Integration
- Direct WhatsApp link with pre-filled message template
- Customizable message template with placeholders:
  - `{name}` - Student name
  - `{admNo}` - Admission number
  - `{class}` - Class name
  - `{lines}` - Detailed fee breakdown
  - `{total}` - Total outstanding amount
- Default message template provided
- Copy to clipboard functionality as fallback

### 4. Filters
- **Class Filter**: Filter by specific class (automatically restricted for class teachers)
- **Group by Student**: Toggle between grouped and itemized views
- **Only Overdue**: Show only fees past their due date

### 5. Additional Features
- **CSV Export**: Download defaulters list with all details
- **Overdue Indicators**: Visual badges for overdue fees
- **Phone Number Validation**: Automatic formatting and validation
- **Expandable Fee Details**: Click to expand/collapse fee breakdown for each student
- **Responsive Design**: Mobile-friendly layout with cards on mobile, table on desktop

## Files Modified/Created

### New File
- `frontend/src/components/FeeCollection/DefaultersReminderView.jsx` - Main component

### Modified Files
1. `frontend/src/components/FeeCollection/ModernFeeCollection.jsx`
   - Added Bell icon import
   - Added DefaultersReminderView import
   - Added 'reminders' menu item
   - Added reminders view rendering
   - **Added role detection**: `isHM`, `isClassTeacher`, `isRestrictedRole`
   - **Filtered menu items**: HM and Class Teacher roles see only Reminders tab
   - **Auto-redirect**: Restricted roles start on 'reminders' view
   - **Conditional tabs**: Tabs hidden when only one option available
   - **Role-based header**: Shows role and class information for restricted users

2. `frontend/src/components/FeeCollection/ModernPaymentForm.jsx`
   - Added minimum search character requirement (1 character)
   - Student list now only shows after user starts typing

## Usage

### For Head Master (HM)
1. Navigate to Fee Collection module
2. **Automatically redirected to Reminders view** (only view available)
3. No tabs shown - direct access to defaulters list
4. Can view all classes or filter by specific class
5. Click WhatsApp button to send reminder directly
6. Or use Copy button to copy message and send manually

### For Class Teachers
1. Navigate to Fee Collection module
2. **Automatically redirected to Reminders view** (only view available)
3. No tabs shown - direct access to defaulters list
4. **Automatically filtered to show only their assigned class**
5. Can use additional filters (Group by Student, Only Overdue)
6. Click WhatsApp button to send reminder directly
7. Or use Copy button to copy message and send manually

### For Admin/Office Staff
1. Navigate to Fee Collection > Reminders tab
2. Can view all classes or filter by specific class
3. Full access to all fee collection features
4. Same WhatsApp and export features as other roles

## WhatsApp Message Format

Default template:
```
Dear Parent,

This is a gentle reminder regarding the pending fee payment for {name} (Adm No: {admNo}), Class {class}.

Pending Fee Details:
{lines}

Total Outstanding: ₹{total}

Kindly make the payment at the earliest to avoid any inconvenience.

Thank you,
Ayathan Central School
```

Example output:
```
Dear Parent,

This is a gentle reminder regarding the pending fee payment for John Doe (Adm No: 1001), Class 10-A.

Pending Fee Details:
Tuition Fee: ₹5,000 (Due: 15-Dec-2024)
Lab Fee: ₹1,500 (Due: 20-Dec-2024)

Total Outstanding: ₹6,500

Kindly make the payment at the earliest to avoid any inconvenience.

Thank you,
Ayathan Central School
```

## Reference Implementation
Based on the proxy fee collection system at `d:\www\fee-collection-proxy\src\App.jsx`:
- WhatsApp URL format: `https://wa.me/{phone}?text={encoded_message}`
- Phone number cleaning and validation
- Message template system with placeholders
- CSV export functionality

## Technical Details

### Phone Number Handling
- Cleans non-numeric characters
- Adds country code (91) for 10-digit Indian numbers
- Validates minimum 10 digits
- Shows "No Phone" indicator if invalid/missing

### Data Calculation
- Compares fee heads with transactions to determine balance
- Filters out voided transactions
- Calculates overdue status based on due dates
- Groups fees by student when requested

### Performance
- Uses React useMemo for expensive calculations
- Filters applied in-memory for instant results
- No additional API calls required (uses cached data)

## Future Enhancements
- Bulk WhatsApp sending (requires WhatsApp Business API)
- SMS integration
- Email reminders
- Reminder history tracking
- Auto-reminder scheduling
- Parent acknowledgment tracking
