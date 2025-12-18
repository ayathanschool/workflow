/**
 * ====== FEE COLLECTION MANAGEMENT SYSTEM ======
 * This file handles all fee collection, payment tracking, and receipt management
 * Think of this as your "Accounts Department"
 */

/**
 * Get all fee heads for a specific class
 */
function getFeeHeads(className) {
  const sh = _getSheet('FeeHeads');
  const headers = _headers(sh);
  const list = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => !className || String(r.class || '').toLowerCase() === String(className).toLowerCase());
  
  return list.map(r => ({
    class: r.class || '',
    feeHead: r.feeHead || '',
    amount: Number(r.amount) || 0,
    dueDate: r.dueDate || ''
  }));
}

/**
 * Get all transactions/payments
 * Optional filters: admNo, className, feeHead, fromDate, toDate
 */
function getTransactions(filters) {
  filters = filters || {};
  const sh = _getSheet('Transactions');
  const headers = _headers(sh);
  let list = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    // Filter out empty rows (no receipt number or admission number)
    .filter(r => {
      const hasReceipt = String(r.receiptNo || '').trim() !== '';
      const hasAdmNo = String(r.admNo || '').trim() !== '';
      return hasReceipt && hasAdmNo;
    });
  
  // Apply filters
  if (filters.admNo) {
    list = list.filter(r => String(r.admNo || '').toLowerCase() === String(filters.admNo).toLowerCase());
  }
  if (filters.className) {
    list = list.filter(r => String(r.class || '').toLowerCase() === String(filters.className).toLowerCase());
  }
  if (filters.feeHead) {
    list = list.filter(r => String(r.feeHead || '').toLowerCase().includes(String(filters.feeHead).toLowerCase()));
  }
  if (filters.fromDate) {
    list = list.filter(r => _isoDateString(r.date) >= _isoDateString(filters.fromDate));
  }
  if (filters.toDate) {
    list = list.filter(r => _isoDateString(r.date) <= _isoDateString(filters.toDate));
  }
  
  return list.map(r => ({
    date: r.date || '',
    receiptNo: r.receiptNo || '',
    admNo: r.admNo || '',
    name: r.name || '',
    class: r.class || '',
    feeHead: r.feeHead || '',
    amount: Number(r.amount) || 0,
    fine: Number(r.fine) || 0,
    mode: r.mode || '',
    void: r.void || ''
  }));
}

/**
 * Get payment status for a specific student and fee head
 * Returns: { totalPaid, totalFine, payments: [], isFullyPaid, balance }
 * Note: Fine is tracked separately but not required for isFullyPaid status
 */
function getPaymentStatus(admNo, feeHead, expectedAmount) {
  if (!admNo || !feeHead) {
    return { totalPaid: 0, totalFine: 0, payments: [], isFullyPaid: false, balance: 0 };
  }
  
  const sh = _getSheet('Transactions');
  const headers = _headers(sh);
  const transactions = _rows(sh)
    .map(r => _indexByHeader(r, headers))
    .filter(r => {
      const admNoMatch = String(r.admNo || '').trim().toLowerCase() === String(admNo).trim().toLowerCase();
      const feeHeadMatch = String(r.feeHead || '').trim().toLowerCase() === String(feeHead).trim().toLowerCase();
      const notVoided = !String(r.void || '').toUpperCase().startsWith('Y');
      return admNoMatch && feeHeadMatch && notVoided;
    });
  
  let totalPaid = 0;
  let totalFine = 0;
  const payments = [];
  
  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const fine = Number(tx.fine) || 0;
    totalPaid += amount;
    totalFine += fine;
    
    payments.push({
      date: tx.date || '',
      receiptNo: tx.receiptNo || '',
      amount: amount,
      fine: fine,
      mode: tx.mode || ''
    });
  });
  
  // isFullyPaid checks only the fee amount (not fine) against expectedAmount
  // Fine is additional and doesn't affect payment completion status
  const isFullyPaid = expectedAmount ? (totalPaid >= Number(expectedAmount)) : (totalPaid > 0);
  const balance = expectedAmount ? Math.max(0, Number(expectedAmount) - totalPaid) : 0;
  
  return {
    totalPaid: totalPaid,
    totalFine: totalFine,
    payments: payments,
    isFullyPaid: isFullyPaid,
    balance: balance
  };
}

/**
 * Add payment for a student
 * body: { date, admNo, name, cls, mode, items:[{feeHead, amount, fine}] }
 * Note: Fine is optional per item and tracked separately from fee amount
 */
function addPayment(paymentData) {
  // Use lock to prevent concurrent receipt number collisions
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  
  try {
    // Wait up to 30 seconds for lock
    lockAcquired = lock.tryLock(30000);
    
    if (!lockAcquired) {
      throw new Error('System busy. Please try again in a moment.');
    }
    
    console.log('[addPayment] Lock acquired for:', paymentData.admNo);
    
    const sh = _getSheet('Transactions');
    
    const date = paymentData.date || _isoDateString(new Date());
    const items = Array.isArray(paymentData.items) ? paymentData.items : [];
    
    if (!items.length) {
      throw new Error('No payment items provided');
    }
    
    console.log('[addPayment] Processing', items.length, 'fee items');
    
    // Check for duplicate fee heads in the same batch
    const feeHeadCounts = {};
    items.forEach(item => {
      const feeHead = String(item.feeHead || '').trim().toLowerCase();
      feeHeadCounts[feeHead] = (feeHeadCounts[feeHead] || 0) + 1;
    });
    const duplicates = Object.keys(feeHeadCounts).filter(fh => feeHeadCounts[fh] > 1);
    if (duplicates.length > 0) {
      throw new Error('Duplicate fee heads in payment: ' + duplicates.join(', '));
    }
    
    // OPTIMIZED: Check for duplicate payments in batch
    const feeHeads = getFeeHeads(paymentData.cls);
    const feeHeadMap = {};
    feeHeads.forEach(f => {
      feeHeadMap[String(f.feeHead).trim().toLowerCase()] = f.amount;
    });
    
    // Get all existing payments for this student at once
    const existingTransactions = getTransactions({ admNo: paymentData.admNo });
    
    // Build payment status map for all fee heads in one pass
    const paymentStatusMap = {};
    existingTransactions.forEach(tx => {
      const feeHeadKey = String(tx.feeHead).trim().toLowerCase();
      if (!paymentStatusMap[feeHeadKey]) {
        paymentStatusMap[feeHeadKey] = { totalPaid: 0, totalFine: 0 };
      }
      if (!String(tx.void || '').toUpperCase().startsWith('Y')) {
        paymentStatusMap[feeHeadKey].totalPaid += Number(tx.amount) || 0;
        paymentStatusMap[feeHeadKey].totalFine += Number(tx.fine) || 0;
      }
    });
    
    // Validate items and build partial payment info
    const fullyPaidItems = [];
    const partialPaymentInfo = [];
    
    items.forEach(item => {
      const feeHeadKey = String(item.feeHead || '').trim().toLowerCase();
      const expectedAmount = feeHeadMap[feeHeadKey] || null;
      const status = paymentStatusMap[feeHeadKey] || { totalPaid: 0, totalFine: 0 };
      
      // Check if already fully paid
      if (expectedAmount && status.totalPaid >= expectedAmount) {
        fullyPaidItems.push(item.feeHead);
      } else if (status.totalPaid > 0) {
        // Track partial payments
        partialPaymentInfo.push({
          feeHead: item.feeHead,
          previouslyPaid: status.totalPaid,
          previousFine: status.totalFine,
          newPayment: item.amount,
          newFine: item.fine || 0,
          balance: Math.max(0, (expectedAmount || 0) - status.totalPaid - (item.amount || 0))
        });
      }
    });
    
    if (fullyPaidItems.length > 0) {
      console.log('[addPayment] Already paid items detected:', fullyPaidItems.join(', '));
      throw new Error(`Already fully paid: ${fullyPaidItems.join(', ')}`);
    }
    
    // Generate receipt number AFTER validations pass (inside lock)
    const receiptNo = _getNextReceiptNo(sh);
    console.log('[addPayment] Generated receipt:', receiptNo);
    
    console.log('[addPayment] All validation passed. Writing to sheet...');
    
    // Create rows with fine support
    const rows = items.map(item => [
      date,
      receiptNo,
      paymentData.admNo,
      paymentData.name,
      paymentData.cls,
      item.feeHead,
      Number(item.amount) || 0,
      Number(item.fine) || 0,
      paymentData.mode || 'Cash',
      '' // void column
    ]);
    
    // Append rows
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    
    console.log('[addPayment] Successfully wrote', rows.length, 'rows with receipt:', receiptNo);
    
    // Calculate totals for response
    const totalAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    const totalFine = items.reduce((sum, it) => sum + (Number(it.fine) || 0), 0);
    
    const response = {
      receiptNo: receiptNo,
      date: date,
      totalAmount: totalAmount,
      totalFine: totalFine,
      grandTotal: totalAmount + totalFine,
      partialPayments: partialPaymentInfo.length > 0 ? partialPaymentInfo : null
    };
    
    console.log('[addPayment] Payment completed successfully:', JSON.stringify(response));
    
    return response;
  } catch (err) {
    console.error('[addPayment] Error:', err.message, err.stack);
    throw new Error('Payment failed: ' + err.message);
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
      console.log('[addPayment] Lock released');
    }
  }
}

/**
 * Generate next receipt number - OPTIMIZED VERSION
 * Uses sheet formula to get max instead of reading all rows
 */
function _getNextReceiptNo(sheet) {
  try {
    // Get the receipt number column (column B, index 2)
    const receiptColLetter = 'B';
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      // No data rows, start with R00001
      return 'R00001';
    }
    
    // Use QUERY or direct range to get last few receipts only (faster)
    // Get last 100 rows instead of all rows
    const startRow = Math.max(2, lastRow - 99); // Start from row 2 or last 100 rows
    const numRows = lastRow - startRow + 1;
    
    if (numRows <= 0) {
      return 'R00001';
    }
    
    const receiptValues = sheet.getRange(receiptColLetter + startRow + ':' + receiptColLetter + lastRow).getValues();
    
    let maxN = 0;
    receiptValues.forEach(row => {
      const val = String(row[0] || '').trim();
      if (!val) return;
      
      const match = /^R(\d+)$/i.exec(val);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxN) maxN = n;
      }
    });
    
    const next = maxN + 1;
    const receiptNo = 'R' + String(next).padStart(5, '0');
    
    console.log('[Receipt] Generated:', receiptNo, '(checked last', numRows, 'rows, max found:', maxN + ')');
    
    return receiptNo;
  } catch (err) {
    console.error('Error generating receipt number:', err);
    // Fallback: use timestamp-based unique number
    const timestamp = new Date().getTime();
    return 'R' + String(timestamp).slice(-5);
  }
}

/**
 * Void a receipt
 */
function voidReceipt(receiptNo) {
  if (!receiptNo) throw new Error('Missing receipt number');
  
  const sh = _getSheet('Transactions');
  const headers = _headers(sh);
  const allData = sh.getDataRange().getValues();
  
  // Find void column index
  let voidColIndex = headers.indexOf('void');
  
  // If void column doesn't exist, add it
  if (voidColIndex === -1) {
    sh.getRange(1, headers.length + 1).setValue('void');
    voidColIndex = headers.length;
  }
  
  // Mark matching rows as voided
  let updated = 0;
  for (let i = 1; i < allData.length; i++) {
    const rowData = {};
    headers.forEach((h, idx) => { rowData[h] = allData[i][idx]; });
    
    if (String(rowData.receiptNo || '') === String(receiptNo)) {
      sh.getRange(i + 1, voidColIndex + 1).setValue('Y');
      updated++;
    }
  }
  
  return { updated: updated };
}

/**
 * Unvoid a receipt
 */
function unvoidReceipt(receiptNo) {
  if (!receiptNo) throw new Error('Missing receipt number');
  
  const sh = _getSheet('Transactions');
  const headers = _headers(sh);
  const allData = sh.getDataRange().getValues();
  
  const voidColIndex = headers.indexOf('void');
  if (voidColIndex === -1) {
    throw new Error('Void column not found');
  }
  
  let updated = 0;
  for (let i = 1; i < allData.length; i++) {
    const rowData = {};
    headers.forEach((h, idx) => { rowData[h] = allData[i][idx]; });
    
    if (String(rowData.receiptNo || '') === String(receiptNo)) {
      sh.getRange(i + 1, voidColIndex + 1).setValue('');
      updated++;
    }
  }
  
  return { updated: updated };
}

/**
 * Get comprehensive fee status for a student
 */
function getStudentFeeStatus(admNo) {
  if (!admNo) throw new Error('Missing admission number');
  
  // Get student details
  const studentsSh = _getSheet('Students');
  const studentsHeaders = _headers(studentsSh);
  const students = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders));
  const student = students.find(s => String(s.admNo || '').trim().toLowerCase() === String(admNo).trim().toLowerCase());
  
  if (!student) throw new Error('Student not found');
  
  // Get fee structure for student's class
  const feeHeads = getFeeHeads(student.class);
  
  // Get transactions for this student
  const transactions = getTransactions({ admNo: admNo });
  
  // Calculate payment status for each fee head
  const feeStatus = feeHeads.map(fee => {
    const paymentStatus = getPaymentStatus(admNo, fee.feeHead, fee.amount);
    
    return {
      feeHead: fee.feeHead,
      expectedAmount: fee.amount,
      dueDate: fee.dueDate,
      paid: paymentStatus.isFullyPaid,
      partiallyPaid: paymentStatus.totalPaid > 0 && !paymentStatus.isFullyPaid,
      amountPaid: paymentStatus.totalPaid,
      balance: paymentStatus.balance,
      totalFine: paymentStatus.totalFine,
      payments: paymentStatus.payments
    };
  });
  
  // Calculate summary
  const totalExpected = feeStatus.reduce((sum, f) => sum + f.expectedAmount, 0);
  const totalPaid = feeStatus.reduce((sum, f) => sum + f.amountPaid, 0);
  const totalBalance = feeStatus.reduce((sum, f) => sum + f.balance, 0);
  const totalFine = feeStatus.reduce((sum, f) => sum + f.totalFine, 0);
  
  return {
    student: {
      admNo: student.admNo,
      name: student.name,
      class: student.class
    },
    feeStatus: feeStatus,
    summary: {
      totalExpected: totalExpected,
      totalPaid: totalPaid,
      totalBalance: totalBalance,
      totalFine: totalFine,
      totalPayments: transactions.length,
      paymentComplete: feeStatus.every(f => f.paid),
      hasPartialPayments: feeStatus.some(f => f.partiallyPaid),
      grandTotal: totalExpected + totalFine
    }
  };
}

/**
 * Get fee defaulters (students with pending payments)
 * Optional: className filter
 */
function getFeeDefaulters(className) {
  const studentsSh = _getSheet('Students');
  const studentsHeaders = _headers(studentsSh);
  let students = _rows(studentsSh).map(r => _indexByHeader(r, studentsHeaders));
  
  // Filter by class if provided
  if (className) {
    students = students.filter(s => String(s.class || '').toLowerCase() === String(className).toLowerCase());
  }
  
  const defaulters = [];
  
  students.forEach(student => {
    const feeHeads = getFeeHeads(student.class);
    
    feeHeads.forEach(fee => {
      const paymentStatus = getPaymentStatus(student.admNo, fee.feeHead, fee.amount);
      
      if (!paymentStatus.isFullyPaid) {
        defaulters.push({
          admNo: student.admNo,
          name: student.name,
          class: student.class,
          feeHead: fee.feeHead,
          expectedAmount: fee.amount,
          amountPaid: paymentStatus.totalPaid,
          balance: paymentStatus.balance,
          dueDate: fee.dueDate,
          parentContact: student.parentContact || ''
        });
      }
    });
  });
  
  return defaulters;
}
