import React, { useState, useEffect } from 'react';
import { 
  Search, User, DollarSign, Calendar, CreditCard, Receipt,
  CheckCircle, XCircle, AlertCircle, ArrowRight, Printer, X
} from 'lucide-react';

const ModernPaymentForm = ({ students, feeHeads, transactions, apiBaseUrl, onPaymentSuccess, onNewPayment, preselectedStudent }) => {
  const [step, setStep] = useState(1); // 1: Select Student, 2: Select Fees, 3: Confirm & Pay, 4: Receipt
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedFees, setSelectedFees] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    mode: 'Cash',
    remarks: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [paidFees, setPaidFees] = useState([]);

  // Handle preselected student
  useEffect(() => {
    if (preselectedStudent && !selectedStudent) {
      setSelectedStudent(preselectedStudent);
      setStep(2); // Skip to fee selection
    }
  }, [preselectedStudent, selectedStudent]);

  // Filtered students based on search
  const minSearchChars = 1; // require at least 1 character before showing names
  const hasSufficientSearch = String(searchTerm || '').trim().length >= minSearchChars;
  const filteredStudents = (students || []).filter(s => {
    if (!hasSufficientSearch) return false; // do not show any names until user types
    const term = searchTerm.toLowerCase();
    return (
      String(s.admNo).toLowerCase().includes(term) ||
      s.name?.toLowerCase().includes(term) ||
      s.class?.toLowerCase().includes(term)
    );
  }).slice(0, 50);

  // Get applicable fees for selected student
  const applicableFees = selectedStudent 
    ? (feeHeads || []).filter(f => f.class === selectedStudent.class)
    : [];

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSearchTerm('');
    setStep(2);
    setLoading(true);

    // Local fine calculation: ₹25 per half month after due date (15th of month)
    const calculateFine = (dueDate) => {
      if (!dueDate) return 0;
      const due = new Date(dueDate);
      const today = new Date();
      if (today <= due) return 0;
      let halfMonthPeriods = 0;
      let current = new Date(due);
      current.setDate(16);
      while (current <= today) {
        halfMonthPeriods++;
        if (current.getDate() === 16) {
          current.setMonth(current.getMonth() + 1);
          current.setDate(1);
        } else {
          current.setDate(16);
        }
      }
      return halfMonthPeriods * 25;
    };

    try {
      // Use cached transactions to compute payment status instantly
      const studentTx = (transactions || [])
        .filter(tx => String(tx.admNo) === String(student.admNo))
        .filter(tx => !String(tx.void || '').toUpperCase().startsWith('Y'));

      const feesForClass = (feeHeads || []).filter(f => f.class === student.class);
      const computedPaidFees = [];
      const computedUnpaidFees = feesForClass.map(f => {
        const txForHead = studentTx.filter(tx => String(tx.feeHead || '').toLowerCase() === String(f.feeHead || '').toLowerCase());
        const totalPaid = txForHead.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const isPaid = totalPaid >= (Number(f.amount) || 0);
        const balance = Math.max(0, (Number(f.amount) || 0) - totalPaid);
        const lastPaymentDate = txForHead.reduce((latest, tx) => {
          const d = tx.date ? new Date(tx.date) : null;
          if (!d || isNaN(d.getTime())) return latest;
          return !latest || d > latest ? d : latest;
        }, null);

        if (isPaid) {
          computedPaidFees.push({
            feeHead: f.feeHead,
            amountPaid: totalPaid,
            lastPaidOn: lastPaymentDate ? lastPaymentDate.toISOString().split('T')[0] : '',
          });
        }

        return {
          feeHead: f.feeHead,
          amount: balance, // Use remaining balance if partial payment
          originalAmount: Number(f.amount) || 0,
          fine: balance > 0 ? calculateFine(f.dueDate) : 0,
          dueDate: f.dueDate,
          selected: false,
          isPaid,
          amountPaid: totalPaid,
          balance
        };
      }).filter(f => !f.isPaid); // Remove fully paid fees from payable list

      setPaidFees(computedPaidFees);
      setSelectedFees(computedUnpaidFees);
    } catch (err) {
      console.error('Error computing payment status:', err);
      setError('Failed to compute payment status. Please try again.');
      const fees = (feeHeads || [])
        .filter(f => f.class === student.class)
        .map(f => ({
          feeHead: f.feeHead,
          amount: Number(f.amount) || 0,
          originalAmount: Number(f.amount) || 0,
          fine: 0,
          dueDate: f.dueDate,
          selected: false,
          isPaid: false,
          amountPaid: 0,
          balance: Number(f.amount) || 0
        }));
      setSelectedFees(fees);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeeSelection = (index) => {
    setSelectedFees(prev => prev.map((fee, idx) => 
      idx === index ? { ...fee, selected: !fee.selected } : fee
    ));
  };

  const updateFeeAmount = (index, amount) => {
    setSelectedFees(prev => prev.map((fee, idx) => 
      idx === index ? { ...fee, amount: Number(amount) || 0 } : fee
    ));
  };

  const updateFeeFine = (index, fine) => {
    setSelectedFees(prev => prev.map((fee, idx) => 
      idx === index ? { ...fee, fine: Number(fine) || 0 } : fee
    ));
  };

  const selectedFeesTotal = selectedFees
    .filter(f => f.selected)
    .reduce((sum, f) => sum + (Number(f.amount) || 0) + (Number(f.fine) || 0), 0);

  const handlePayment = async () => {
    const items = selectedFees
      .filter(f => f.selected && f.amount > 0)
      .map(f => ({
        feeHead: f.feeHead,
        amount: f.amount,
        fine: f.fine
      }));

    if (!items.length) {
      setError('Please select at least one fee to pay');
      return;
    }

    setLoading(true);
    setError('');
    
    // OPTIMISTIC UI: Show receipt immediately with "Processing..." status
    const optimisticReceipt = {
      receiptNo: 'Processing...',
      date: paymentForm.date,
      student: selectedStudent,
      items,
      total: selectedFeesTotal,
      totalAmount: items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
      totalFine: items.reduce((sum, i) => sum + (Number(i.fine) || 0), 0),
      mode: paymentForm.mode,
      processing: true
    };
    
    setReceipt(optimisticReceipt);
    setStep(4); // Move to receipt step immediately
    
    try {
      const response = await fetch(apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'addPaymentBatch',
          date: paymentForm.date,
          admNo: selectedStudent.admNo,
          name: selectedStudent.name,
          cls: selectedStudent.class,
          mode: paymentForm.mode,
          items
        })
      });

      const result = await response.json();
      
      if (result.ok || result.status === 200) {
        // Update receipt with real receipt number
        const finalReceipt = {
          ...optimisticReceipt,
          receiptNo: result.receiptNo,
          date: result.date || paymentForm.date,
          processing: false,
          partialPayments: result.partialPayments
        };
        
        setReceipt(finalReceipt);
        
        // Call success callback if provided
        if (onPaymentSuccess) {
          onPaymentSuccess(finalReceipt);
        }
      } else {
        setError(result.error || result.message || 'Payment failed');
        setStep(3); // Go back to payment step on error
        setReceipt(null);
      }
    } catch (err) {
      setError('Failed to process payment: ' + err.message);
      setStep(3); // Go back to payment step on error
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedStudent(null);
    setSelectedFees([]);
    setSearchTerm('');
    setReceipt(null);
    setError('');
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      mode: 'Cash',
      remarks: ''
    });
    
    // Notify parent to reload data
    if (onNewPayment) {
      onNewPayment();
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center justify-between gap-2">
          {[
            { num: 1, label: 'Select Student', icon: User },
            { num: 2, label: 'Choose Fees', icon: DollarSign },
            { num: 3, label: 'Confirm Payment', icon: CheckCircle },
            { num: 4, label: 'Receipt', icon: Receipt }
          ].map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            
            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-green-600' :
                    isActive ? 'bg-blue-600' : 
                    'bg-gray-300 dark:bg-gray-700'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
                    ) : (
                      <Icon className={`h-5 w-5 lg:h-6 lg:w-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] lg:text-xs mt-1 lg:mt-2 font-medium hidden xs:block ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-1 mx-1 lg:mx-2 mt-4 lg:mt-6 rounded transition-all ${
                    step > s.num ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-600 dark:text-red-400 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 1: Select Student */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Select Student</h2>
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by admission number, name, or class..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Student List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {!hasSufficientSearch ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Start typing admission no. or name to search</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No students found</p>
              </div>
            ) : (
              filteredStudents.map((student, idx) => (
                <button
                  key={`${student.admNo}-${idx}`}
                  onClick={() => handleStudentSelect(student)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors text-left group border border-transparent hover:border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {student.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {student.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {student.admNo} • {student.class}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 2: Select Fees */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Student Info Header */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {selectedStudent.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedStudent.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedStudent.admNo} • {selectedStudent.class}</p>
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Change Student
              </button>
            </div>
          </div>

          {/* Already Paid Summary */}
          {paidFees.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <p className="font-medium text-green-700 dark:text-green-300">Already Paid</p>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {paidFees.map((pf, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{pf.feeHead}</span>
                    <span className="text-gray-600 dark:text-gray-400">Paid: ₹{pf.amountPaid.toLocaleString('en-IN')} {pf.lastPaidOn && `on ${new Date(pf.lastPaidOn).toLocaleDateString()}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Select Fee Heads</h2>
            
            {/* Select All Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedFees.length > 0 && selectedFees.every(f => f.selected)}
                onChange={(e) => {
                  const selectAll = e.target.checked;
                  setSelectedFees(prev => prev.map(f => ({ ...f, selected: selectAll })));
                }}
                className="h-5 w-5 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Select All ({selectedFees.filter(f => f.selected).length}/{selectedFees.length})
              </span>
            </label>
          </div>

          {/* Fee Selection */}
          <div className="space-y-3 mb-6">
            {selectedFees.map((fee, idx) => (
              <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${
                fee.selected
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={fee.selected}
                    onChange={() => toggleFeeSelection(idx)}
                    className="mt-1 h-5 w-5 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {fee.feeHead}
                          {fee.amountPaid > 0 && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                              Partial: ₹{fee.amountPaid.toLocaleString('en-IN')} paid
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Due: {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : '-'}
                          {fee.amountPaid > 0 && (
                            <span className="ml-2">• Original: ₹{fee.originalAmount?.toLocaleString('en-IN')}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          ₹{(Number(fee.amount) + Number(fee.fine)).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {fee.selected && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Amount
                          </label>
                          <input
                            type="number"
                            value={fee.amount}
                            onChange={(e) => updateFeeAmount(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Fine {fee.fine > 0 && <span className="text-orange-600">(Auto-calculated)</span>}
                          </label>
                          <input
                            type="number"
                            value={fee.fine}
                            onChange={(e) => updateFeeFine(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                            placeholder="0"
                          />
                          {fee.fine > 0 && fee.dueDate && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              ₹25 per half-month overdue since {new Date(fee.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Amount:</span>
              <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                ₹{selectedFeesTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedFees.filter(f => f.selected).length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm Payment */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Confirm Payment</h2>

          {/* Payment Details */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.mode}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, mode: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Student:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedStudent.name} ({selectedStudent.admNo})
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Class:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{selectedStudent.class}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fee Heads:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedFees.filter(f => f.selected).length} selected
                </span>
              </div>
              <div className="pt-3 border-t border-gray-300 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Amount:</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₹{selectedFeesTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handlePayment}
              disabled={loading || receipt !== null}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Process Payment
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Receipt */}
      {step === 4 && receipt && (
        <div className="space-y-6">
          {/* Success/Processing Banner */}
          <div className={`bg-gradient-to-r ${receipt.processing ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'} rounded-2xl shadow-xl p-6 text-white`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  {receipt.processing ? (
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                  ) : (
                    <CheckCircle className="h-10 w-10 text-white" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">
                  {receipt.processing ? 'Processing Payment...' : 'Payment Successful!'}
                </h2>
                <p className={receipt.processing ? 'text-blue-100' : 'text-green-100'}>
                  {receipt.processing 
                    ? 'Please wait while we generate your receipt...' 
                    : `Receipt ${receipt.receiptNo} has been generated successfully.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Receipt Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6 border-b border-gray-300 dark:border-gray-700 pb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                <Receipt className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Fee Payment Receipt</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Keep this receipt for your records</p>
            </div>

            {/* Receipt Content */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 mb-6 print:border-solid">
            <div className="text-center mb-6 pb-4 border-b border-gray-300 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">AYATHAN CENTRAL SCHOOL</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Fee Payment Receipt</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Receipt No:</span>
                <span className={`font-mono font-bold ${receipt.processing ? 'text-blue-600 animate-pulse' : 'text-gray-900 dark:text-gray-100'}`}>
                  {receipt.receiptNo}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {new Date(receipt.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Student:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{receipt.student.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Admission No:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{receipt.student.admNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Class:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{receipt.student.class}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Payment Mode:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{receipt.mode}</span>
              </div>
            </div>

            <div className="border-t border-b border-gray-300 dark:border-gray-700 py-4 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-700 dark:text-gray-300">Fee Head</th>
                    <th className="text-right py-2 text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="text-right py-2 text-gray-700 dark:text-gray-300">Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-800">
                      <td className="py-2 text-gray-900 dark:text-gray-100">{item.feeHead}</td>
                      <td className="text-right text-gray-900 dark:text-gray-100">₹{item.amount.toLocaleString('en-IN')}</td>
                      <td className="text-right text-gray-900 dark:text-gray-100">₹{item.fine.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Paid:</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                ₹{receipt.total.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 print:hidden">
            <button
              onClick={printReceipt}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="h-5 w-5" />
              Print Receipt
            </button>
            <button
              onClick={resetForm}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              New Payment
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernPaymentForm;
