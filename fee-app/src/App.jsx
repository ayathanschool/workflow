import { useState, useEffect, createContext, useContext } from 'react';
import LoadingScreen from './components/LoadingScreen';
import NotAuthenticatedScreen from './components/NotAuthenticatedScreen';
import FeeAppContent from './components/FeeAppContent';

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
        console.log('Restored user from sessionStorage:', parsedUser);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        sessionStorage.removeItem('feeAppUser');
      }
    }

    // Notify parent window that iframe is ready
    if (window.parent !== window) {
      console.log('Sending FEE_APP_READY message to parent');
      window.parent.postMessage({ type: 'FEE_APP_READY' }, '*');
    }

    // Listen for authentication data from parent window
    const handleMessage = (event) => {
      // IMPORTANT: Update this with your actual workflow app URL
      const allowedOrigins = [
        'http://localhost:5173',  // Local development
        'http://localhost:3000',  // Alternative local port
        // Add your production URL here:
        // 'https://your-workflow-app.vercel.app',
      ];
      
      // Security check - verify origin
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('❌ Rejected message from unauthorized origin:', event.origin);
        return;
      }
      
      if (event.data.type === 'AUTH_DATA' && event.data.user) {
        console.log('✅ Received authentication data:', event.data.user);
        
        const workflowUser = event.data.user;
        
        // Map workflow app user to fee app structure
        const feeAppUser = {
          // Original workflow data
          email: workflowUser.email,
          name: workflowUser.name,
          picture: workflowUser.picture,
          
          // Map roles from workflow to fee app permissions
          role: mapWorkflowRoleToFeeApp(workflowUser.roles),
          
          // Map class from classTeacherFor or classes
          class: workflowUser.classTeacherFor || (workflowUser.classes?.[0]) || '',
          
          // Original roles for detailed permissions
          workflowRoles: workflowUser.roles || [],
          classes: workflowUser.classes || [],
          subjects: workflowUser.subjects || [],
          classTeacherFor: workflowUser.classTeacherFor,
          
          // Username for fee app compatibility
          username: workflowUser.email?.split('@')[0] || workflowUser.email,
          
          // Mark as authenticated
          active: 'Y'
        };
        
        console.log('📋 Mapped user for fee app:', feeAppUser);
        
        setUser(feeAppUser);
        setIsAuthenticated(true);
        setIsLoading(false);
        
        // Store in sessionStorage for persistence within session
        sessionStorage.setItem('feeAppUser', JSON.stringify(feeAppUser));
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Set loading timeout (in case parent never sends data)
    const timeout = setTimeout(() => {
      if (!user) {
        console.warn('⏱️ Authentication timeout - no data received from parent');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  // Map workflow app roles to fee app roles
  const mapWorkflowRoleToFeeApp = (workflowRoles) => {
    if (!Array.isArray(workflowRoles)) return 'teacher';
    
    const rolesLower = workflowRoles.map(r => r.toLowerCase());
    
    // Priority 1: Super admin gets full access
    if (rolesLower.some(r => r.includes('super admin') || r.includes('superadmin'))) {
      return 'admin';
    }
    
    // Priority 2: Accounts gets full access
    if (rolesLower.some(r => r.includes('account'))) {
      return 'accounts';
    }
    
    // Priority 3: H M can view defaulters across all classes
    if (rolesLower.some(r => r.includes('h m') || r.includes('headmaster') || r.includes('principal'))) {
      return 'hm';
    }
    
    // Priority 4: Class teacher can view defaulters of assigned class
    if (rolesLower.some(r => r.includes('class teacher'))) {
      return 'class_teacher';
    }
    
    // Regular teacher - limited access
    if (rolesLower.some(r => r.includes('teacher'))) {
      return 'teacher';
    }
    
    // Default to teacher
    return 'teacher';
  };

  // Helper function to check if user has a specific role
  const hasRole = (role) => {
    if (!user) return false;
    
    // Check fee app role
    if (user.role?.toLowerCase() === role.toLowerCase()) return true;
    
    // Also check original workflow roles for detailed permissions
    if (user.workflowRoles && Array.isArray(user.workflowRoles)) {
      return user.workflowRoles.some(r => 
        r.toLowerCase().includes(role.toLowerCase())
      );
    }
    
    return false;
  };

  // Provide authentication context to entire app
  const authValue = {
    user,
    isAuthenticated,
    isLoading,
    hasRole
  };

  return (
    <AuthContext.Provider value={authValue}>
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

export default App;
