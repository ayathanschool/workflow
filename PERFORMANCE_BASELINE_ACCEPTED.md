# Performance Baseline - February 2026

## Current Performance Status: ✅ ACCEPTED

### Measured Performance
- **Normal teachers** (typical dataset): 3.5 - 6 seconds per scheme detail load
- **Data-heavy teachers** (large datasets): May timeout (30-second Apps Script limit)

### Optimization Level
The codebase has been optimized with:
- ✅ TextFinder-based fast lookups (avoids full-sheet scans)
- ✅ Teacher-filtered data fetches (reduces row processing)
- ✅ In-memory filtering for class/subject matching
- ✅ Request-scoped caching to avoid repeated sheet reads

### Performance Comparison
- **Before optimization**: 15-76 seconds per scheme
- **After optimization**: 3.5-6 seconds per scheme
- **Improvement**: ~85-90% reduction in load time

### Known Limitations
**Apps Script Execution Timeout**: 30 seconds hard limit
- Teachers with exceptionally large datasets (1000+ lesson plans/reports) may hit this limit
- This is a Google Apps Script platform constraint, not a code issue
- Affected teachers: Small percentage of total users

### Accepted Tradeoffs
1. **Normal usage**: 4-6s is acceptable for loading comprehensive scheme details with full history
2. **Heavy usage**: Timeout errors will occur for outlier cases
3. **No further optimization planned** unless timeout becomes widespread issue

### Future Improvement Options (if needed)
If timeout errors become common:
1. **Materialized Cache Sheets** - Pre-aggregate teacher data via triggers (~2-3 hour implementation)
2. **External Database** - Move to Firebase/Firestore for sub-second performance (~1-2 day implementation)
3. **Pagination** - Load scheme details in chunks (degrades UX)

### Decision
**Status**: Performance is acceptable for current usage patterns.  
**Action**: Monitor timeout frequency; revisit only if >10% of teachers affected.  
**Last Updated**: February 4, 2026
