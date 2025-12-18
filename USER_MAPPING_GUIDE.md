# User Mapping: Workflow App ↔ Fee App

**Date:** December 17, 2025  
**Status:** Implemented

## Overview

The workflow app and fee app use different user structures. The fee app now automatically maps workflow app users to its own structure.

---

## User Structure Comparison

### Workflow App Users
```javascript
{
  email: "shilpa@ayathanschool.com",
  name: "Shilpa",
  roles: ["class teacher", "teacher"],
  classes: ["STD 6A", "STD 7A", "STD 10A", "STD 10B"],
  subjects: ["English", "English Grammar"],
  classTeacherFor: "STD 10A",
  picture: "https://..."
}
```

### Fee App Users (Original)
```javascript
{
  username: "shilpa@ayathanschool.com",
  password: "Shilpa",
  role: "teacher",
  class: "10A",
  name: "Shilpa",
  active: "Y"
}
```

---

## Automatic Mapping (Implemented)

When a user logs into the workflow app and accesses the Fee Collection tab, their data is automatically mapped:

### Role Mapping

| Workflow App Role | Fee App Role | Permissions |
|------------------|--------------|-------------|
| `super admin` | `admin` | Full access to all features |
| `h m` (Headmaster) | `admin` | Full access to all features |
| `class teacher` | `teacher` | Manage assigned class + view other classes |
| `teacher` | `teacher` | View assigned classes only |

### Field Mapping

```javascript
// Mapped User Structure in Fee App
{
  // Fee app fields
  username: email.split('@')[0],        // "shilpa"
  role: "teacher" or "admin",           // Mapped from workflow roles
  class: classTeacherFor || classes[0], // "STD 10A"
  name: name,                           // "Shilpa"
  active: "Y",                          // Always active
  
  // Additional workflow data preserved
  email: email,                         // "shilpa@ayathanschool.com"
  picture: picture,                     // Profile picture URL
  workflowRoles: roles,                 // Original roles array
  classes: classes,                     // All assigned classes
  subjects: subjects,                   // All subjects
  classTeacherFor: classTeacherFor      // Class management responsibility
}
```

---

## Example Mappings

### Example 1: Class Teacher
**Workflow App Login:**
- Email: `shilpa@ayathanschool.com`
- Roles: `["class teacher", "teacher"]`
- Classes: `["STD 6A", "STD 7A", "STD 10A", "STD 10B"]`
- ClassTeacherFor: `"STD 10A"`

**Mapped to Fee App:**
```javascript
{
  username: "shilpa",
  role: "teacher",
  class: "STD 10A",
  name: "Shilpa",
  active: "Y",
  email: "shilpa@ayathanschool.com",
  workflowRoles: ["class teacher", "teacher"]
}
```

**Fee App Access:**
- ✅ Can manage fees for STD 10A (their assigned class)
- ✅ Can view fee status for STD 6A, 7A, 10B (teaching classes)
- ❌ Cannot modify fee structure
- ❌ Cannot access other classes

---

### Example 2: Headmaster/Principal
**Workflow App Login:**
- Email: `principal@ayathanschool.com`
- Roles: `["h m", "headmaster"]`
- Classes: `[]`

**Mapped to Fee App:**
```javascript
{
  username: "principal",
  role: "admin",
  class: "",
  name: "Principal",
  active: "Y",
  email: "principal@ayathanschool.com",
  workflowRoles: ["h m", "headmaster"]
}
```

**Fee App Access:**
- ✅ Full access to all classes
- ✅ Can modify fee structure
- ✅ Can generate reports
- ✅ Administrative controls

---

### Example 3: Regular Teacher
**Workflow App Login:**
- Email: `anjali@ayathanschool.com`
- Roles: `["teacher"]`
- Classes: `["STD 8A"]`
- ClassTeacherFor: `null`

**Mapped to Fee App:**
```javascript
{
  username: "anjali",
  role: "teacher",
  class: "STD 8A",
  name: "Anjali",
  active: "Y",
  email: "anjali@ayathanschool.com",
  workflowRoles: ["teacher"]
}
```

**Fee App Access:**
- ✅ Can view fee status for STD 8A
- ❌ Cannot modify fees
- ❌ Cannot access other classes
- ❌ Read-only view

---

## Permission Logic

### Fee App Permissions by Role

#### Admin (Mapped from Super Admin/H M)
```javascript
const isAdmin = user.role === 'admin' || 
                hasRole('super admin') || 
                hasRole('h m');

if (isAdmin) {
  // Show all administrative features
  - All classes fee management
  - Fee structure configuration
  - Reports and analytics
  - Full CRUD operations
}
```

#### Teacher with Class Management (Class Teacher)
```javascript
const isClassTeacher = hasRole('class teacher');
const managedClass = user.classTeacherFor;

if (isClassTeacher && managedClass) {
  // Show class-specific features
  - Manage fees for {managedClass}
  - Mark payments received
  - View student fee status
  - Limited reporting for their class
}
```

#### Regular Teacher (View Only)
```javascript
const isTeacher = user.role === 'teacher';
const teachingClasses = user.classes;

if (isTeacher) {
  // Show view-only features
  - View fee status for assigned classes
  - See payment statistics
  - Read-only access
}
```

---

## Code Implementation

### Fee App: src/App.jsx

```javascript
// Role mapping function
const mapWorkflowRoleToFeeApp = (workflowRoles) => {
  if (!Array.isArray(workflowRoles)) return 'teacher';
  
  const rolesLower = workflowRoles.map(r => r.toLowerCase());
  
  // Super admin/H M -> admin
  if (rolesLower.some(r => 
    r.includes('super admin') || 
    r.includes('h m') || 
    r.includes('headmaster')
  )) {
    return 'admin';
  }
  
  // Everyone else -> teacher (with varying permissions)
  return 'teacher';
};

// When receiving auth data from workflow app
const feeAppUser = {
  username: workflowUser.email?.split('@')[0],
  role: mapWorkflowRoleToFeeApp(workflowUser.roles),
  class: workflowUser.classTeacherFor || workflowUser.classes?.[0] || '',
  name: workflowUser.name,
  active: 'Y',
  email: workflowUser.email,
  picture: workflowUser.picture,
  workflowRoles: workflowUser.roles,
  classes: workflowUser.classes,
  subjects: workflowUser.subjects,
  classTeacherFor: workflowUser.classTeacherFor
};
```

### Role Checking

```javascript
// Updated hasRole function
const hasRole = (role) => {
  if (!user) return false;
  
  // Check fee app role
  if (user.role?.toLowerCase() === role.toLowerCase()) return true;
  
  // Also check original workflow roles
  if (user.workflowRoles && Array.isArray(user.workflowRoles)) {
    return user.workflowRoles.some(r => 
      r.toLowerCase().includes(role.toLowerCase())
    );
  }
  
  return false;
};
```

---

## Testing Checklist

### ✅ Test Each User Type

#### Super Admin
- [ ] Login to workflow app as super admin
- [ ] Navigate to Fee Collection
- [ ] Verify role shows as "admin"
- [ ] Verify can see all administrative features
- [ ] Check console shows mapped user data

#### Headmaster
- [ ] Login as H M user
- [ ] Navigate to Fee Collection
- [ ] Verify role shows as "admin"
- [ ] Verify full access granted

#### Class Teacher (e.g., shilpa@ayathanschool.com)
- [ ] Login as class teacher
- [ ] Navigate to Fee Collection
- [ ] Verify role shows as "teacher"
- [ ] Verify sees "Class Fee Management - STD 10A"
- [ ] Verify can manage their assigned class
- [ ] Verify can view other teaching classes

#### Regular Teacher (e.g., anjali@ayathanschool.com)
- [ ] Login as regular teacher
- [ ] Navigate to Fee Collection
- [ ] Verify role shows as "teacher"
- [ ] Verify sees "Your Classes" section
- [ ] Verify read-only access

---

## Console Logging

When a user accesses the Fee Collection tab, check browser console for:

```
✅ Received authentication data: {email: "...", roles: [...]}
📋 Mapped user for fee app: {username: "...", role: "...", ...}
```

This helps debug any mapping issues.

---

## Future Enhancements

### Option 1: Sync User Databases
- Import workflow app users into fee app database
- Keep both databases in sync
- Fee app can work independently

### Option 2: Unified User Management
- Move fee app to use workflow app's Users sheet
- Single source of truth for user data
- Consistent permissions across apps

### Option 3: API-Based User Lookup
- Fee app queries workflow backend for user permissions
- Real-time permission checks
- More secure but requires backend access

---

## Troubleshooting

### Issue: User shows wrong role
**Check:**
1. Console log of received auth data
2. Console log of mapped user
3. Verify workflow app roles are correct in Users.csv

### Issue: User can't access expected features
**Check:**
1. User's `workflowRoles` array
2. `hasRole()` function logic
3. RoleGuard component `requiredRoles`

### Issue: Class not showing correctly
**Check:**
1. `classTeacherFor` field in workflow user
2. `classes` array fallback
3. Fee app `class` field after mapping

---

**Status:** Mapping Implemented ✅  
**Last Updated:** December 17, 2025
