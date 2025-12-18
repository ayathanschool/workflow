import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Fee Collection System</h2>
        <p className="text-gray-600">Authenticating...</p>
      </div>
    </div>
  );
}
