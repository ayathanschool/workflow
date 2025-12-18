import { AlertTriangle, Lock } from 'lucide-react';

export default function NotAuthenticatedScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
      <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <Lock className="h-10 w-10 text-red-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Authentication Required
        </h1>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm text-yellow-800 font-semibold">Access Restricted</p>
              <p className="text-sm text-yellow-700 mt-1">
                This application cannot be accessed directly.
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-gray-600 mb-2">
          Please access the Fee Collection system through the main workflow application.
        </p>
        
        <p className="text-sm text-gray-500">
          You must be logged in to the school management system to use this feature.
        </p>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
