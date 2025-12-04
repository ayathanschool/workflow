/**
 * ====== MAIN CONFIGURATION FILE ======
 * This file contains all the basic settings for the school system
 */

/**
 * AI-POWERED LESSON PLAN SUGGESTIONS (Optional Feature)
 * Set GEMINI_API_KEY to enable AI-generated lesson plan suggestions
 * Get your free API key from: https://aistudio.google.com/app/apikey
 */
const GEMINI_API_KEY = 'AIzaSyB-5NtZuNY5h4JfnCkO3WO7yv2_OGWmMrM';
const AI_SUGGESTIONS_ENABLED = true; // Set to false to disable AI features

/**
 * Your Google Spreadsheet ID (staging)
 * NOTE: For production, update this in the prod Apps Script deployment.
 */
const SPREADSHEET_ID = '1PWD9XxQlnYcIgZqgY4LcnM4YgG0ciAtAYRVhv6lWKRg';

/**
 * All the sheets (tabs) in your spreadsheet and what columns they have
 * Think of this like a blueprint of your database
 */
const SHEETS = {
  // === CORE SYSTEM (3 sheets) ===
  Users: ['email','name','password','roles','classes','subjects','classTeacherFor'],
  Students: ['admNo','name','class','email','parentContact'], 
  Settings: ['key','value'],
  
  // === ACADEMIC WORKFLOW (4 sheets) ===
  Timetable: ['class','dayOfWeek','period','subject','teacherEmail','teacherName'],
  // Schemes sheet headers expanded to include approval + academic context columns
  // Must match MainApp _handleSubmitScheme headers to prevent header resets truncating columns
  Schemes: ['schemeId','teacherEmail','teacherName','class','subject','term','unit','chapter','month','noOfSessions','status','createdAt','approvedAt','academicYear','content'],
  LessonPlans: ['lpId','schemeId','teacherEmail','teacherName','class','subject','chapter','session','selectedDate','selectedPeriod','learningObjectives','teachingMethods','resourcesRequired','assessmentMethods','status','createdAt','submittedAt','isDuplicate','lessonType','reviewComments','reviewedAt','uniqueKey','originalDate','originalPeriod','cancelledAt','cancelReason','forRevision'],
  DailyReports: ['id','date','teacherEmail','teacherName','class','subject','period','planType','lessonPlanId','chapter','sessionNo','totalSessions','completionPercentage','chapterStatus','deviationReason','difficulties','nextSessionPlan','objectives','activities','completed','notes','createdAt','isSubstitution','absentTeacher','regularSubject','substituteSubject','verified','verifiedBy','verifiedAt','reopenReason','reopenedBy','reopenedAt'],
  
  // === SYLLABUS & CALENDAR (2 sheets) ===
  Syllabus: ['standard','subject','term','chapterNo','chapterName','minSessions','topics','sequence'],
  // AcademicCalendar supports both legacy and new columns for flexibility
  AcademicCalendar: ['term','startDate','endDate','examStartDate','examEndDate','eventDates','eventNames','teachingWeeks','examDates','holidays','events'],
  
  // === SUBSTITUTION SYSTEM (2 sheets) ===  
  Substitutions: ['date','period','class','absentTeacher','regularSubject','substituteTeacher','substituteSubject','note','acknowledged','acknowledgedBy','acknowledgedAt','createdAt'],
  SubstitutionNotifications: ['id','recipient','title','message','type','data','acknowledged','acknowledgedAt','createdAt'],
  
  // === EXAM MANAGEMENT (4 sheets) ===
  Exams: ['examId','creatorEmail','creatorName','class','subject','examType','hasInternalMarks','internalMax','externalMax','totalMax','date','createdAt','examName'],
  ExamMarks: ['examId','class','subject','teacherEmail','teacherName','admNo','studentName','examType','ce','te','total','grade','createdAt'],
  GradeTypes: ['examType','internalMax','externalMax','totalMax'],
  GradeBoundaries: ['standardGroup','grade','minPercentage','maxPercentage'],
  
  // === SESSION TRACKING SYSTEM (2 sheets) ===
  TeacherPerformance: ['teacherEmail','teacherName','totalSessions','completedSessions','partialSessions','averageCompletion','onTimeCompletion','cascadingIssues','performanceGrade','lastUpdated','recommendations'],
  SessionDependencies: ['prerequisiteSession','dependentSession','completionPercentage','impactLevel','recommendedAction','createdAt']
};

/**
 * Notification system constants
 */
const NOTIFICATION_TYPES = {
  URGENT: 'urgent',    // Send immediately
  HIGH: 'high',        // Send within 15 minutes  
  MEDIUM: 'medium',    // Send within 1 hour
  LOW: 'low'           // Send daily digest
};

const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  PUSH: 'push',
  WHATSAPP: 'whatsapp'
};

const NOTIFICATION_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing', 
  SENT: 'sent',
  FAILED: 'failed',
  RETRYING: 'retrying'
};