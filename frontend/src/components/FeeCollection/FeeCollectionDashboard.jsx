import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Users, AlertCircle, Calendar,
  ArrowUp, ArrowDown, Clock, CheckCircle, XCircle, Bus
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

    // Helper: generate transport fee heads for a student respecting their start/end month
    const buildTransportFeeHeads = (student) => {
      const fee = Number(student.transportFee) || 0;
      if (!fee || !student.transportRoute) return [];
      const ayStart = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
      const ayIdx = (m) => m >= 6 ? m - 6 : m + 6;
      const startM = Number(student.transportStartMonth) || 6;
      const endM   = Number(student.transportEndMonth)   || 3;
      // Skip months already covered by class-level fee heads (avoids duplicates)
      const existingFeeHeadNames = new Set(
        (feeHeads || [])
          .filter(f => String(f.class || '').toLowerCase() === String(student.class || '').toLowerCase())
          .map(f => String(f.feeHead || '').toLowerCase())
      );
      return [
        { name: 'June',      m: 6,  dueDate: `${ayStart}-06-15` },
        { name: 'July',      m: 7,  dueDate: `${ayStart}-07-15` },
        { name: 'August',    m: 8,  dueDate: `${ayStart}-08-15` },
        { name: 'September', m: 9,  dueDate: `${ayStart}-09-15` },
        { name: 'October',   m: 10, dueDate: `${ayStart}-10-15` },
        { name: 'November',  m: 11, dueDate: `${ayStart}-11-15` },
        { name: 'December',  m: 12, dueDate: `${ayStart}-12-15` },
        { name: 'January',   m: 1,  dueDate: `${ayStart + 1}-01-15` },
        { name: 'February',  m: 2,  dueDate: `${ayStart + 1}-02-15` },
        { name: 'March',     m: 3,  dueDate: `${ayStart + 1}-03-15` },
      ]
      .filter(mo => { const i = ayIdx(mo.m); return i >= ayIdx(startM) && i <= ayIdx(endM); })
      .filter(mo => !existingFeeHeadNames.has(`transport ${mo.name.toLowerCase()}`))
      .map(mo => ({ feeHead: `Transport ${mo.name}`, amount: fee, dueDate: mo.dueDate }));
    };

    const validTransactions = (transactions || []).filter(t => !t.void && t.date);
    const nonWaiverValid = validTransactions.filter(t => String(t.mode || '').toLowerCase() !== 'waiver');
    const rangeTransactions = nonWaiverValid.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDate;
    });

    const totalCollected = rangeTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0) + (Number(t.fine) || 0), 0);
    const todayCollections = nonWaiverValid.filter(t => {
      const txDate = new Date(t.date);
      return txDate.toDateString() === today.toDateString();
    });
    const todayTotal = todayCollections.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    // Calculate expected vs collected (including due transport installments)
    const totalExpected = (students || []).reduce((sum, student) => {
      const classFeeTotal = (feeHeads || [])
        .filter(f => f.class === student.class)
        .reduce((fSum, f) => fSum + (Number(f.amount) || 0), 0);
      const transportTotal = buildTransportFeeHeads(student)
        .filter(tf => new Date(tf.dueDate) <= today)
        .reduce((s, tf) => s + tf.amount, 0);
      return sum + classFeeTotal + transportTotal;
    }, 0);

    const totalActuallyCollected = nonWaiverValid.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const collectionRate = totalExpected > 0 ? (totalActuallyCollected / totalExpected * 100) : 0;

    // Build payment lookup (include waivers so outstanding calculates correctly)
    const studentPayments = new Map();
    validTransactions.forEach(t => {
      const key = `${t.admNo}-${t.feeHead}`;
      studentPayments.set(key, (studentPayments.get(key) || 0) + (Number(t.amount) || 0));
    });

    // Outstanding calculations (class fees + transport fees)
    let totalOutstanding = 0;
    let schoolOutstanding = 0;
    let transportOutstanding = 0;
    let studentsWithOutstanding = new Set();
    const routeMap = {};
    const classMap = {};

    (students || []).forEach(student => {
      // Class fees
      const studentFees = (feeHeads || []).filter(f => f.class === student.class);
      if (studentFees.length > 0) {
        const cls = student.class || 'Unknown';
        if (!classMap[cls]) classMap[cls] = { studentCount: 0, outstanding: 0 };
        classMap[cls].studentCount++;
        studentFees.forEach(fee => {
          const key = `${student.admNo}-${fee.feeHead}`;
          const paid = studentPayments.get(key) || 0;
          const balance = Math.max(0, (Number(fee.amount) || 0) - paid);
          if (balance > 0) {
            totalOutstanding += balance;
            schoolOutstanding += balance;
            studentsWithOutstanding.add(student.admNo);
            classMap[cls].outstanding += balance;
          }
        });
      }

      // Transport fees
      const route = (student.transportRoute || '').trim();
      if (route) {
        if (!routeMap[route]) routeMap[route] = { studentCount: 0, outstanding: 0 };
        routeMap[route].studentCount++;
        buildTransportFeeHeads(student).forEach(tf => {
          if (new Date(tf.dueDate) > today) return;
          const key = `${student.admNo}-${tf.feeHead}`;
          const paid = studentPayments.get(key) || 0;
          const balance = Math.max(0, tf.amount - paid);
          if (balance > 0) {
            transportOutstanding += balance;
            totalOutstanding += balance;
            studentsWithOutstanding.add(student.admNo);
            routeMap[route].outstanding += balance;
          }
        });
      }
    });

    // Transport collected (from actual non-waiver transactions)
    const transportCollected = nonWaiverValid
      .filter(t => (t.feeHead || '').toLowerCase().startsWith('transport '))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Route collected amounts (from non-waiver transactions with routeNo)
    const routeCollectedMap = {};
    nonWaiverValid
      .filter(t => (t.feeHead || '').toLowerCase().startsWith('transport ') && t.routeNo)
      .forEach(t => {
        const r = (t.routeNo || '').trim();
        if (r) routeCollectedMap[r] = (routeCollectedMap[r] || 0) + (Number(t.amount) || 0);
      });

    const routeStats = Object.entries(routeMap)
      .map(([route, data]) => ({
        route,
        studentCount: data.studentCount,
        outstanding: data.outstanding,
        collected: routeCollectedMap[route] || 0,
      }))
      .sort((a, b) => a.route.localeCompare(b.route));

    const schoolCollected = nonWaiverValid
      .filter(t => !(t.feeHead || '').toLowerCase().startsWith('transport '))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const classCollectedMap = {};
    nonWaiverValid
      .filter(t => !(t.feeHead || '').toLowerCase().startsWith('transport '))
      .forEach(t => {
        const cls = (t.class || '').trim();
        if (cls) classCollectedMap[cls] = (classCollectedMap[cls] || 0) + (Number(t.amount) || 0);
      });

    const classStats = Object.entries(classMap)
      .map(([cls, data]) => ({
        cls,
        studentCount: data.studentCount,
        outstanding: data.outstanding,
        collected: classCollectedMap[cls] || 0,
      }))
      .sort((a, b) => a.cls.localeCompare(b.cls));

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
      schoolOutstanding,
      studentsWithOutstanding: studentsWithOutstanding.size,
      modeBreakdown,
      dailyTrend,
      avgDailyCollection: dailyTrend.length > 0 ? dailyTrend.reduce((s, d) => s + d.amount, 0) / dailyTrend.length : 0,
      transportCollected,
      transportOutstanding,
      transportStudents: Object.values(routeMap).reduce((s, r) => s + r.studentCount, 0),
      routeStats,
      schoolCollected,
      schoolStudents: Object.values(classMap).reduce((s, c) => s + c.studentCount, 0),
      classStats,
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
            <div className="mt-3 pt-3 border-t border-white/25 grid grid-cols-2 gap-2">
              <div className="bg-white/15 rounded-lg px-2 py-1.5">
                <p className="text-xs opacity-80">🏫 School</p>
                <p className="text-sm font-bold">₹{stats.schoolOutstanding.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/15 rounded-lg px-2 py-1.5">
                <p className="text-xs opacity-80">🚌 Transport</p>
                <p className="text-sm font-bold">₹{stats.transportOutstanding.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* School Fee Summary */}
      {stats.schoolStudents > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">School Fee Summary</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Students</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.schoolStudents}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Collected</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">₹{stats.schoolCollected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">₹{stats.schoolOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {stats.classStats.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Class-wise Breakdown</h4>
              <div className="space-y-3">
                {stats.classStats.map(c => {
                  const total = c.collected + c.outstanding;
                  const pct = total > 0 ? (c.collected / total * 100) : 0;
                  return (
                    <div key={c.cls} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">🏫 {c.cls}</p>
                        <p className="text-xs text-gray-400">{c.studentCount} student{c.studentCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-green-600 dark:text-green-400 font-medium">₹{c.collected.toLocaleString('en-IN')}</span>
                          <span className="text-red-500 font-medium">₹{c.outstanding.toLocaleString('en-IN')} due</span>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 rounded-full h-2 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transport Fee Summary */}
      {stats.transportStudents > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Bus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transport Fee Summary</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Students</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.transportStudents}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Collected</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">₹{stats.transportCollected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">₹{stats.transportOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {stats.routeStats.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Route-wise Breakdown</h4>
              <div className="space-y-3">
                {stats.routeStats.map(r => {
                  const total = r.collected + r.outstanding;
                  const pct = total > 0 ? (r.collected / total * 100) : 0;
                  return (
                    <div key={r.route} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">🚌 {r.route}</p>
                        <p className="text-xs text-gray-400">{r.studentCount} student{r.studentCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-green-600 dark:text-green-400 font-medium">₹{r.collected.toLocaleString('en-IN')}</span>
                          <span className="text-red-500 font-medium">₹{r.outstanding.toLocaleString('en-IN')} due</span>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-amber-500 rounded-full h-2 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default FeeCollectionDashboard;
