# AyathanWorkflow - School Management System

A comprehensive, production-ready school management system built with React frontend and Google Apps Script backend.

## 🚀 Current Status
- **Frontend**: Fully optimized React app with performance enhancements
- **Backend**: Google Apps Script with role-based permissions and optimizations
- **Deployment**: Ready for immediate deployment to any platform

## ✨ Key Features
- **Role-based Access Control**: HM, Class Teacher, Teacher roles
- **Exam Management**: Create, update, and manage exams with mark entry
- **Lesson Planning**: Complete lesson plan workflow with reviews
- **Attendance Tracking**: Daily attendance management
- **Substitution Management**: Handle teacher absences and substitutions
- **Performance Analytics**: Teacher and student performance insights
- **Calendar Integration**: Timetable and event management
- **Real-time Dashboard**: Live updates and notifications

## 📁 Project Structure
```
AyathanWorkflow/
├── frontend/           # React.js application
│   ├── src/           # Source code
│   ├── public/        # Static assets
│   └── package.json   # Dependencies
├── Appscript/         # Google Apps Script backend
│   └── Code.gs        # Main backend logic
└── docs/              # Documentation
```

## 🔧 Quick Start

### 1. Backend Deployment (Google Apps Script)
1. Open [script.google.com](https://script.google.com)
2. Create new project named "AyathanWorkflow"
3. Replace Code.gs with the content from `Appscript/Code.gs`
4. Update `SPREADSHEET_ID` with your Google Sheets ID
5. Deploy as web app

### 2. Frontend Deployment (Vercel/Netlify)
1. Push frontend folder to GitHub
2. Connect to Vercel/Netlify
3. Set environment variables:
   - `REACT_APP_API_URL`: Your Apps Script deployment URL
4. Deploy automatically

## 🎯 Recent Optimizations
- **Performance**: React.memo, useMemo, useCallback optimizations
- **Bundle Size**: Reduced to 447.01 kB
- **API Caching**: Intelligent caching for students and marks
- **Role Permissions**: Enhanced class teacher filtering logic
- **Debug Cleanup**: Removed all console.log statements for production
- **Error Handling**: Comprehensive error boundaries and validation

## 🔐 User Roles & Permissions
- **Headmaster (HM)**: Full system access
- **Class Teacher**: Access to their class + subjects they teach
- **Teacher**: Access to assigned classes and subjects only

## 📊 Data Sheets
- Users, Timetable, Schemes, LessonPlans
- DailyReports, Substitutions, CalendarEvents
- Exams, ExamMarks, Students, Attendance
- GradeBoundaries, GradeTypes

## 🚀 Enhancement Ready
This system is ready for:
- Notification system implementation
- Mobile PWA features
- Advanced analytics
- Automated reporting
- Real-time updates

## 📞 Support
System is fully documented with comprehensive API endpoints and clear error handling.