const fs = require('fs');
const c = fs.readFileSync('d:/www/wwww/frontend/src/App.jsx', 'utf8');
const s = c.indexOf('  const HMDashboardView = ({ insights: insightsProp }) => {');
const e = c.indexOf('  // Scheme Approvals View - extracted to separate file');
const body = c.slice(s, e).trimEnd();
const lines = body.split('\n');
// Remove first line (old declaration) and keep the rest
const inner = lines.slice(1).join('\n');

const header = `import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClipboardCheck, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, X, Calendar, User, Users, Target, BookOpen, BookCheck, FileCheck, BarChart2 } from 'lucide-react';
import * as api from '../api';

const HMDashboardView = ({ insights: insightsProp, memoizedSettings, setActiveView }) => {
`;
const footer = '\nexport default HMDashboardView;\n';
const out = header + inner + footer;
fs.writeFileSync('d:/www/wwww/frontend/src/views/HMDashboardView.jsx', out, 'utf8');
console.log('OK length=' + out.length);
