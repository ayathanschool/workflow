import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CreditCard, Receipt, Users, AlertTriangle, Bell,
  Menu, X, RefreshCw
} from 'lucide-react';

// Import modern components
import FeeCollectionDashboard from './FeeCollectionDashboard';
import ModernPaymentForm from './ModernPaymentForm';
import TransactionHistory from './TransactionHistory';
import StudentsView from './StudentsView';
import OutstandingFeesView from './OutstandingFeesView';
import DefaultersReminderView from './DefaultersReminderView';

const ModernFeeCollection = ({ user, apiBaseUrl }) => {
  // Helper to strip "STD " prefix from class names
  const stripStdPrefix = (className) => {
    if (!className) return '';
    return String(className).replace(/^STD\s+/i, '');
  };

  // Determine user role and access level
  const normalizedRoles = (user?.roles || []).map(r => String(r).toLowerCase());
  const isSuperAdmin = normalizedRoles.some(r => r === 'super admin' || r === 'superadmin' || r === 'super_admin');
  const isAccounts = normalizedRoles.some(r => r.includes('accounts') || r === 'accountant' || r === 'account');
  const isHM = normalizedRoles.some(r => r.includes('h m') || r === 'hm' || r.includes('head'));
  const isClassTeacher = Boolean(user?.classTeacherFor || user?.class);
  // Only restrict HM/Class Teacher if NOT Accounts and NOT Super Admin
  const isRestrictedRole = !isSuperAdmin && !isAccounts && (isHM || isClassTeacher);
  
  const [activeView, setActiveView] = useState(isRestrictedRole ? 'reminders' : 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    students: [],
    feeHeads: [],
    transactions: []
  });
  const [preselectedStudent, setPreselectedStudent] = useState(null);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, feeHeadsRes, transactionsRes] = await Promise.all([
        fetch(`${apiBaseUrl}?action=getStudents`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}?action=feeheads`, { cache: 'no-store' }),
        fetch(`${apiBaseUrl}?action=transactions`, { cache: 'no-store' })
      ]);

      const studentsData = await studentsRes.json();
      const feeHeadsData = await feeHeadsRes.json();
      const transactionsData = await transactionsRes.json();

      // Helper to extract array from various response shapes
      const extractArray = (response) => {
        if (Array.isArray(response)) return response;
        if (response?.data && Array.isArray(response.data)) return response.data;
        if (response?.data?.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
      };

      const students = extractArray(studentsData);
      const feeHeads = extractArray(feeHeadsData);
      const transactions = extractArray(transactionsData);

      // Deduplicate students by admNo
      const uniqueStudents = students.reduce((acc, student) => {
        const existingIndex = acc.findIndex(s => s.admNo === student.admNo);
        if (existingIndex === -1) {
          acc.push(student);
        }
        return acc;
      }, []);

      setData({
        students: uniqueStudents,
        feeHeads,
        transactions
      });
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load fee collection data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiBaseUrl]);

  const handleNavigateToPayment = (student) => {
    setPreselectedStudent(student);
    setActiveView('payment');
  };

  const handlePaymentSuccess = (receiptData) => {
    // Don't reload data - let user see receipt
    // Data will reload when they click "New Payment"
    setPreselectedStudent(null);
  };

  // Filter menu items based on user role
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600 dark:text-blue-400' },
    { id: 'payment', label: 'New Payment', icon: CreditCard, color: 'text-green-600 dark:text-green-400' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, color: 'text-purple-600 dark:text-purple-400' },
    { id: 'students', label: 'Students', icon: Users, color: 'text-indigo-600 dark:text-indigo-400' },
    { id: 'outstanding', label: 'Outstanding', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
    { id: 'reminders', label: 'Reminders', icon: Bell, color: 'text-orange-600 dark:text-orange-400' }
  ];

  // HM and Class Teachers see only Reminders tab
  const menuItems = isRestrictedRole 
    ? allMenuItems.filter(item => item.id === 'reminders')
    : allMenuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading fee collection data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar disabled: unified navigation via top tabs */}
      <aside
        className={`hidden`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Fee Collection
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id !== 'payment') {
                    setPreselectedStudent(null);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? item.color : ''}`} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.role || 'Staff'}
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top tabs for module navigation (all screen sizes) */}
        <div className="sticky top-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isRestrictedRole ? 'Fee Defaulters & Reminders' : 'Fee Collection'}
              </h2>
              {isRestrictedRole ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isHM ? 'Head Master - All Classes' : `Class Teacher - ${stripStdPrefix(user?.classTeacherFor || user?.class || '')}`}
                </p>
              ) : (
                (isAccounts || isSuperAdmin) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isAccounts ? 'Accounts - Full Fee Module' : 'Super Admin - Full Access'}
                  </p>
                )
              )}
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
            >
              Refresh
            </button>
          </div>
          {/* Only show tabs if there's more than one option */}
          {menuItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-sm ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
          {activeView === 'dashboard' && (
            <FeeCollectionDashboard
              transactions={data.transactions}
              students={data.students}
              feeHeads={data.feeHeads}
              onNavigate={(view) => setActiveView(view)}
            />
          )}

          {activeView === 'payment' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Payment</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Process fee payments for students
                </p>
              </div>
              <ModernPaymentForm
                students={data.students}
                feeHeads={data.feeHeads}
                transactions={data.transactions}
                apiBaseUrl={apiBaseUrl}
                onPaymentSuccess={handlePaymentSuccess}
                onNewPayment={loadData}
                preselectedStudent={preselectedStudent}
              />
            </div>
          )}

          {activeView === 'transactions' && (
            <TransactionHistory
              transactions={data.transactions}
              onVoidReceipt={(receiptNo) => {
                // Implement void receipt functionality
                console.log('Void receipt:', receiptNo);
                alert('Void receipt feature - would call API endpoint');
              }}
              onRefresh={loadData}
            />
          )}

          {activeView === 'students' && (
            <StudentsView
              students={data.students}
              feeHeads={data.feeHeads}
              transactions={data.transactions}
              onNavigateToPayment={handleNavigateToPayment}
            />
          )}

          {activeView === 'outstanding' && (
            <OutstandingFeesView
              students={data.students}
              feeHeads={data.feeHeads}
              transactions={data.transactions}
              onNavigateToPayment={handleNavigateToPayment}
            />
          )}

          {activeView === 'reminders' && (
            <DefaultersReminderView
              user={user}
              students={data.students}
              feeHeads={data.feeHeads}
              transactions={data.transactions}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default ModernFeeCollection;
