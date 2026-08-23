import { lazy } from "react";
import { useParams } from "react-router-dom";
import { MoodleGradeSyncProvider } from "../../contexts/MoodleGradeSyncContext";
import { StudentPanelProvider } from "../../contexts/StudentPanelContext";

const StudentDashboard = lazy(() => import("../StudentDashboard"));

/**
 * Aísla la edición administrativa de un estudiante del arranque común.
 * Sus providers cargan Moodle, validaciones y consultas que ninguna otra ruta
 * necesita antes de entrar explícitamente a `/admin/estudiantes/:legajo`.
 */
const AdminStudentRoute = () => {
  const { legajo } = useParams();
  if (!legajo) return null;

  return (
    <StudentPanelProvider legajo={legajo}>
      <MoodleGradeSyncProvider>
        <StudentDashboard key={legajo} showExportButton />
      </MoodleGradeSyncProvider>
    </StudentPanelProvider>
  );
};

export default AdminStudentRoute;
