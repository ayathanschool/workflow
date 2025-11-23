# Quick Reference: Data Entry Template

## Academic Calendar Template

Copy this into your **AcademicCalendar** sheet:

```
term        startDate    endDate      examStartDate  examEndDate  eventDates                  eventNames                    teachingWeeks
Term 1      2025-06-01   2025-09-30   2025-09-20     2025-09-28   2025-08-15, 2025-09-05     Independence Day, Teachers Day   14
Term 2      2025-11-04   2026-02-28   2026-02-15     2026-02-20   2025-12-15, 2026-01-26     Sports Day, Republic Day         13
Term 3      2026-03-01   2026-05-31   2026-05-15     2026-05-25   2026-04-15                 Annual Day                       10
```

---

## STD 10 Mathematics - Term 2 Template

Copy this into your **Syllabus** sheet:

```
standard  subject        term    chapterNo  chapterName              minSessions  topics                                          sequence
STD 10    Mathematics    Term 2  7          Trigonometry             14           Sin, Cos, Tan, Identities, Ratios              1
STD 10    Mathematics    Term 2  8          Heights & Distances      10           Applications, Word Problems                     2
STD 10    Mathematics    Term 2  9          Statistics               12           Mean, Median, Mode, Graphs                      3
STD 10    Mathematics    Term 2  10         Probability              11           Events, Sample Space, Calculations              4
STD 10    Mathematics    Term 2  11         Coordinate Geometry      13           Distance, Section Formula, Area                 5
STD 10    Mathematics    Term 2  12         Constructions            12           Triangles, Circles, Tangents                    6
```

**Total for Term 2 Math: 72 sessions**

---

## STD 10 Science - Term 2 Template

```
standard  subject  term    chapterNo  chapterName              minSessions  topics                                   sequence
STD 10    Science  Term 2  5          Chemical Reactions       12           Acids, Bases, Salts, pH Scale           1
STD 10    Science  Term 2  6          Life Processes           14           Nutrition, Respiration, Transport       2
STD 10    Science  Term 2  7          Control & Coordination   12           Nervous System, Hormones                3
STD 10    Science  Term 2  8          Light - Reflection       13           Mirrors, Lenses, Ray Diagrams           4
STD 10    Science  Term 2  9          Electricity              15           Current, Voltage, Circuits, Ohm's Law   5
STD 10    Science  Term 2  10         Magnetic Effects         10           Electromagnetism, Motors                6
```

**Total for Term 2 Science: 76 sessions**

---

## STD 10 English - Term 2 Template

```
standard  subject  term    chapterNo  chapterName              minSessions  topics                                   sequence
STD 10    English  Term 2  5          The Necklace             8            Story Analysis, Themes                   1
STD 10    English  Term 2  6          Letter Writing           6            Formal & Informal Letters                2
STD 10    English  Term 2  7          Grammar - Clauses        10           Types, Structure, Usage                  3
STD 10    English  Term 2  8          Comprehension Skills     8            Reading, Analysis, Inference             4
STD 10    English  Term 2  9          Essay Writing            10           Structure, Content, Expression           5
```

**Total for Term 2 English: 42 sessions**

---

## STD 10 Social Studies - Term 2 Template

```
standard  subject         term    chapterNo  chapterName                minSessions  topics                                sequence
STD 10    Social Studies  Term 2  5          Nationalism in India       12           Freedom Movement, Gandhi, Congress     1
STD 10    Social Studies  Term 2  6          Resources & Development    10           Types, Conservation, Planning          2
STD 10    Social Studies  Term 2  7          Democracy & Elections      11           Systems, Voting, Representation        3
STD 10    Social Studies  Term 2  8          Agriculture                12           Types, Green Revolution, Issues        4
STD 10    Social Studies  Term 2  9          Manufacturing Industries   11           Types, Location, Impact                5
```

**Total for Term 2 Social Studies: 56 sessions**

---

## Quick Copy Instructions

### Method 1: Direct Copy-Paste
1. Copy the table above (without the ``` markers)
2. Select the first empty row in your sheet
3. Paste
4. Google Sheets will auto-format into columns

### Method 2: Excel Import
1. Copy to Excel first
2. Save as CSV
3. Import to Google Sheets

### Method 3: Manual Entry
1. Open Google Sheets
2. Type each value carefully
3. Use Tab key to move between cells
4. Double-check standard format ("STD 10" with space)

---

## Verification Checklist

After entering data, verify:

- [ ] Standard format is "STD 10" (with space, not "Std10" or "10")
- [ ] Subject names match Timetable exactly
- [ ] Term is "Term 2" (not "Term-2" or "T2")
- [ ] Dates are in YYYY-MM-DD format
- [ ] minSessions are numbers (not text)
- [ ] sequence numbers are 1, 2, 3... (no gaps)
- [ ] No extra spaces in text fields
- [ ] eventDates and eventNames have same number of items

---

## Testing After Entry

1. Open `test-scheme-helper.html`
2. Update API URL
3. Test with:
   - Class: STD 10A
   - Subject: Mathematics
   - Term: Term 2
4. Should show:
   - ✅ 6 chapters
   - ✅ 72 total sessions
   - ✅ Term dates Nov 4 - Feb 28
   - ✅ Feasibility analysis

---

## Time Estimate

| Task | Time |
|------|------|
| Academic Calendar (3 terms) | 5 min |
| STD 10 Mathematics | 10 min |
| STD 10 Science | 10 min |
| STD 10 English | 8 min |
| STD 10 Social Studies | 10 min |
| **TOTAL** | **43 minutes** |

---

## Support

If you need different subjects or standards, let me know and I'll generate more templates!
