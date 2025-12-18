import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Users, AlertCircle, Calendar,
  ArrowUp, ArrowDown, Clock, CheckCircle, XCircle
} from 'lucide-react';

const FeeCollectionDashboard = ({ transactions, students, feeHeads, onNavigate }) => {
  const [timeRange, setTimeRange] = useState('month'); // today, week, month, year
  const [stats, setStats] = useState(null);

  useEffect(() => {
    calculateStats();
  }, [transactions, timeRange]);

  const calculateStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate;
    switch(timeRange) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
    }

    const validTransactions = (transactions || []).filter(t => !t.void && t.date);
    const rangeTransactions = validTransactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate;
    });

    const totalCollected = rangeTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0) + (Number(t.fine) || 0), 0);
    const todayCollections = validTransactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.toDateString() === today.toDateString();
    });
    const todayTotal = todayCollections.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // Calculate expected vs collected
    const totalExpected = (students || []).reduce((sum, student) => {
      const studentFees = (feeHeads || []).filter(f => f.class === student.class);
      return sum + studentFees.reduce((fSum, f) => fSum + (Number(f.amount) || 0), 0);
    }, 0);

    const totalActuallyCollected = validTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const collectionRate = totalExpected > 0 ? (totalActuallyCollected / totalExpected * 100) : 0;

    // Outstanding calculations
    const studentPayments = new Map();
    validTransactions.forEach(t => {
      const key = `${t.admNo}-${t.feeHead}`;
      studentPayments.set(key, (studentPayments.get(key) || 0) + (Number(t.amount) || 0));
    });

    let totalOutstanding = 0;
    let studentsWithOutstanding = new Set();
    (students || []).forEach(student => {
      const studentFees = (feeHeads || []).filter(f => f.class === student.class);
      studentFees.forEach(fee => {
        const key = `${student.admNo}-${fee.feeHead}`;
        const paid = studentPayments.get(key) || 0;
        const balance = Math.max(0, (Number(fee.amount) || 0) - paid);
        if (balance > 0) {
          totalOutstanding += balance;
          studentsWithOutstanding.add(student.admNo);
        }
      });
    });

    // Payment modes breakdown
    const modeBreakdown = {};
    rangeTransactions.forEach(t => {
      const mode = t.mode || 'Cash';
      modeBreakdown[mode] = (modeBreakdown[mode] || 0) + (Number(t.amount) || 0);
    });

    // Daily trend for last 7 days
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTotal = validTransactions
        .filter(t => t.date === dateStr)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      dailyTrend.push({ date: dateStr, amount: dayTotal });
    }

    setStats({
      totalCollected,
      todayTotal,
      todayTransactions: todayCollections.length,
      totalTransactions: rangeTransactions.length,
      collectionRate: collectionRate.toFixed(1),
      totalOutstanding,
      studentsWithOutstanding: studentsWithOutstanding.size,
      modeBreakdown,
      dailyTrend,
      avgDailyCollection: dailyTrend.length > 0 ? dailyTrend.reduce((s, d) => s + d.amount, 0) / dailyTrend.length : 0
    });
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time fee collection overview</p>
        </div>
        <div className="flex gap-2">
          {['today', 'week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Collected */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 opacity-70" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium opacity-90">Total Collected</p>
            <p className="text-3xl font-bold">₹{stats.totalCollected.toLocaleString('en-IN')}</p>
            <p className="text-xs opacity-75">{stats.totalTransactions} transactions</p>
          </div>
        </div>

        {/* Today's Collection */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Calendar className="h-6 w-6" />
            </div>
            <Clock className="h-5 w-5 opacity-70" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium opacity-90">Today's Collection</p>
            <p className="text-3xl font-bold">₹{stats.todayTotal.toLocaleString('en-IN')}</p>
            <p className="text-xs opacity-75">{stats.todayTransactions} payments today</p>
          </div>
        </div>

        {/* Collection Rate */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm">
                {stats.collectionRate >= 75 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                <span className="font-medium">{stats.collectionRate}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium opacity-90">Collection Rate</p>
            <div className="mt-2 bg-white/20 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${Math.min(100, stats.collectionRate)}%` }}
              />
            </div>
            <p className="text-xs opacity-75 mt-2">Avg ₹{Math.round(stats.avgDailyCollection).toLocaleString('en-IN')}/day</p>
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
             onClick={() => onNavigate && onNavigate('outstanding')}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-6 w-6" />
            </div>
            <Users className="h-5 w-5 opacity-70" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium opacity-90">Outstanding</p>
            <p className="text-3xl font-bold">₹{stats.totalOutstanding.toLocaleString('en-IN')}</p>
            <p className="text-xs opacity-75">{stats.studentsWithOutstanding} students pending</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">7-Day Trend</h3>
          <div className="space-y-3">
            {stats.dailyTrend.map((day, idx) => {
              const maxAmount = Math.max(...stats.dailyTrend.map(d => d.amount));
              const percentage = maxAmount > 0 ? (day.amount / maxAmount * 100) : 0;
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8">{dayName}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                      ₹{day.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Mode Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Payment Methods</h3>
          <div className="space-y-4">
            {Object.entries(stats.modeBreakdown).map(([mode, amount], idx) => {
              const total = Object.values(stats.modeBreakdown).reduce((s, a) => s + a, 0);
              const percentage = total > 0 ? (amount / total * 100) : 0;
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
              
              return (
                <div key={mode}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{mode}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      ₹{amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`${colors[idx % colors.length]} rounded-full h-2 transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {percentage.toFixed(1)}% of total
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate && onNavigate('payment')}
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
          >
            <div className="p-2 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Payment</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Collect fee</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('transactions')}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
          >
            <div className="p-2 bg-green-600 rounded-lg group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">View History</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">All transactions</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('outstanding')}
            className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors group"
          >
            <div className="p-2 bg-orange-600 rounded-lg group-hover:scale-110 transition-transform">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Outstanding</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stats.studentsWithOutstanding} pending</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('students')}
            className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
          >
            <div className="p-2 bg-purple-600 rounded-lg group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Students</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fee status</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeCollectionDashboard;
