# AyathanWorkflow - School Management System# AyathanWorkflow - School Management System



> **Complete school workflow management system for teachers, administrators, and students**A comprehensive, production-ready school management system built with React frontend and Google Apps Script backend.



[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ayathanschool/workflow)## 🚀 Current Status

[![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg)](https://reactjs.org/)- **Frontend**: Fully optimized React app with performance enhancements

[![PWA](https://img.shields.io/badge/PWA-Ready-success.svg)](https://developers.google.com/web/progressive-web-apps/)- **Backend**: Google Apps Script with role-based permissions and optimizations

[![Google Apps Script](https://img.shields.io/badge/Backend-Google%20Apps%20Script-4285f4.svg)](https://script.google.com/)- **Deployment**: Ready for immediate deployment to any platform



## 🎯 Overview## ✨ Key Features

- **Role-based Access Control**: HM, Class Teacher, Teacher roles

AyathanWorkflow is a comprehensive school management system designed to streamline daily operations for educational institutions. Built with modern web technologies and deployed as a Progressive Web App (PWA) for mobile-first accessibility.- **Exam Management**: Create, update, and manage exams with mark entry

- **Lesson Planning**: Complete lesson plan workflow with reviews

## ✨ Key Features- **Attendance Tracking**: Daily attendance management

- **Substitution Management**: Handle teacher absences and substitutions

### 📚 **Academic Management**- **Performance Analytics**: Teacher and student performance insights

- **Lesson Plan Management** - Create, submit, and track lesson plans- **Calendar Integration**: Timetable and event management

- **Exam Management** - Schedule exams, manage marks, generate report cards- **Real-time Dashboard**: Live updates and notifications

- **Subject Mapping** - Enhanced subject categorization (Malayalam → Mal 1/Mal 2, Social → History/Geography)

- **Timetable Integration** - Weekly teacher timetables with period management## 📁 Project Structure

```

### 👥 **User Management**AyathanWorkflow/

- **Role-based Access Control** - Teachers, Class Teachers, Headmaster permissions├── frontend/           # React.js application

- **Authentication** - Google OAuth integration│   ├── src/           # Source code

- **Profile Management** - User settings and preferences│   ├── public/        # Static assets

│   └── package.json   # Dependencies

### 🔄 **Substitution System**├── Appscript/         # Google Apps Script backend

- **Smart Substitution Management** - Automated teacher substitution workflows│   └── Code.gs        # Main backend logic

- **IT Lab Support** - Special handling for IT Lab period coverage└── docs/              # Documentation

- **Free Teacher Detection** - Intelligent teacher availability checking```



### 📊 **Analytics & Reporting**## 🔧 Quick Start

- **Dashboard Analytics** - School performance metrics and insights

- **Report Card Generation** - Automated student report generation### 1. Backend Deployment (Google Apps Script)

- **Progress Tracking** - Lesson plan and academic progress monitoring1. Open [script.google.com](https://script.google.com)

2. Create new project named "AyathanWorkflow"

### 📱 **PWA Features**3. Replace Code.gs with the content from `Appscript/Code.gs`

- **Mobile-First Design** - Optimized for tablets and mobile devices4. Update `SPREADSHEET_ID` with your Google Sheets ID

- **Offline Capability** - Service worker for offline functionality5. Deploy as web app

- **Push Notifications** - Real-time updates and reminders

- **Install Prompts** - Native app-like experience### 2. Frontend Deployment (Vercel/Netlify)

1. Push frontend folder to GitHub

## 🏗️ Architecture2. Connect to Vercel/Netlify

3. Set environment variables:

### **Frontend** (`/frontend`)   - `REACT_APP_API_URL`: Your Apps Script deployment URL

- **Framework**: React 18.2.0 with Vite4. Deploy automatically

- **Styling**: Tailwind CSS with custom themes

- **State Management**: React Context API## 🎯 Recent Optimizations

- **Routing**: React Router with lazy loading- **Performance**: React.memo, useMemo, useCallback optimizations

- **PWA**: Service Worker, Web App Manifest- **Bundle Size**: Reduced to 447.01 kB

- **Build System**: Vite with code splitting and optimization- **API Caching**: Intelligent caching for students and marks

- **Role Permissions**: Enhanced class teacher filtering logic

### **Backend** (`/Appscript`)- **Debug Cleanup**: Removed all console.log statements for production

- **Platform**: Google Apps Script- **Error Handling**: Comprehensive error boundaries and validation

- **Database**: Google Sheets integration

- **API**: RESTful endpoints with JSON responses## 🔐 User Roles & Permissions

- **Authentication**: Google OAuth 2.0- **Headmaster (HM)**: Full system access

- **Deployment**: Google Cloud deployment- **Class Teacher**: Access to their class + subjects they teach

- **Teacher**: Access to assigned classes and subjects only

### **Documentation** (`/docs`)

- **API Documentation**: Complete endpoint reference## 📊 Data Sheets

- **Deployment Guide**: Step-by-step deployment instructions- Users, Timetable, Schemes, LessonPlans

- **Configuration Guide**: System setup and configuration- DailyReports, Substitutions, CalendarEvents

- Exams, ExamMarks, Students, Attendance

## 🚀 Quick Start- GradeBoundaries, GradeTypes



### Prerequisites## 🚀 Enhancement Ready

- Node.js 18+ and npmThis system is ready for:

- Google Account for Apps Script- Notification system implementation

- Google Sheets for data storage- Mobile PWA features

- Advanced analytics

### Installation- Automated reporting

- Real-time updates

1. **Clone the repository**

   ```bash## 📞 Support

   git clone https://github.com/ayathanschool/workflow.gitSystem is fully documented with comprehensive API endpoints and clear error handling.
   cd workflow
   ```

2. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Configure your Google Apps Script URL in .env
   npm run dev
   ```

3. **Setup Backend**
   - Open [Google Apps Script](https://script.google.com/)
   - Create new project and paste `Appscript/Code.gs`
   - Deploy as web app with execute permissions for "Anyone"
   - Update frontend `.env` with your deployment URL

4. **Deploy**
   ```bash
   npm run build
   # Deploy dist/ folder to your hosting platform
   ```

## 📁 Project Structure

```
AyathanWorkflow/
├── 📁 Appscript/           # Google Apps Script backend
│   └── Code.gs             # Main backend application (5,800 lines)
├── 📁 frontend/            # React frontend application
│   ├── 📁 src/
│   │   ├── 📁 components/  # React components
│   │   ├── 📁 contexts/    # React Context providers
│   │   ├── 📁 utils/       # Utility functions
│   │   └── App.jsx         # Main application component
│   ├── 📁 public/          # Static assets
│   └── package.json        # Frontend dependencies
├── 📁 docs/               # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT.md
│   └── INTERNAL_MARKS_CONFIGURATION.md
├── 📁 archive/            # Archived files (development artifacts)
├── .gitignore
├── README.md              # This file
└── vercel.json           # Vercel deployment configuration
```

## 🔧 Configuration

### Environment Variables

**Frontend** (`.env`):
```env
VITE_GAS_WEB_APP_URL=your_google_apps_script_url
VITE_APP_TITLE=AyathanWorkflow
VITE_ENABLE_PWA=true
```

**Backend**: Configuration managed through Google Apps Script project settings.

### Google Sheets Setup

Required sheets in your Google Spreadsheet:
- `Users` - User authentication and roles
- `Timetable` - Weekly teacher schedules
- `LessonPlans` - Lesson plan submissions
- `Schemes` - Scheme approvals workflow
- `Exams` - Exam scheduling and management
- `Substitutions` - Teacher substitution records

## 📱 PWA Features

- **Offline Support**: Service worker caches critical resources
- **Mobile Optimization**: Responsive design for all screen sizes
- **Install Prompts**: Native installation on mobile devices
- **Push Notifications**: Real-time updates and reminders
- **Landscape Mode**: Full orientation support (including Samsung tablets)

## 🔐 Security

- **Google OAuth**: Secure authentication via Google accounts
- **Role-based Access**: Granular permissions system
- **HTTPS Only**: Secure communication channels
- **Data Validation**: Input sanitization and validation

## 🚀 Recent Updates

### v1.0.0 (October 2025)
- ✨ **Enhanced Subject Mapping**: Hardcoded subject expansion for exam dropdowns
- 🗑️ **Major Code Cleanup**: Removed 1,000+ lines of unused IT Lab Drafts system
- 📱 **PWA Landscape Fix**: Samsung tablet orientation support improvements
- 🔧 **Backend Optimization**: Code.gs reduced from 6,128 to 5,800 lines
- 📁 **Project Organization**: Archived temporary and backup files

## 📚 Documentation

- **[API Documentation](docs/API_DOCUMENTATION.md)** - Complete backend API reference
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step deployment instructions
- **[Configuration Guide](docs/INTERNAL_MARKS_CONFIGURATION.md)** - System configuration details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏫 About Ayathan School

Developed for Ayathan School workflow management. Designed to digitize and streamline academic processes while maintaining simplicity and ease of use.

---

**Maintained by**: Ayathan School Development Team  
**Contact**: [GitHub Issues](https://github.com/ayathanschool/workflow/issues)  
**Demo**: [Live Application](https://your-deployment-url.vercel.app)

*Made with ❤️ for education technology*