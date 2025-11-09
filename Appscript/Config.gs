/**
 * ====== MAIN CONFIGURATION FILE ======
 * This file contains all the basic settings for the school system
 */

/**
 * Your Google Spreadsheet ID - DON'T CHANGE THIS!
 */
const SPREADSHEET_ID = '1sRD4gpE6CLtSOYF6OWNpLEoZfqGY9Oa8IOPj6c_rbXU';

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
  Schemes: ['schemeId','teacherEmail','teacherName','class','subject','term','unit','chapter','month','noOfSessions','status','createdAt'],
  LessonPlans: ['lpId','teacherEmail','teacherName','class','subject','chapter','session','objectives','activities','status','reviewerRemarks','date','createdAt'],
  DailyReports: ['date','teacherEmail','teacherName','class','subject','period','planType','lessonPlanId','chapter','objectives','activities','completed','notes','createdAt'],
  
  // === SUBSTITUTION SYSTEM (2 sheets) ===  
  Substitutions: ['date','period','class','absentTeacher','regularSubject','substituteTeacher','substituteSubject','note','createdAt'],
  SubstitutionNotifications: ['id','recipient','title','message','type','data','acknowledged','acknowledgedAt','createdAt'],
  
  // === EXAM MANAGEMENT (4 sheets) ===
  Exams: ['examId','creatorEmail','creatorName','class','subject','examType','hasInternalMarks','internalMax','externalMax','totalMax','date','createdAt','examName'],
  ExamMarks: ['examId','class','subject','teacherEmail','teacherName','admNo','studentName','examType','ce','te','total','grade','createdAt'],
  GradeTypes: ['examType','internalMax','externalMax','totalMax'],
  GradeBoundaries: ['standardGroup','grade','minPercentage','maxPercentage']
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