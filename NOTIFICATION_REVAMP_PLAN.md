# Smart Notifications & Reminders System - Revamp Plan

## Overview
Complete redesign of the notification system with better categorization, priorities, smart reminders, and contextual notifications.

## Key Features

### 1. Enhanced Notification System
- **Categories**: System, Lesson Plans, Exams, Substitutions, Reports, Reminders, Approvals, Deadlines
- **Priorities**: Urgent, High, Medium, Low
- **Smart Auto-close**: Only low-priority notifications auto-close
- **Persistent Storage**: Save to localStorage
- **Batch Actions**: Mark all as read, clear old notifications
- **Filtering**: By category, priority, read/unread status

### 2. Smart Context-Aware Notifications
- `notifyLessonPlanDue(lessonPlan, daysUntilDue)` - Escalates priority as deadline approaches
- `notifySubstitution(substitution)` - Urgent notifications with acknowledgment
- `notifyExamMarksEntry(exam)` - Opens marks entry page
- `notifyDailyReportDue()` - End-of-day reminders
- `notifyApprovalRequired(item, type)` - For HM/Admin approvals

### 3. Enhanced Notification Center
- Tabbed interface: All | Unread | By Category
- Priority indicators with color coding
- Quick actions per notification
- Category badges and icons
- Time grouping: Today, Yesterday, This Week, Older
- Search/filter capabilities

### 4. Smart Reminders Dashboard
- Intelligent reminder generation based on:
  - Pending lesson plans (due today, this week, overdue)
  - Missing daily reports
  - Exams without marks
  - Unapproved schemes/lessons (for HM)
  - Upcoming substitutions
  - Chapter completion targets

- **Priority Scoring Algorithm**:
  ```
  URGENT: Overdue + Today's tasks
  HIGH: Due within 2 days
  MEDIUM: Due within 7 days
  LOW: Due > 7 days
  ```

- **Reminder Actions**:
  - Complete Now (navigates to relevant page)
  - Snooze (24 hours)
  - Dismiss
  - Mark as Done

### 5. Backend Integration

#### New Apps Script Functions

```javascript
// Get all smart reminders for a teacher
function getSmartReminders(teacherEmail, advanceNotice = 3) {
  // Returns array of reminders with:
  // - id, title, description
  // - category, priority
  // - dueDate, createdDate
  // - actionUrl (where to navigate)
  // - metadata (context data)
}

// Get notification preferences
function getNotificationPreferences(teacherEmail) {
  // User preferences for notifications
}

// Update notification preferences
function updateNotificationPreferences(teacherEmail, preferences) {
  // Save user notification settings
}

// Mark reminder as completed
function completeReminder(teacherEmail, reminderId) {
  // Mark reminder as done
}

// Snooze reminder
function snoozeReminder(teacherEmail, reminderId, hours) {
  // Postpone reminder
}
```

### 6. Notification Preferences (Per User)
- Enable/disable categories
- Email notifications toggle
- Reminder frequency (daily, twice daily, weekly)
- Advance notice period (1-7 days)
- Quiet hours
- Desktop notifications (browser API)

### 7. Real-time Updates
- Poll for new notifications every 5 minutes
- WebSocket support (future)
- Immediate updates for substitutions
- Badge count updates

### 8. Mobile-Responsive Design
- Swipe to dismiss on mobile
- Bottom sheet for mobile notification center
- Push notifications support (PWA)

## Implementation Plan

### Phase 1: Core Notification System ✅
1. Enhanced NotificationContext with categories/priorities
2. Improved NotificationCenter with tabs and filtering
3. Toast notifications in bottom-right corner

### Phase 2: Smart Reminders (Next)
1. Backend `getSmartReminders()` function
2. Reminder generation logic
3. Priority scoring algorithm
4. Smart reminder UI component

### Phase 3: User Preferences
1. Preference storage in Users sheet
2. Settings UI
3. Email notification integration

### Phase 4: Advanced Features
1. Real-time polling
2. Desktop notifications
3. Push notifications (PWA)
4. Analytics dashboard

## UI Components

### NotificationCenter (Bell Icon)
```
┌─────────────────────────────────────┐
│ Notifications (5)        [🔔] [⚙️]  │
├─────────────────────────────────────┤
│ [All] [Unread] [Categories ▼]       │
├─────────────────────────────────────┤
│ 🔴 URGENT - Substitution Assignment │
│    You have been assigned...         │
│    [View Details] [Acknowledge]      │
├─────────────────────────────────────┤
│ 🟡 HIGH - Lesson Plan Due Today     │
│    Submit lesson plan for...         │
│    [Complete Now]                    │
├─────────────────────────────────────┤
│ 🟢 LOW - Exam marks entry open      │
│    Marks entry is now...             │
│    2 hours ago                       │
└─────────────────────────────────────┘
```

### Smart Reminders Page
```
┌─────────────────────────────────────┐
│ Smart Reminders                      │
│ [Refresh] [Settings]                 │
├─────────────────────────────────────┤
│ 📊 Summary                           │
│ ⚠️  3 Urgent  |  ⚡ 5 High          │
│ 📋 7 Medium  |  ℹ️  2 Low           │
├─────────────────────────────────────┤
│ [🔴 Urgent] [⚡ High] [All]          │
├─────────────────────────────────────┤
│ 🔴 Overdue: Daily Report            │
│    Report for Class 6A - Period 3    │
│    Due: Yesterday                    │
│    [Submit Now] [Snooze] [Dismiss]   │
├─────────────────────────────────────┤
│ ⚡ Due Today: Lesson Plan           │
│    Mathematics - Class 7B            │
│    Due: Today at 5:00 PM            │
│    [Complete] [Snooze]               │
└─────────────────────────────────────┘
```

## Benefits

1. **Reduced Missed Tasks**: Proactive reminders prevent forgotten work
2. **Better Prioritization**: Visual priority system helps focus on urgent tasks
3. **Context Awareness**: Smart categorization makes finding related notifications easy
4. **Improved UX**: Clean, organized interface reduces notification fatigue
5. **Actionable**: One-click actions from notifications
6. **Persistent**: Important notifications don't auto-dismiss
7. **Customizable**: Users control their notification experience

## Next Steps

1. ✅ Create enhanced NotificationContext
2. ✅ Build revamped NotificationCenter component
3. 🔄 Build Smart Reminders component with backend integration
4. 🔄 Create backend getSmartReminders() function
5. ⏳ Add notification preferences UI
6. ⏳ Implement real-time polling
7. ⏳ Add desktop/push notifications

