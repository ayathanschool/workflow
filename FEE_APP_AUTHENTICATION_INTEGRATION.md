# Fee App Authentication Integration Guide

**Date:** December 17, 2025  
**Status:** Implementation Complete - PostMessage Authentication

## Overview

The fee collection app (`https://fee-app-6jwp.vercel.app/`) is integrated with the workflow app using **PostMessage communication**. Users authenticate once in the workflow app, and their credentials (roles, permissions, class assignments) are automatically passed to the fee app - **no separate login required**.

---

## Authentication Architecture

### How It Works

```
┌─────────────────────────────────────────────────────┐
│         Workflow App (Main Application)             │
│                                                      │
│  1. User logs in with Google OAuth                  │
│  2. Backend returns user data with roles            │
│  3. User navigates to Fee Collection tab            │
│  4. FeeCollectionView component loads               │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  PostMessage: Send AUTH_DATA                │    │
│  │  { email, name, roles, classes, etc. }     │    │
│  └────────────────┬───────────────────────────┘    │
│                   │                                  │
│                   ▼                                  │
│  ┌────────────────────────────────────────────┐    │
│  │         Fee App (Embedded iFrame)           │    │
│  │                                              │    │
│  │  1. Listens for AUTH_DATA message           │    │
│  │  2. Validates origin (security check)       │    │
│  │  3. Stores user data in state/storage       │    │
│  │  4. Renders role-based UI automatically     │    │
│  │                                              │    │
│  │  ✓ No login screen needed                   │    │
│  │  ✓ Instant authentication                   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Workflow App Implementation (✅ COMPLETE)

The workflow app has been updated to automatically pass authentication data to the fee app.

### Changes Made

**File:** [frontend/src/App.jsx](frontend/src/App.jsx) - `FeeCollectionView` component

```jsx
const FeeCollectionView = () => {
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Listen for ready message from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://fee-app-6jwp.vercel.app') return;
      
      if (event.data.type === 'FEE_APP_READY') {
        setIframeReady(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Send auth data when iframe is ready
  useEffect(() => {
    if (iframeReady && iframeRef.current && user) {
      const authData = {
        type: 'AUTH_DATA',
        user: {
          email: user.email,
          name: user.name,
          roles: user.roles || [],
          classes: user.classes || [],
          subjects: user.subjects || [],
          classTeacherFor: user.classTeacherFor || null,
          picture: user.picture || null
        }
      };
      
      iframeRef.current.contentWindow.postMessage(
        authData,
        'https://fee-app-6jwp.vercel.app'
      );
    }
  }, [iframeReady, user]);

  return (
    // ... iframe with ref={iframeRef}
  );
};
```

### Data Sent to Fee App

```javascript
{
  type: 'AUTH_DATA',
  user: {
    email: "shilpa@ayathanschool.com",
    name: "Shilpa",
    roles: ["class teacher", "teacher"],
    classes: ["STD 6A", "STD 7A", "STD 10A", "STD 10B"],
    subjects: ["English", "English Grammar"],
    classTeacherFor: "STD 10A",
    picture: "https://lh3.googleusercontent.com/..."
  }
}
```

---

## Fee App Implementation (TODO)

The fee app needs to be updated to receive and use the authentication data.

### Step 1: Add PostMessage Listener

Create or update the main App component in the fee app:

```jsx
// Fee App - App.jsx or main component
import { useState, useEffect, createContext, useContext } from 'react';

// Create authentication context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in sessionStorage
    const storedUser = sessionStorage.getItem('feeAppUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        sessionStorage.removeItem('feeAppUser');
      }
    }

    // Notify parent window that iframe is ready
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: 'FEE_APP_READY' },
        '*' // Will be filtered by workflow app's origin check
      );
    }

    // Listen for authentication data from parent window
    const handleMessage = (event) => {
      // CRITICAL: Verify origin for security
      // Replace with your actual workflow app URL
      const allowedOrigins = [
        'https://your-workflow-app.vercel.app',
        'http://localhost:5173', // For development
        'http://localhost:3000'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Rejected message from unauthorized origin:', event.origin);
        return;
      }
      
      if (event.data.type === 'AUTH_DATA' && event.data.user) {
        console.log('Received authentication data:', event.data.user);
        
        const userData = event.data.user;
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
        
        // Store in sessionStorage for persistence within session
        sessionStorage.setItem('feeAppUser', JSON.stringify(userData));
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Set loading timeout (in case parent never sends data)
    const timeout = setTimeout(() => {
      if (!user) {
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  // Provide authentication context to entire app
  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading }}>
      {isLoading ? (
        <LoadingScreen />
      ) : !isAuthenticated ? (
        <NotAuthenticatedScreen />
      ) : (
        <FeeAppContent />
      )}
    </AuthContext.Provider>
  );
}

// Loading screen component
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading authentication...</p>
      </div>
    </div>
  );
}

// Not authenticated screen
function NotAuthenticatedScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md p-8">
        <div className="text-red-600 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Authentication Required
        </h1>
        <p className="text-gray-600 mb-4">
          Please access this application through the main workflow app.
        </p>
        <p className="text-sm text-gray-500">
          This app cannot be accessed directly. You must log in to the workflow system first.
        </p>
      </div>
    </div>
  );
}

export default App;
```

### Step 2: Use Authentication in Components

```jsx
// Fee App - Any component that needs user data
import { useAuth } from './App';

function FeeManagementDashboard() {
  const { user, isAuthenticated } = useAuth();

  // Check if user has specific role
  const hasRole = (role) => {
    if (!user?.roles) return false;
    return user.roles.some(r => 
      r.toLowerCase().includes(role.toLowerCase())
    );
  };

  // Check if user is super admin or headmaster
  const canEditAllFees = hasRole('super admin') || hasRole('h m');
  
  // Check if user is class teacher
  const isClassTeacher = hasRole('class teacher');
  const managedClass = user?.classTeacherFor;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Fee Management</h1>
        <p className="text-gray-600">
          Welcome, {user?.name} ({user?.email})
        </p>
      </div>

      {/* Super admin / Headmaster view */}
      {canEditAllFees && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">All Classes</h2>
          <AllClassesFeeView />
        </div>
      )}

      {/* Class teacher view */}
      {isClassTeacher && managedClass && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Your Class: {managedClass}
          </h2>
          <ClassFeeView classId={managedClass} />
        </div>
      )}

      {/* Teacher view - their assigned classes */}
      {hasRole('teacher') && user?.classes?.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Classes</h2>
          <div className="grid gap-4">
            {user.classes.map(className => (
              <ClassFeeCard key={className} className={className} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Role-Based Component Guards

```jsx
// Fee App - utils/RoleGuard.jsx
import { useAuth } from '../App';

export function RoleGuard({ children, requiredRoles, fallback = null }) {
  const { user } = useAuth();

  const hasRequiredRole = () => {
    if (!user?.roles || !requiredRoles) return false;
    
    return requiredRoles.some(requiredRole =>
      user.roles.some(userRole =>
        userRole.toLowerCase().includes(requiredRole.toLowerCase())
      )
    );
  };

  if (!hasRequiredRole()) {
    return fallback || (
      <div className="text-center p-8 text-gray-500">
        You don't have permission to access this feature.
      </div>
    );
  }

  return children;
}

// Usage example
function AdminPanel() {
  return (
    <RoleGuard requiredRoles={['super admin', 'h m']}>
      <div>
        <h2>Admin Controls</h2>
        <button>Edit Fee Structure</button>
        <button>Generate Reports</button>
      </div>
    </RoleGuard>
  );
}

function ClassTeacherPanel() {
  return (
    <RoleGuard requiredRoles={['class teacher']}>
      <div>
        <h2>Class Fee Management</h2>
        {/* ... */}
      </div>
    </RoleGuard>
  );
}
```

### Step 4: Example Fee Collection Features by Role

```jsx
// Fee App - FeeAppContent.jsx
import { useAuth } from './App';
import { RoleGuard } from './utils/RoleGuard';

function FeeAppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Fee Collection System</h1>
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img 
                src={user.picture} 
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.roles?.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Super Admin / Headmaster Features */}
        <RoleGuard requiredRoles={['super admin', 'h m']}>
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Administrative Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                title="All Classes Fees"
                description="View and manage fees for all classes"
                link="/all-classes"
              />
              <FeatureCard
                title="Fee Structure"
                description="Configure fee amounts and categories"
                link="/fee-structure"
              />
              <FeatureCard
                title="Reports & Analytics"
                description="Generate collection reports"
                link="/reports"
              />
            </div>
          </section>
        </RoleGuard>

        {/* Class Teacher Features */}
        <RoleGuard requiredRoles={['class teacher']}>
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">
              Class Fee Management - {user?.classTeacherFor}
            </h2>
            <ClassFeeManagement classId={user?.classTeacherFor} />
          </section>
        </RoleGuard>

        {/* Teacher Features */}
        <RoleGuard requiredRoles={['teacher']}>
          <section>
            <h2 className="text-xl font-bold mb-4">Your Classes</h2>
            <div className="grid gap-4">
              {user?.classes?.map(className => (
                <ClassFeeCard key={className} className={className} />
              ))}
            </div>
          </section>
        </RoleGuard>
      </main>
    </div>
  );
}
```

---

## Security Considerations

### Origin Validation

**CRITICAL:** The fee app MUST validate the origin of incoming messages:

```javascript
// In fee app - ALWAYS check origin
const handleMessage = (event) => {
  const allowedOrigins = [
    'https://your-workflow-app.vercel.app', // Replace with actual URL
    'http://localhost:5173',  // Development
    'http://localhost:3000'
  ];
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected unauthorized origin:', event.origin);
    return; // Ignore message
  }
  
  // Process message...
};
```

### Data Storage

- **sessionStorage:** Data persists within tab session, cleared when tab closes
- **localStorage:** Data persists across sessions (NOT recommended for security)
- **Recommendation:** Use `sessionStorage` for user data in fee app

### iframe Sandbox

Current sandbox settings in workflow app:
```html
sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
```

This allows:
- ✅ JavaScript execution
- ✅ Form submission
- ✅ Session storage
- ✅ PostMessage communication
- ❌ Top-level navigation (security feature)

---

## Testing Guide

### Test Scenarios

#### 1. Super Admin Login
**User:** Any user with `super admin` role from [Users.csv](Appscript/1711 ayathan - Users.csv)

**Expected Fee App Features:**
- View all classes' fees
- Edit fee structure
- Generate reports
- Full administrative access

#### 2. Headmaster Login
**User:** Any user with `h m` role

**Expected Fee App Features:**
- View all classes' fees
- Edit fee collection
- Generate reports
- Administrative oversight

#### 3. Class Teacher Login
**User:** `shilpa@ayathanschool.com` or similar with `class teacher` role

**Expected Fee App Features:**
- View fees for assigned class only (e.g., STD 10A)
- Mark payments received
- View student payment status
- NO access to other classes

#### 4. Regular Teacher Login
**User:** Any user with only `teacher` role

**Expected Fee App Features:**
- View fee status for classes they teach
- Read-only access
- NO editing capabilities

### Testing Steps

1. **Deploy workflow app changes**
   ```bash
   cd frontend
   npm run build
   vercel --prod
   ```

2. **Update fee app with PostMessage listener**
   - Follow Step 1 implementation above
   - Deploy fee app

3. **Test authentication flow**
   - Log in to workflow app
   - Navigate to Fee Collection tab
   - Open browser DevTools console
   - Verify message: "Received authentication data: {...}"
   - Check user data is correct

4. **Test role-based access**
   - Test with each role type
   - Verify correct features are shown/hidden
   - Test class teacher sees only their class

5. **Test security**
   - Open fee app directly in new tab
   - Should show "Authentication Required" screen
   - Should NOT have access to features

### Debug Checklist

**If fee app shows "Authentication Required":**
- [ ] Check browser console for PostMessage errors
- [ ] Verify iframe loaded successfully
- [ ] Check `FEE_APP_READY` message sent from fee app
- [ ] Verify origin validation allows workflow app URL
- [ ] Check workflow app sends `AUTH_DATA` message

**If roles not working correctly:**
- [ ] Log `user.roles` array in fee app console
- [ ] Verify role names match exactly (lowercase comparison)
- [ ] Check hasRole() function logic
- [ ] Verify user data in [Users.csv](Appscript/1711 ayathan - Users.csv)

---

## Development Workflow

### Local Development Setup

**Workflow App (.env.local):**
```env
VITE_API_BASE_URL=https://script.google.com/macros/s/AKfycbwdOQjBES9EJVDRkxO1EMvY5RFF1o09f66cTbsqLxfYMm1WuwBq96PbbGGQnG6teJxtDA/exec
VITE_GOOGLE_CLIENT_ID=507141639783-p82t258ee6tgpija52qs9pelrjigd17d.apps.googleusercontent.com
```

**Fee App (.env.local):**
```env
# No environment variables needed!
# Authentication comes from parent window
```

### Running Locally

**Terminal 1 - Workflow App:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - Fee App:**
```bash
cd fee-app
npm run dev
# Runs on http://localhost:3000 (or 5174)
```

**Update fee app origin validation for local dev:**
```javascript
const allowedOrigins = [
  'https://your-workflow-app.vercel.app',
  'http://localhost:5173',  // Add this for local testing
  'http://localhost:3000'
];
```

**Update workflow app iframe URL for local testing:**
```jsx
// Temporarily change in App.jsx for local dev
<iframe
  src="http://localhost:3000/"  // Local fee app
  // OR
  src="https://fee-app-6jwp.vercel.app/"  // Production
/>
```

---

## Deployment Checklist

### Before Deployment

- [ ] Update origin validation in fee app with production workflow URL
- [ ] Test all user roles (super admin, h m, class teacher, teacher)
- [ ] Verify PostMessage communication works
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Check mobile responsiveness
- [ ] Verify sessionStorage works correctly

### Deployment Steps

1. **Deploy Workflow App Changes**
   ```bash
   cd d:\www\wwww\frontend
   npm run build
   vercel --prod
   ```

2. **Note Workflow App URL**
   - Example: `https://your-app-abc123.vercel.app`

3. **Update Fee App Origin Validation**
   ```javascript
   const allowedOrigins = [
     'https://your-app-abc123.vercel.app', // Update this!
   ];
   ```

4. **Deploy Fee App**
   ```bash
   cd fee-app
   npm run build
   vercel --prod
   ```

5. **Verify Deployment**
   - Log in to workflow app
   - Go to Fee Collection tab
   - Check console for authentication messages
   - Test role-based features

### Post-Deployment Verification

- [ ] Fee collection tab visible for class teachers
- [ ] Authentication data passed successfully
- [ ] Correct roles displayed in fee app
- [ ] Class teachers see only their assigned class
- [ ] Super admin/HM see all classes
- [ ] Direct access to fee app URL blocked
- [ ] No console errors

---

## Quick Reference - Implementation Summary

### ✅ Workflow App (COMPLETE)

**File:** [frontend/src/App.jsx](frontend/src/App.jsx)
- Fee collection tab added to class teacher navigation
- `FeeCollectionView` component updated with PostMessage communication
- Automatically sends authentication data to fee app iframe

**What's Sent:**
```javascript
{
  type: 'AUTH_DATA',
  user: {
    email, name, roles, classes, subjects, classTeacherFor, picture
  }
}
```

### 📋 Fee App (TODO)

**Required Changes:**
1. Add PostMessage listener in main App component
2. Create authentication context
3. Implement role-based access control
4. Add origin validation for security

**No Dependencies Needed:**
- ❌ No `@react-oauth/google` needed
- ❌ No Google Client ID needed
- ❌ No backend API calls needed
- ✅ Only PostMessage communication

---

## Summary

**Workflow App Changes:**
- ✅ Fee collection tab visible for class teachers
- ✅ PostMessage authentication implemented
- ✅ User data automatically shared with fee app

**Fee App Changes Needed:**
- 📋 Add PostMessage listener (see Step 1 above)
- 📋 Store user data in sessionStorage
- 📋 Implement role-based UI
- 📋 Add origin validation

**Benefits:**
- No separate login required
- Seamless user experience
- Simple implementation
- Secure with proper origin validation

**Next Steps:**
1. Review fee app implementation guide above
2. Add PostMessage listener to fee app
3. Test with different user roles
4. Deploy both apps

---

**Document Last Updated:** December 17, 2025  
**Implementation Status:** Workflow App Complete, Fee App Pending
