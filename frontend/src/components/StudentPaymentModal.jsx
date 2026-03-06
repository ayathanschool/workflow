import React from 'react';
import { CheckCircle, XCircle, Edit } from 'lucide-react';

export default function StudentPaymentModal({ 
  request, 
  payments, 
  loading, 
  markingPayment,
  bulkMarkingPaid,
  selectedStudents,
  onSelectStudent,
  onSelectAll,
  onClearSelection,
  onMarkPaid, 
  onUpdatePayment,
  onBulkMarkPaid,
  onClose 
}) {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading student payments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!payments) {
    return null;
  }

  const { students, summary } = payments;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Student Payment Tracking
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {request.purpose} • {request.class}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Students</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{summary.totalStudents}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{summary.paidCount}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{summary.pendingCount}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Collected</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">₹{summary.totalCollected}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Progress</p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{summary.collectionPercentage}%</p>
            </div>
          </div>

          {/* Bulk Actions */}
          {summary.pendingCount > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                onClick={onSelectAll}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Select All Pending
              </button>
              {selectedStudents.size > 0 && (
                <>
                  <button
                    onClick={onClearSelection}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={onBulkMarkPaid}
                    disabled={bulkMarkingPaid}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-1 disabled:cursor-not-allowed transition-colors"
                  >
                    {bulkMarkingPaid ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Marking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Mark {selectedStudents.size} as Paid
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Student List */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No students in this request
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => (
                <div
                  key={student.paymentId}
                  className={`border rounded-lg p-4 transition-colors ${
                    student.paymentStatus === 'Paid'
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : selectedStudents.has(student.paymentId)
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox for pending payments */}
                    {student.paymentStatus === 'Pending' && (
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.paymentId)}
                        onChange={() => onSelectStudent(student.paymentId)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    
                    {/* Student Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {student.studentName}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {student.studentAdmNo}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            student.paymentStatus === 'Paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {student.paymentStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Expected: <span className="font-medium">₹{student.expectedAmount}</span>
                        </span>
                        <span className={`font-medium ${
                          student.paidAmount > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          Paid: ₹{student.paidAmount}
                        </span>
                        {student.paidDate && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            on {new Date(student.paidDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {student.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Note: {student.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {student.paymentStatus === 'Pending' ? (
                        <button
                          onClick={() => onMarkPaid(student.paymentId, request.requestId, student.expectedAmount)}
                          disabled={markingPayment === student.paymentId}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {markingPayment === student.paymentId ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Marking...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Mark Paid
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdatePayment(student.paymentId, request.requestId, student.paidAmount)}
                          disabled={markingPayment === student.paymentId}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          {markingPayment === student.paymentId ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Updating...
                            </>
                          ) : (
                            <>
                              <Edit className="w-4 h-4" />
                              Edit
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium">Total: ₹{summary.totalCollected} / ₹{summary.totalExpected}</p>
              {summary.totalCollected < summary.totalExpected && (
                <p className="text-xs mt-1">
                  Remaining: ₹{summary.totalExpected - summary.totalCollected}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
