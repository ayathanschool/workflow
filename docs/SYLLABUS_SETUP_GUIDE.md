# 📚 Syllabus & Academic Calendar Setup Guide

## Overview
This guide will help you set up the **Syllabus** and **AcademicCalendar** sheets for the new Planning Assistant feature.

---

## Step 1: Open Your Google Spreadsheet

1. Go to your Google Spreadsheet: `1PWD9XxQlnYcIgZqgY4LcnM4YgG0ciAtAYRVhv6lWKRg`
2. You should see new sheets created automatically: **Syllabus** and **AcademicCalendar**

---

## Step 2: Setup Academic Calendar

### Sheet: `AcademicCalendar`

**Headers** (already created):
- term
- startDate
- endDate
- examStartDate
- examEndDate
- eventDates
- eventNames
- teachingWeeks

### Sample Data (Add these rows):

| term | startDate | endDate | examStartDate | examEndDate | eventDates | eventNames | teachingWeeks |
|------|-----------|---------|---------------|-------------|------------|------------|---------------|
| Term 1 | 2025-06-01 | 2025-09-30 | 2025-09-20 | 2025-09-28 | 2025-08-15, 2025-09-05 | Independence Day, Teachers Day | 14 |
| Term 2 | 2025-11-04 | 2026-02-28 | 2026-02-15 | 2026-02-20 | 2025-12-15, 2026-01-26 | Sports Day, Republic Day | 13 |
| Term 3 | 2026-03-01 | 2026-05-31 | 2026-05-15 | 2026-05-25 | 2026-04-15 | Annual Day | 10 |

**Notes:**
- **eventDates**: Comma-separated dates of school events that affect teaching
- **eventNames**: Corresponding names of events (same order)
- **teachingWeeks**: Number of weeks available for teaching (excluding exam weeks)

---

## Step 3: Setup Syllabus for STD 10A & 10B

### Sheet: `Syllabus`

**Headers** (already created):
- standard
- subject
- term
- chapterNo
- chapterName
- minSessions
- topics
- sequence

### Sample Data Template (Mathematics - Term 2):

| standard | subject | term | chapterNo | chapterName | minSessions | topics | sequence |
|----------|---------|------|-----------|-------------|-------------|--------|----------|
| STD 10 | Mathematics | Term 2 | 7 | Trigonometry | 14 | Sin, Cos, Tan, Identities, Ratios | 1 |
| STD 10 | Mathematics | Term 2 | 8 | Heights & Distances | 10 | Applications, Word Problems, Real-life scenarios | 2 |
| STD 10 | Mathematics | Term 2 | 9 | Statistics | 12 | Mean, Median, Mode, Graphs, Data Analysis | 3 |
| STD 10 | Mathematics | Term 2 | 10 | Probability | 11 | Basic Concepts, Events, Sample Space | 4 |
| STD 10 | Mathematics | Term 2 | 11 | Coordinate Geometry | 13 | Distance Formula, Section Formula, Area | 5 |
| STD 10 | Mathematics | Term 2 | 12 | Constructions | 12 | Triangles, Circles, Tangents | 6 |

### Quick Entry Instructions:

1. **For STD 10 Mathematics**: Add all chapters for Term 2 (6-8 chapters)
2. **For STD 10 Science**: Add chapters for Term 2 (~5-6 chapters)
3. **For STD 10 English**: Add chapters for Term 2 (~4-5 chapters)
4. **For STD 10 Social Studies**: Add chapters for Term 2 (~5-6 chapters)

**Estimated Entry Time**: 30-45 minutes for all subjects

---

## Step 4: How to Fill minSessions

The `minSessions` column indicates **minimum periods needed** to complete a chapter.

**Guidelines:**
- **Complex chapters** (new concepts): 12-15 sessions
- **Medium chapters** (building on basics): 8-12 sessions
- **Simple chapters** (revision/application): 6-8 sessions
- **Practical/Project work**: 4-6 sessions

**Example Calculation:**
- If a chapter has 4 major topics
- Each topic needs 2-3 periods to teach + practice
- Add 2 periods for revision/assessment
- Total: (4 topics × 3 periods) + 2 = **14 sessions**

---

## Step 5: Test the API

Once you've added data:

1. Open the test file: `test-scheme-helper.html`
2. Update the API URL (line 162) with your Apps Script Web App URL
3. Open in browser
4. Select: **STD 10A**, **Mathematics**, **Term 2**
5. Click "Get Planning Context"

**Expected Result:**
You should see:
- ✅ Term timeline (Nov 4 - Feb 28)
- ✅ Teacher's periods/week from timetable
- ✅ Syllabus chapters with session requirements
- ✅ Feasibility analysis (achievable/not achievable)
- ✅ Upcoming events that affect teaching
- ✅ Recommendations for pace

---

## Step 6: Rollout Plan

### Phase 1: Pilot with STD 10 (Current)
- Enter data for STD 10A & 10B only
- Test with 2-3 teachers
- Gather feedback

### Phase 2: Expand to Other Standards
- Once successful, add STD 9, 8, 7...
- Can delegate to subject coordinators
- Each standard takes ~1 hour to complete

### Phase 3: Full Implementation
- All standards (STD 1-10) have syllabus data
- Planning Assistant available for all teachers
- HM dashboard shows pace tracking

---

## Data Entry Tips

### Tip 1: Use Excel First
If you have curriculum documents in Excel/Word:
1. Create the structure in Excel
2. Copy-paste into Google Sheets
3. Much faster than manual entry

### Tip 2: Standard Format
Keep standard format consistent: **"STD 10"** (with space)
- ✅ Correct: `STD 10`, `STD 9`, `STD 8`
- ❌ Wrong: `Std10`, `10`, `Standard 10`

### Tip 3: Subject Names
Match exactly with Timetable sheet:
- ✅ `Mathematics` (not `Math` or `Maths`)
- ✅ `Science` (not `Sciences`)
- ✅ `Social Studies` (not `Social Science`)

### Tip 4: Term Format
Use consistent term naming:
- ✅ `Term 1`, `Term 2`, `Term 3`
- ❌ `Term-1`, `First Term`, `T1`

---

## What Happens After Setup?

### For Teachers (When Creating Schemes):
1. Select Class, Subject, Term
2. **NEW**: See Planning Assistant panel
   - Total periods available
   - Syllabus chapters to cover
   - Required sessions per chapter
   - Timeline constraints
   - Event impacts
3. Teacher plans realistically based on this context
4. System warns if over-planning or under-planning

### For HM (Dashboard):
1. See pace tracking for each class-subject
2. Compare: Syllabus Target vs Scheme Plan vs Actual Progress
3. Identify subjects falling behind
4. Proactive interventions before term ends

---

## Troubleshooting

### Issue: "No syllabus data found"
**Fix**: Ensure standard format is exactly "STD 10" (with space)

### Issue: "No periods found in timetable"
**Fix**: Check Timetable sheet has entries for that teacher + class + subject

### Issue: "Term not found"
**Fix**: Ensure AcademicCalendar has row for that term with exact spelling

### Issue: API returns error
**Fix**: 
1. Check Apps Script deployment is published
2. Verify sheet names are correct (case-sensitive)
3. Check browser console for detailed error

---

## Need Help?

If you encounter issues:
1. Check the test HTML file output - it shows detailed error messages
2. Verify data format matches examples above
3. Test with one subject first before entering all data
4. The system will guide you with specific error messages

---

## Next Steps

After setup:
1. ✅ Enter Academic Calendar data (5 minutes)
2. ✅ Enter STD 10 syllabus for 4 subjects (30-45 minutes)
3. ✅ Test the API using test-scheme-helper.html
4. ✅ We'll integrate Planning Assistant into scheme submission form
5. ✅ We'll add pace tracking to HM dashboard

**Ready to start? Begin with Step 2 above!** 🚀
