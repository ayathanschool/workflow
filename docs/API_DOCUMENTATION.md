# API Documentation - AyathanWorkflow

## Authentication Endpoints

### POST /exec?action=googleLogin
Google OAuth login
**Payload**: `{ idToken: "google_id_token" }`

### GET /exec?action=login
Basic login
**Parameters**: `email`, `password`

## User Management

### GET /exec?action=getTeacherWeeklyTimetable
Get teacher's weekly schedule
**Parameters**: `email`

### GET /exec?action=getTeacherDailyTimetable
Get teacher's daily schedule
**Parameters**: `email`, `date`

## Lesson Planning

### POST /exec?action=submitPlan
Submit scheme of work
**Payload**: `{ email, teacherName, class, subject, term, unit, chapter, month, noOfSessions }`

### POST /exec?action=submitLessonPlanDetails
Submit lesson plan details
**Payload**: `{ lpId, objectives, activities, date, class, subject, session, teacherEmail, teacherName }`

### GET /exec?action=getTeacherLessonPlans
Get teacher's lesson plans
**Parameters**: `email`, `subject`, `class`, `status`, `search`

## Exam Management

### POST /exec?action=createExam
Create new exam
**Payload**: `{ email, creatorName, class, subject, examType, hasInternalMarks, internalMax, externalMax, totalMax, date }`

### GET /exec?action=getExams
Get exams with role-based filtering
**Parameters**: `class`, `subject`, `examType`, `teacherEmail`, `role`, `classTeacherFor`, `teacherSubjects`

### POST /exec?action=submitExamMarks
Submit exam marks
**Payload**: `{ examId, class, subject, teacherEmail, teacherName, marks: [{ admNo, studentName, internal, external }] }`

## Student Management

### GET /exec?action=getStudents
Get students list
**Parameters**: `class` (optional)

### GET /exec?action=getStudentPerformance
Get student performance analytics
**Parameters**: `class`

## Attendance

### POST /exec?action=submitAttendance
Submit attendance records
**Payload**: `{ date, class, teacherEmail, teacherName, records: [{ admNo, studentName, status }] }`

### GET /exec?action=getAttendance
Get attendance records
**Parameters**: `class`, `date`

## Substitution Management

### GET /exec?action=getVacantSlotsForAbsent
Get vacant slots for absent teachers
**Parameters**: `date`, `absent[]`

### GET /exec?action=getFreeTeachers
Get available substitute teachers
**Parameters**: `date`, `period`, `absent[]`

### POST /exec?action=assignSubstitution
Assign substitution
**Payload**: `{ date, period, class, absentTeacher, regularSubject, substituteTeacher, substituteSubject, note }`

## Calendar & Events

### GET /exec?action=getCalendarEvents
Get calendar events for teacher
**Parameters**: `email`, `startDate`, `endDate`

### POST /exec?action=saveCalendarEvent
Save personal calendar event
**Payload**: `{ userEmail, title, startTime, endTime, class, subject, notes, type, color, allDay }`

## Analytics & Reports

### GET /exec?action=getHmInsights
Get headmaster dashboard insights

### GET /exec?action=getAllPlans
Get all plans with filters
**Parameters**: `teacher`, `class`, `subject`, `status`

### GET /exec?action=getDailyReports
Get daily reports with filters
**Parameters**: `teacher`, `class`, `subject`, `date`, `fromDate`, `toDate`, `status`

## System Configuration

### GET /exec?action=getAppSettings
Get application settings

### GET /exec?action=getAllClasses
Get all classes

### GET /exec?action=getAllSubjects
Get all subjects

## Error Handling
All endpoints return consistent JSON responses:
```json
{
  "error": "Error message",
  "data": { ... }
}
```

## Rate Limiting
Google Apps Script has execution time limits:
- 6 minutes for simple triggers
- 30 minutes for complex operations