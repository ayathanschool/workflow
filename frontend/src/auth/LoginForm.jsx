import { User, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

export default function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCoopWarning, setShowCoopWarning] = useState(false);
  const googleAuth = useGoogleAuth();
  const googleAvailable = !!googleAuth && typeof googleAuth.loginWithGoogle === 'function' && !googleAuth.error;
  
  // Check for Cross-Origin-Opener-Policy errors in console
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = function(...args) {
      if (args.some(arg => 
        typeof arg === 'string' && (
          arg.includes('Cross-Origin-Opener-Policy') || 
          arg.includes('COOP') || 
          arg.includes('window.closed')
        ))) {
        setShowCoopWarning(true);
      }
      originalConsoleError.apply(console, args);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email');
      return;
    }
    try {
      setSubmitting(true);
      const data = await api.login(email, password);
      if (data && data.error) throw new Error(data.error);
      onSuccess && onSuccess(data);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-500">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md transition-colors duration-300">
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">School Workflow System</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 transition-colors duration-300">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {showCoopWarning && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Browser Security Notice</p>
              <p className="mt-1">We've detected a Cross-Origin-Opener-Policy issue with Google login. Please try:</p>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Disabling popup blockers</li>
                <li>Using email login instead</li>
                <li>Trying a different browser</li>
              </ol>
            </div>
          </div>
        )}

        {googleAvailable && !manualMode && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => googleAuth.loginWithGoogle()}
              disabled={googleAuth.loading}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 px-4 rounded-lg font-medium shadow-sm disabled:opacity-50"
            >
              {googleAuth.loading ? 'Connecting...' : 'Sign in with Google'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Use email/password instead
              </button>
            </div>
          </div>
        )}

        {(!googleAvailable || manualMode) && (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password (optional)"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium btn-animate disabled:opacity-60"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            {googleAvailable && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Use Google instead
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Contact your administrator for login credentials</p>
          <p className="mt-1 text-xs">Google sign-in is preferred if available.</p>
        </div>
      </div>
    </div>
  );
}
