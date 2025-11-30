# Apps Script Include Manifest (2025-11-28)

Use this list for your Apps Script project. Files are grouped by purpose and based on actual references in `MainApp.gs`.

## Required Core
- Appscript/MainApp.gs
- Appscript/SheetHelpers.gs
- Appscript/Config.gs
- Appscript/Logging.gs
- Appscript/AuthManager.gs
- Appscript/TimetableManager.gs
- Appscript/SubstitutionManager.gs
- Appscript/SchemeLessonManager.gs
- Appscript/ExamManager.gs
- Appscript/SetupSettings.gs

## Utility (used)
- Appscript/utilities/BatchSyncDependencies.gs

## Feature Modules (include if used)
- Appscript/SessionTrackingEnhancer.gs

## Removed Stubs (archived)
- The following were stubs and have been deleted from `Appscript/utilities/`:
  - AddMissingColumns.gs
  - CheckTimetable.gs
  - MigrateDailyReports.gs
  - MigrateLessonPlansToDailyReports.gs
  - VerifyDeployment.gs
  - VerifySheetStructure.gs
  - VerifyCascadingData.gs
  - ClearTestData.gs

Archived copies exist under `archive/appscript-backups/utilities/`.

Notes:
- `SheetHelpers.gs` provides: cached sheet access, headers/rows helpers, `_respond`, daily report flows (verify/reopen/delete with cascade rollback), and chapter completion actions.
- `SchemeLessonManager.gs` is needed for cascade (`getCascadePreview`, `executeCascade`) and lesson planning.
- `SubstitutionManager.gs` is required for substitution routes used in `MainApp.gs`.
- `SetupSettings.gs` defines/initializes settings used in bootstrap and feature checks.
- Exams features call into `ExamManager.gs`.
- If you disable a feature (e.g., substitutions), remove its routes in `MainApp.gs` and you can drop the corresponding module.

Sanity Checklist:
- After including the above, deploy and test:
  - `submitDailyReport`, `deleteDailyReport` (checks rollback), `verifyDailyReport`, `reopenDailyReport`.
  - `checkChapterCompletion`, `applyChapterCompletionAction`.
  - Timetable + substitutions routes.
  - Exam routes if enabled.
