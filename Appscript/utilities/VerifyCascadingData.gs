/**
 * VerifyCascadingData.gs
 * Verify that SessionDependencies data matches with DailyReports and LessonPlans
 */

/**
 * Verify SessionDependencies data is correct
 * Run this to check if the cascading relationships make sense
 */
function verifyCascadingData() {
  try {
    Logger.log('=== VERIFYING CASCADING DATA ===');
    
    const depsSheet = _getSheet('SessionDependencies');
    const plansSheet = _getSheet('LessonPlans');
    const reportsSheet = _getSheet('DailyReports');
    
    const depsHeaders = _headers(depsSheet);
    const planHeaders = _headers(plansSheet);
    const reportHeaders = _headers(reportsSheet);
    
    const dependencies = _rows(depsSheet).map(row => _indexByHeader(row, depsHeaders));
    const plans = _rows(plansSheet).map(row => _indexByHeader(row, planHeaders));
    const reports = _rows(reportsSheet).map(row => _indexByHeader(row, reportHeaders));
    
    Logger.log(`Found ${dependencies.length} dependencies to verify`);
    Logger.log('');
    
    // Verify each dependency
    dependencies.forEach((dep, index) => {
      Logger.log(`--- Dependency ${index + 1} ---`);
      Logger.log(`Prerequisite: ${dep.prerequisiteSession}`);
      Logger.log(`Dependent: ${dep.dependentSession}`);
      Logger.log(`Completion: ${dep.completionPercentage}%`);
      Logger.log(`Impact: ${dep.impactLevel}`);
      Logger.log('');
      
      // Find the prerequisite lesson plan
      const prereqPlan = plans.find(p => p.lpId === dep.prerequisiteSession);
      if (!prereqPlan) {
        Logger.log(`❌ ERROR: Prerequisite lesson plan not found!`);
        Logger.log('');
        return;
      }
      
      Logger.log(`✅ Prerequisite Plan Found:`);
      Logger.log(`   Teacher: ${prereqPlan.teacherName} (${prereqPlan.teacherEmail})`);
      Logger.log(`   Subject: ${prereqPlan.subject}`);
      Logger.log(`   Class: ${prereqPlan.class}`);
      Logger.log(`   Chapter: ${prereqPlan.chapter}`);
      Logger.log(`   Session: ${prereqPlan.session}`);
      Logger.log(`   SchemeId: ${prereqPlan.schemeId}`);
      Logger.log('');
      
      // Find the dependent lesson plan
      const depPlan = plans.find(p => p.lpId === dep.dependentSession);
      if (!depPlan) {
        Logger.log(`❌ ERROR: Dependent lesson plan not found!`);
        Logger.log('');
        return;
      }
      
      Logger.log(`✅ Dependent Plan Found:`);
      Logger.log(`   Teacher: ${depPlan.teacherName} (${depPlan.teacherEmail})`);
      Logger.log(`   Subject: ${depPlan.subject}`);
      Logger.log(`   Class: ${depPlan.class}`);
      Logger.log(`   Chapter: ${depPlan.chapter}`);
      Logger.log(`   Session: ${depPlan.session}`);
      Logger.log(`   SchemeId: ${depPlan.schemeId}`);
      Logger.log('');
      
      // Verify the relationship makes sense
      const checks = {
        sameTeacher: prereqPlan.teacherEmail === depPlan.teacherEmail,
        sameScheme: prereqPlan.schemeId === depPlan.schemeId,
        sameChapter: prereqPlan.chapter === depPlan.chapter,
        sessionOrder: parseInt(prereqPlan.session || 0) < parseInt(depPlan.session || 0),
        sameSubject: prereqPlan.subject === depPlan.subject,
        sameClass: prereqPlan.class === depPlan.class
      };
      
      Logger.log(`🔍 Relationship Validation:`);
      Logger.log(`   Same Teacher: ${checks.sameTeacher ? '✅' : '❌'}`);
      Logger.log(`   Same Scheme: ${checks.sameScheme ? '✅' : '❌'}`);
      Logger.log(`   Same Chapter: ${checks.sameChapter ? '✅' : '❌'}`);
      Logger.log(`   Same Subject: ${checks.sameSubject ? '✅' : '❌'}`);
      Logger.log(`   Same Class: ${checks.sameClass ? '✅' : '❌'}`);
      Logger.log(`   Correct Session Order: ${checks.sessionOrder ? '✅' : '❌'} (${prereqPlan.session} < ${depPlan.session})`);
      Logger.log('');
      
      // Find corresponding daily report
      const report = reports.find(r => r.lessonPlanId === dep.prerequisiteSession);
      if (report) {
        Logger.log(`✅ Daily Report Found:`);
        Logger.log(`   Date: ${report.date}`);
        Logger.log(`   Completion: ${report.completionPercentage}%`);
        Logger.log(`   Matches Dependency: ${Number(report.completionPercentage) === Number(dep.completionPercentage) ? '✅' : '❌'}`);
        
        if (report.difficulties) {
          Logger.log(`   Difficulties: ${report.difficulties}`);
        }
        if (report.nextSessionPlan) {
          Logger.log(`   Next Plan: ${report.nextSessionPlan}`);
        }
      } else {
        Logger.log(`⚠️  WARNING: No daily report found for this prerequisite session`);
      }
      
      // Verify impact level calculation
      const completion = Number(dep.completionPercentage);
      const expectedImpact = completion >= 75 ? 'Low' :
                            completion >= 50 ? 'Medium' : 'High';
      
      Logger.log('');
      Logger.log(`🎯 Impact Level Verification:`);
      Logger.log(`   Completion: ${completion}%`);
      Logger.log(`   Recorded Impact: ${dep.impactLevel}`);
      Logger.log(`   Expected Impact: ${expectedImpact}`);
      Logger.log(`   Correct: ${dep.impactLevel === expectedImpact ? '✅' : '❌'}`);
      
      // Overall validity
      const isValid = checks.sameTeacher && checks.sameScheme && checks.sameChapter && 
                     checks.sessionOrder && dep.impactLevel === expectedImpact;
      
      Logger.log('');
      Logger.log(`📊 OVERALL: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      Logger.log('='.repeat(60));
      Logger.log('');
    });
    
    // Summary
    Logger.log('=== VERIFICATION SUMMARY ===');
    Logger.log(`Total Dependencies: ${dependencies.length}`);
    Logger.log(`Unique Prerequisite Sessions: ${[...new Set(dependencies.map(d => d.prerequisiteSession))].length}`);
    Logger.log(`Unique Dependent Sessions: ${[...new Set(dependencies.map(d => d.dependentSession))].length}`);
    Logger.log('');
    
    // Impact level distribution
    const highImpact = dependencies.filter(d => d.impactLevel === 'High').length;
    const mediumImpact = dependencies.filter(d => d.impactLevel === 'Medium').length;
    const lowImpact = dependencies.filter(d => d.impactLevel === 'Low').length;
    
    Logger.log(`Impact Distribution:`);
    Logger.log(`   High: ${highImpact}`);
    Logger.log(`   Medium: ${mediumImpact}`);
    Logger.log(`   Low: ${lowImpact}`);
    
    return {
      success: true,
      totalDependencies: dependencies.length,
      impactDistribution: {
        high: highImpact,
        medium: mediumImpact,
        low: lowImpact
      }
    };
    
  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

/**
 * Quick check for your specific data
 */
function verifySpecificDependencies() {
  Logger.log('=== VERIFYING YOUR 3 DEPENDENCIES ===');
  
  const expectedData = [
    { prereq: 'LP_1762945431538_965', dep: 'LP_1762946335473_241', completion: 75 },
    { prereq: 'LP_1762945431538_965', dep: 'LP_1763008841741_732', completion: 75 },
    { prereq: 'LP_1762946335473_241', dep: 'LP_1763008841741_732', completion: 80 }
  ];
  
  const depsSheet = _getSheet('SessionDependencies');
  const depsHeaders = _headers(depsSheet);
  const dependencies = _rows(depsSheet).map(row => _indexByHeader(row, depsHeaders));
  
  Logger.log(`Found ${dependencies.length} dependencies in sheet`);
  Logger.log('');
  
  expectedData.forEach((expected, idx) => {
    Logger.log(`Checking dependency ${idx + 1}:`);
    const found = dependencies.find(d => 
      d.prerequisiteSession === expected.prereq && 
      d.dependentSession === expected.dep
    );
    
    if (found) {
      Logger.log(`✅ FOUND`);
      Logger.log(`   Completion: ${found.completionPercentage}% (expected: ${expected.completion}%)`);
      Logger.log(`   Impact: ${found.impactLevel}`);
      Logger.log(`   Action: ${found.recommendedAction}`);
      Logger.log(`   Match: ${Number(found.completionPercentage) === expected.completion ? '✅' : '❌'}`);
    } else {
      Logger.log(`❌ NOT FOUND`);
    }
    Logger.log('');
  });
}
