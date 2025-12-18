import { useAuth } from '../App';
import { DollarSign, Users, BookOpen, BarChart3, Settings, AlertTriangle } from 'lucide-react';
import RoleGuard from './RoleGuard';

export default function FeeAppContent() {
  const { user, hasRole } = useAuth();

  // Define role-based permissions
  const isSuperAdmin = hasRole('super admin') || user?.role === 'admin';
  const isAccounts = user?.role === 'accounts' || hasRole('account');
  const isHeadmaster = user?.role === 'hm' || hasRole('h m');
  const isClassTeacher = user?.role === 'class_teacher' || hasRole('class teacher');
  const isTeacher = user?.role === 'teacher' || hasRole('teacher');
  
  // Full admin access for Super Admin and Accounts
  const hasFullAccess = isSuperAdmin || isAccounts;
  
  // Can view all classes defaulters
  const canViewAllDefaulters = hasFullAccess || isHeadmaster;
  
  // Managed class for class teachers
  const managedClass = user?.classTeacherFor || user?.class;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fee Collection System</h1>
                <p className="text-sm text-gray-500">Ayathan School</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user?.picture && (
                <img 
                  src={user.picture} 
                  alt={user.name}
                  className="w-10 h-10 rounded-full border-2 border-blue-200"
                />
              )}
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role || user?.workflowRoles?.join(', ') || 'User'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Welcome, {user?.name}!</h2>
          <p className="text-blue-100">
            {hasFullAccess
              ? 'Full access to fee management and all features'
              : isHeadmaster
              ? 'View fee defaulters across all classes'
              : isClassTeacher
              ? `View fee defaulters for your class: ${managedClass}`
              : 'View fee information for your classes'}
          </p>
        </div>

        {/* Super Admin / Accounts - Full Access Section */}
        <RoleGuard requiredRoles={['super admin', 'account']}>
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Full Administrative Access
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Users className="h-8 w-8" />}
                title="Manage All Fees"
                description="View and manage fees for all classes in the school"
                color="blue"
                action={() => alert('Navigate to All Classes Fee Management')}
              />
              <FeatureCard
                icon={<DollarSign className="h-8 w-8" />}
                title="Fee Structure"
                description="Configure fee amounts, categories, and payment terms"
                color="green"
                action={() => alert('Navigate to Fee Structure settings')}
              />
              <FeatureCard
                icon={<BarChart3 className="h-8 w-8" />}
                title="Reports & Analytics"
                description="Generate collection reports and financial analytics"
                color="purple"
                action={() => alert('Navigate to Reports')}
              />
            </div>
          </section>
        </RoleGuard>

        {/* Headmaster - View All Defaulters */}
        {isHeadmaster && !hasFullAccess && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              All Classes Fee Defaulters
            </h2>
            <DefaultersView scope="all" />
          </section>
        )}

        {/* Class Teacher - View Assigned Class Defaulters */}
        {isClassTeacher && !hasFullAccess && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Fee Defaulters - {managedClass}
            </h2>
            <DefaultersView scope="class" className={managedClass} />
          </section>
        )}

        {/* Teacher Section */}
        <RoleGuard requiredRoles={['teacher']}>
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Your Classes
            </h2>
            {user?.classes && user.classes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.classes.map((className) => (
                  <ClassCard key={className} className={className} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-8 text-center">
                <p className="text-gray-500">No classes assigned</p>
              </div>
            )}
          </section>
        </RoleGuard>

        {/* System Information */}
        <section className="mt-12">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">System Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-blue-600 font-medium">Logged in as:</p>
                <p className="text-blue-900">{user?.email}</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Role:</p>
                <p className="text-blue-900">{user?.role || user?.workflowRoles?.join(', ')}</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Classes:</p>
                <p className="text-blue-900">{user?.classes?.length || 0} classes</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Subjects:</p>
                <p className="text-blue-900">{user?.subjects?.length || 0} subjects</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            © 2025 Ayathan School - Fee Collection System
          </p>
        </div>
      </footer>
    </div>
  );
}

// Defaulters View Component
function DefaultersView({ scope, className }) {
  // Mock data - replace with actual API call
  const allDefaulters = [
    { class: 'STD 10A', name: 'Amit Singh', rollNo: '10A-15', pending: '₹2,500', lastPaid: 'Oct 2025' },
    { class: 'STD 10A', name: 'Ravi Kumar', rollNo: '10A-22', pending: '₹5,000', lastPaid: 'Sep 2025' },
    { class: 'STD 7A', name: 'Priya Sharma', rollNo: '7A-08', pending: '₹2,500', lastPaid: 'Nov 2025' },
    { class: 'STD 8B', name: 'Sneha Patel', rollNo: '8B-12', pending: '₹3,000', lastPaid: 'Oct 2025' },
    { class: 'STD 6A', name: 'Rahul Mehta', rollNo: '6A-19', pending: '₹2,500', lastPaid: 'Nov 2025' },
  ];

  const defaulters = scope === 'all' 
    ? allDefaulters 
    : allDefaulters.filter(d => d.class === className);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Fee Defaulters List</h3>
            <p className="text-sm text-gray-500">
              {scope === 'all' ? 'All classes' : className} - {defaulters.length} student(s) pending
            </p>
          </div>
          <button className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-200 transition-colors">
            Download Report
          </button>
        </div>

        {defaulters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-semibold">No Fee Defaulters! 🎉</p>
            <p className="text-sm">All students have paid their fees on time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {scope === 'all' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Class</th>}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Roll No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Student Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pending Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {defaulters.map((student, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {scope === 'all' && (
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.class}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">{student.rollNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-orange-600 font-semibold">{student.pending}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{student.lastPaid}</td>
                    <td className="px-4 py-3 text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function FeatureCard({ icon, title, description, color, action }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  };

  return (
    <button
      onClick={action}
      className={`${colorClasses[color]} rounded-xl p-6 shadow-md hover:shadow-lg transition-all text-left w-full`}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}

function StatCard({ label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function TransactionRow({ studentName, amount, date, status }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div>
        <p className="font-medium text-gray-900">{studentName}</p>
        <p className="text-sm text-gray-500">{date}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{amount}</p>
        <span className={`text-xs px-2 py-1 rounded-full ${
          status === 'paid' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-orange-100 text-orange-800'
        }`}>
          {status === 'paid' ? '✓ Paid' : 'Pending'}
        </span>
      </div>
    </div>
  );
}

function ClassCard({ className }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{className}</h3>
          <p className="text-sm text-gray-500">View fee status</p>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Students: 30</span>
        <span className="text-green-600 font-semibold">90% Collected</span>
      </div>
    </div>
  );
}
