# 🧹 CODEBASE CLEANUP PLAN

## Current Issues
- Too many complex notification sheets
- Overengineered notification system
- Multiple sheets for simple features

## 📊 ESSENTIAL SHEETS (Keep These)

### **Core System**
1. **Users** - User accounts and roles
2. **Settings** - App configuration
3. **Students** - Student master list

### **Academic Workflow** 
4. **Timetable** - Weekly schedule
5. **Schemes** - Scheme of work
6. **LessonPlans** - Individual lesson plans
7. **DailyReports** - Daily teaching reports

### **Substitutions** 
8. **Substitutions** - Substitution assignments
9. **SubstitutionNotifications** - Simple notifications for substitutions

### **Exams** 
10. **Exams** - Exam metadata
11. **ExamMarks** - Student marks

### **Optional** (can remove if not used)
12. **CalendarEvents** - Calendar features
13. **Attendance** - Student attendance

## 🗑️ REMOVE THESE COMPLEX SHEETS

### **Complex Notification System**
- ❌ NotificationQueue
- ❌ NotificationPreferences  
- ❌ NotificationTemplates
- ❌ PushNotifications

### **Unused Features**
- ❌ LessonProgress (if not used)
- ❌ GradeTypes (if not used)

## 🎯 SIMPLIFIED NOTIFICATION APPROACH

### **What Works Now:**
1. **Email notifications** - Already working for scheme/lesson approvals
2. **Simple substitution notifications** - New system with acknowledge button
3. **HM custom announcements** - Email-based system

### **No Need For:**
- Complex push notification system
- Multiple notification channels
- Notification preferences/templates
- Notification queuing system

## 📝 FINAL RECOMMENDED SHEETS (13 total)

```javascript
const SHEETS = {
  // Core (3)
  Users: ['email','name','password','roles','classes','subjects','classTeacherFor'],
  Settings: ['key','value'],
  Students: ['admNo','name','class','email','parentContact'],
  
  // Academic (4) 
  Timetable: ['class','dayOfWeek','period','subject','teacherEmail','teacherName'],
  Schemes: ['schemeId','teacherEmail','teacherName','class','subject','term','unit','chapter','month','noOfSessions','status','createdAt'],
  LessonPlans: ['lpId','teacherEmail','teacherName','class','subject','chapter','session','objectives','activities','status','reviewerRemarks','date','createdAt'],
  DailyReports: ['date','teacherEmail','teacherName','class','subject','period','planType','lessonPlanId','chapter','objectives','activities','completed','notes','createdAt'],
  
  // Substitutions (2)
  Substitutions: ['date','period','class','absentTeacher','regularSubject','substituteTeacher','substituteSubject','note','createdAt'],
  SubstitutionNotifications: ['id','recipient','title','message','type','data','acknowledged','acknowledgedAt','createdAt'],
  
  // Exams (2)
  Exams: ['examId','creatorEmail','creatorName','class','subject','examType','hasInternalMarks','internalMax','externalMax','totalMax','date','createdAt','examName'],
  ExamMarks: ['examId','class','subject','teacherEmail','teacherName','admNo','studentName','examType','ce','te','total','grade','createdAt'],
  
  // Optional (2)
  CalendarEvents: ['eventId','userEmail','title','startTime','endTime','class','subject','notes','type','color','allDay','createdAt'],
  Attendance: ['date','class','admNo','studentName','status','teacherEmail','teacherName','createdAt']
};
```

## ✅ BENEFITS OF CLEANUP

1. **Simpler maintenance** - Fewer sheets to manage
2. **Better performance** - Less data to process
3. **Easier debugging** - Clear data flow
4. **Focus on essentials** - Core school workflow only
5. **Working features** - Email + simple substitution notifications

## 🎯 WORKING NOTIFICATION FEATURES

1. **✅ Email Notifications** - Automatic emails for:
   - Scheme approvals/rejections
   - Lesson plan approvals/rejections
   - HM custom announcements

2. **✅ Substitution Notifications** - Simple in-app notifications:
   - Automatic when substitution assigned
   - Teacher sees notification on dashboard
   - One-click acknowledge button
   - Replaces paper-based signatures

This approach keeps what works and removes complexity!