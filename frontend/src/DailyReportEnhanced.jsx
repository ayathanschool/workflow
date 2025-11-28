// Lightweight stub: This deprecated component now re-exports the modern implementation.
// Purpose: keep backward imports working while removing heavy duplicate code from bundle.
import React from 'react';
import DailyReportModern from './DailyReportModern';

export default function DailyReportEnhanced(props){
  if (import.meta.env.DEV) {
    // One-time console notice in dev only.
    if (!window.__DAILY_REPORT_ENHANCED_WARNED__) {
      console.warn('[DailyReportEnhanced] Deprecated. Using DailyReportModern internally.');
      window.__DAILY_REPORT_ENHANCED_WARNED__ = true;
    }
  }
  return <DailyReportModern {...props} />;
}