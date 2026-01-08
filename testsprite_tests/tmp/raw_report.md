
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** consulta-pps-uflo
- **Date:** 2026-01-08
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** User authentication success
- **Test Code:** [TC001_User_authentication_success.py](./TC001_User_authentication_success.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/40b681b8-80fa-49d3-8324-5d140a359aed
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** User authentication failure
- **Test Code:** [TC002_User_authentication_failure.py](./TC002_User_authentication_failure.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/d4ff26b8-c771-4881-a564-7a62f1ffe2d8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** Student dashboard displays correct data
- **Test Code:** [TC003_Student_dashboard_displays_correct_data.py](./TC003_Student_dashboard_displays_correct_data.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/5787b66a-8897-4d2b-8268-34b11451714f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** Student edits practice end date successfully
- **Test Code:** [TC004_Student_edits_practice_end_date_successfully.py](./TC004_Student_edits_practice_end_date_successfully.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/3f2ba510-496b-421c-bd98-ac4d8b719490
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** Administrator views correct accumulated hours
- **Test Code:** [TC005_Administrator_views_correct_accumulated_hours.py](./TC005_Administrator_views_correct_accumulated_hours.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/817bef34-b180-4784-8b1e-f9fc23fee2bd
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** Administrator CRUD operations for students
- **Test Code:** [TC006_Administrator_CRUD_operations_for_students.py](./TC006_Administrator_CRUD_operations_for_students.py)
- **Test Error:** The administrator interface for managing student records is not accessible or not present in the current system interface for the logged-in user. The interface only shows student self-service features without any options to create, read, update, or delete student records. Therefore, the CRUD operations for student records cannot be verified. Task is stopped.
Browser Console Logs:
[ERROR] Failed to load resource: the server responded with a status of 403 () (at https://qxnxtnhtbpsgzprqtrjl.supabase.co/auth/v1/logout?scope=global:0:0)
[WARNING] Supabase signOut warning: Auth session missing! (at http://localhost:5173/src/contexts/AuthContext.tsx:50:25)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/8ee82b8e-b15e-4cb5-809b-b11ebfcf9195
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** Administrator CRUD operations for practices
- **Test Code:** [TC007_Administrator_CRUD_operations_for_practices.py](./TC007_Administrator_CRUD_operations_for_practices.py)
- **Test Error:** Unable to confirm full CRUD functionality for administrators on practices due to UI issues. The edit icon is unresponsive with a context error, and no create or delete options are visible. Please fix the interface to enable testing of create, update, and delete actions.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/87c61d1f-49e9-4913-952f-c2dd222040a2
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** Administrator CRUD operations for institutions
- **Test Code:** [TC008_Administrator_CRUD_operations_for_institutions.py](./TC008_Administrator_CRUD_operations_for_institutions.py)
- **Test Error:** Stopped testing due to missing institution management interface link. Cannot proceed with create, read, update, and delete functionality verification for institution records.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/4f2166a9-e79c-4304-a661-dde0c9845e58
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** Filter institutions by agreement state and tags
- **Test Code:** [TC009_Filter_institutions_by_agreement_state_and_tags.py](./TC009_Filter_institutions_by_agreement_state_and_tags.py)
- **Test Error:** Reported critical issues: The 'Mis Prácticas' page is stuck loading indefinitely with no content or filter controls visible, and the logout button malfunctions by toggling light/dark mode instead of logging out. These issues prevent testing the institution list filtering by agreement states and tags. Further testing is stopped until these issues are resolved.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/6e59ce95-a2b9-44d8-bc85-3c8bf50851f2
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** Student practice certificate upload
- **Test Code:** [TC010_Student_practice_certificate_upload.py](./TC010_Student_practice_certificate_upload.py)
- **Test Error:** The website does not allow opening the practice details or certificate upload interface from the practices list by clicking the edit icon. This prevents validating the certificate upload functionality. Stopping the test here.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/d82e50b8-30f8-48c7-b45a-c18a3fd29ba8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011
- **Test Name:** Smart Analysis IA integration provides alerts and recommendations
- **Test Code:** [TC011_Smart_Analysis_IA_integration_provides_alerts_and_recommendations.py](./TC011_Smart_Analysis_IA_integration_provides_alerts_and_recommendations.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/ae6152fc-7ce4-486f-8792-d328275fc801
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012
- **Test Name:** Administrator manages practice requests with approval and rejection
- **Test Code:** [TC012_Administrator_manages_practice_requests_with_approval_and_rejection.py](./TC012_Administrator_manages_practice_requests_with_approval_and_rejection.py)
- **Test Error:** The task to ensure administrators can approve or reject practice requests and the system updates the state accordingly could not be completed. Despite multiple login attempts with the provided credentials, the system consistently logged into a student dashboard without any administrator management interface visible. Therefore, approval or rejection of practice requests could not be performed or verified. Administrator access or correct credentials are required to complete this task.
Browser Console Logs:
[WARNING] Estudiante no encontrado por legajo: 4227 (at http://localhost:5173/src/services/dataService.ts:8:12)
[WARNING] Estudiante no encontrado por legajo: 4227 (at http://localhost:5173/src/services/dataService.ts:8:12)
[WARNING] Estudiante no encontrado por legajo: 4227 (at http://localhost:5173/src/services/dataService.ts:8:12)
[ERROR] Login error: Error: Por favor, completa todos los campos.
    at handleFormSubmit (http://localhost:5173/src/hooks/useAuthLogic.ts:71:55) (at http://localhost:5173/src/hooks/useAuthLogic.ts:93:16)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/2cabb047-ec72-4f79-be79-e3c9f1dc96e0
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013
- **Test Name:** Student attempts to edit other students’ practice data
- **Test Code:** [TC013_Student_attempts_to_edit_other_students_practice_data.py](./TC013_Student_attempts_to_edit_other_students_practice_data.py)
- **Test Error:** Test stopped because the practice data page is not loading for student A, preventing verification of access restrictions to other students' data.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/26d8c8a0-b595-44c7-980a-c356f361be4a
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014
- **Test Name:** Verify system behavior on network failure during data save
- **Test Code:** [TC014_Verify_system_behavior_on_network_failure_during_data_save.py](./TC014_Verify_system_behavior_on_network_failure_during_data_save.py)
- **Test Error:** Test stopped due to inability to initiate edit operation on 'Mis Prácticas' page. Editable fields are not clickable or not found, preventing simulation of network failure during save and validation of error handling. Issue reported.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/d3869189-b503-4843-84bc-5abc4b1de45a
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015
- **Test Name:** Responsive design on varied screen sizes
- **Test Code:** [TC015_Responsive_design_on_varied_screen_sizes.py](./TC015_Responsive_design_on_varied_screen_sizes.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/fd186c72-21a6-4e31-9ef8-e68c84b230db
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016
- **Test Name:** Data consistency on concurrent edits
- **Test Code:** [TC016_Data_consistency_on_concurrent_edits.py](./TC016_Data_consistency_on_concurrent_edits.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/1fa27589-ceac-4b3c-9da0-62e63fedd175
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017
- **Test Name:** Validate calendar view and deadline display for convocatorias
- **Test Code:** [TC017_Validate_calendar_view_and_deadline_display_for_convocatorias.py](./TC017_Validate_calendar_view_and_deadline_display_for_convocatorias.py)
- **Test Error:** Tested the convocatorias calendar interface as administrator. The convocatorias and practice periods with deadlines are displayed correctly with proper labels. However, the calendar interface lacks navigation controls and interactive elements for navigating months or weeks. No calendar updates occur on navigation attempts because no navigation controls exist. This is a critical issue preventing full verification and proper use of the calendar feature. Task is stopped here.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/3031f6c2-4acf-4c9d-bab3-9cae540b5999/ae1edb3b-0f32-4224-9480-b020c6207cda
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **47.06** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---