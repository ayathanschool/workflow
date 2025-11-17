# Extended Sessions Debug Guide

## Issue
Extended sessions for non-completed chapters are not visible in the lesson planning interface.

## Root Cause Analysis

### 1. Function Resolution Issue
- `getApprovedSchemesForLessonPlanning` was not defined due to Google Apps Script loading order
- System was falling back to backup implementation which didn't include extended session logic

### 2. Restrictive Extended Session Logic
- Original condition: `hasIncompleteSessions && maxExistingSession >= originalSessionCount`
- This meant extended sessions only showed after ALL original sessions were attempted
- NEW condition: `hasIncompleteSessions` (any session <75% completion)

### 3. Data Matching Issues
- Extended sessions depend on finding daily reports for the chapter
- Chapter name, teacher email, class, and subject must match exactly
- Case sensitivity and whitespace differences could prevent matching

## Fixes Implemented

### 1. Enhanced Backup Implementation
- Added full extended session logic to MainApp.gs backup function
- Includes daily report analysis and completion percentage checking
- Now has feature parity with original SchemeLessonManager.gs function

### 2. More Permissive Extended Session Logic
- Extended sessions now appear when ANY session is incomplete (<75%)
- No longer requires all original sessions to be attempted first
- Teachers can plan ahead for chapters they know will need extra time

### 3. Improved Error Handling
- Better logging to identify when backup vs original function is used
- More detailed session analysis logging
- Clearer error messages for debugging

## Testing Steps

1. **Create a scheme** with 2 sessions for a chapter
2. **Submit daily report** for session 1 with <75% completion
3. **Check lesson planning** - should now see Session 3 (Extended) option
4. **Verify backend logs** to confirm extended session generation

## Code Changes
- `MainApp.gs`: Added complete extended session logic to backup implementation
- `SchemeLessonManager.gs`: Made extended session condition more permissive
- Both implementations now support extended sessions for incomplete chapters

## Expected Behavior
- Extended sessions appear when any session in a chapter is <75% complete
- Teachers can plan extended sessions before completing all original sessions
- Extended sessions are marked with "(Extended)" label in the UI
- System works regardless of function resolution issues