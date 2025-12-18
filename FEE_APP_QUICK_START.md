# Fee App Integration - Quick Start Guide

**Date:** December 17, 2025

## Overview

The fee app receives authentication automatically from the workflow app via PostMessage - **NO login screen needed**.

---

## Implementation (Copy & Paste)

### Step 1: Main App Component

Replace your main App.jsx with this:

```jsx
import { useState, useEffect, createContext, useContext } from 'react';

// Create auth context
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check sessionStorage
    const storedUser = sessionStorage.getItem('feeAppUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setIsAuthenticated(true);
      setIsLoading(false);
    }

    // Notify parent we're ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'FEE_APP_READY' }, '*');
    }

    // Listen for auth data
    const handleMessage = (event) => {
      // IMPORTANT: Replace with your actual workflow app URL
      const allowedOrigins = [
        'https://your-workflow-app.vercel.app',
        'http://localhost:5173'  // For local dev
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Rejected unauthorized origin:', event.origin);
        return;
      }
      
      if (event.data.type === 'AUTH_DATA' && event.data.user) {
        console.log('Received auth:', event.data.user);
        setUser(event.data.user);
        setIsAuthenticated(true);
        setIsLoading(false);
        sessionStorage.setItem('feeAppUser', JSON.stringify(event.data.user));
      }
    };

    window.addEventListener('message', handleMessage);
    
    const timeout = setTimeout(() => setIsLoading(false), 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

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

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Loading authentication...</p>
      </div>
    </div>
  );
}

function NotAuthenticatedScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
        <p className="text-gray-600">
          Please access this app through the main workflow system.
        </p>
      </div>
    </div>
  );
}

export default App;
```

### Step 2: Use Auth in Components

```jsx
import { useAuth } from './App';

function FeeAppContent() {
  const { user } = useAuth();

  // Role checking helper
  const hasRole = (role) => {
    if (!user?.roles) return false;
    return user.roles.some(r => 
      r.toLowerCase().includes(role.toLowerCase())
    );
  };

  const isSuperAdmin = hasRole('super admin');
  const isHeadmaster = hasRole('h m');
  const isClassTeacher = hasRole('class teacher');
  const managedClass = user?.classTeacherFor;

  return (
    <div>
      <header className="bg-white shadow p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Fee Collection</h1>
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.roles?.join(', ')}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Super Admin / Headmaster */}
        {(isSuperAdmin || isHeadmaster) && (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-4">All Classes</h2>
            <AllClassesFees />
          </section>
        )}

        {/* Class Teacher */}
        {isClassTeacher && managedClass && (
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-4">
              Your Class: {managedClass}
            </h2>
            <ClassFees classId={managedClass} />
          </section>
        )}

        {/* Regular Teacher */}
        {hasRole('teacher') && user?.classes?.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Your Classes</h2>
            {user.classes.map(cls => (
              <ClassCard key={cls} className={cls} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
```

### Step 3: Role Guard Component (Optional)

```jsx
import { useAuth } from './App';

export function RoleGuard({ children, requiredRoles }) {
  const { user } = useAuth();

  const hasRequiredRole = requiredRoles?.some(role =>
    user?.roles?.some(r => r.toLowerCase().includes(role.toLowerCase()))
  );

  if (!hasRequiredRole) {
    return <div className="text-gray-500 p-4">Access denied</div>;
  }

  return children;
}

// Usage:
<RoleGuard requiredRoles={['super admin', 'h m']}>
  <AdminPanel />
</RoleGuard>
```

---

## User Data Structure

When authenticated, you receive:

```javascript
{
  email: "shilpa@ayathanschool.com",
  name: "Shilpa",
  roles: ["class teacher", "teacher"],
  classes: ["STD 6A", "STD 7A", "STD 10A"],
  subjects: ["English", "English Grammar"],
  classTeacherFor: "STD 10A",
  picture: "https://lh3.googleusercontent.com/..."
}
```

---

## Role-Based Access Examples

### Super Admin / Headmaster
- Can view all classes
- Can edit fee structure
- Can generate reports
- Full administrative access

### Class Teacher
- Can view/manage their assigned class only (`classTeacherFor`)
- Can mark payments
- Can view student fee status

### Teacher
- Can view classes they teach (`classes` array)
- Read-only access
- Cannot edit fees

---

## Testing Checklist

### Before Deployment
- [ ] Update `allowedOrigins` with actual workflow app URL
- [ ] Test with super admin user
- [ ] Test with class teacher user (verify sees only their class)
- [ ] Test with regular teacher user
- [ ] Verify direct access shows "Authentication Required"

### Console Checks
```javascript
// Should see in console:
"Received auth: {email: '...', roles: [...]}"

// Should NOT see:
"Rejected unauthorized origin: ..."
```

---

## Deployment

1. **Update allowedOrigins in App.jsx:**
   ```javascript
   const allowedOrigins = [
     'https://your-actual-workflow-app.vercel.app', // UPDATE THIS!
   ];
   ```

2. **Deploy to Vercel:**
   ```bash
   npm run build
   vercel --prod
   ```

3. **Test:**
   - Log in to workflow app
   - Navigate to Fee Collection tab
   - Verify authentication received
   - Check role-based features

---

## Troubleshooting

**"Authentication Required" screen shown:**
- Check browser console for origin rejection messages
- Verify `allowedOrigins` includes workflow app URL
- Check workflow app is sending `AUTH_DATA` message

**User data missing/incorrect:**
- Check `console.log('Received auth:', event.data.user)`
- Verify workflow app has latest version deployed
- Check sessionStorage: `sessionStorage.getItem('feeAppUser')`

**Roles not working:**
- Log `user.roles` array
- Verify role names match (case-insensitive check included)
- Check user data in workflow app's Users sheet

---

## Contact

- **Workflow App:** Already configured and sending auth data
- **User Database:** Google Sheets (managed by workflow app)
- **No backend needed** for fee app authentication

---

**Status:** Ready to implement  
**Estimated Time:** 30-60 minutes
