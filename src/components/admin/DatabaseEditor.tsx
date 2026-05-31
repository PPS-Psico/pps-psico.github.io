/**
 * DatabaseEditor — wrapper de los 4 sub-editores de la base (zona Avanzado).
 * Rediseño v1 (Paper & Ink editorial). Solo capa visual + el aviso de zona
 * avanzada; los sub-editores conservan su lógica.
 */
import React, { useState } from "react";
import EditorEstudiantes from "./EditorEstudiantes";
import EditorPracticas from "./EditorPracticas";
import EditorConvocatorias from "./EditorConvocatorias";
import EditorInstituciones from "./EditorInstituciones";
import { injectEditorStyles } from "./editorStyles";

injectEditorStyles();

interface DatabaseEditorProps {
  isTestingMode?: boolean;
}

type TableKey = "estudiantes" | "convocatorias" | "practicas" | "instituciones";

const TABS: { id: TableKey; label: string; icon: string }[] = [
  { id: "estudiantes", label: "Estudiantes", icon: "school" },
  { id: "convocatorias", label: "Inscripciones", icon: "how_to_reg" },
  { id: "practicas", label: "Prácticas", icon: "work_history" },
  { id: "instituciones", label: "Instituciones", icon: "apartment" },
];

const DatabaseEditor: React.FC<DatabaseEditorProps> = ({ isTestingMode = false }) => {
  const [activeTable, setActiveTable] = useState<TableKey>("estudiantes");

  return (
    <div className="dbe">
      <div className="dbe-head">
        <span className="eyebrow">Avanzado · base de datos</span>
        <h2 className="serif">Editor de base de datos</h2>
        <p>Edición directa de los registros. Cada cambio impacta la base real de inmediato.</p>
        <span className="dbe-warnline">
          <span className="material-icons">warning_amber</span>
          Las eliminaciones piden confirmación y no se pueden deshacer.
        </span>
      </div>

      <div className="dbe-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="dbe-tab"
            data-on={activeTable === t.id ? "1" : "0"}
            onClick={() => setActiveTable(t.id)}
          >
            <span className="material-icons">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {activeTable === "estudiantes" && <EditorEstudiantes isTestingMode={isTestingMode} />}
      {activeTable === "convocatorias" && <EditorConvocatorias isTestingMode={isTestingMode} />}
      {activeTable === "practicas" && <EditorPracticas isTestingMode={isTestingMode} />}
      {activeTable === "instituciones" && <EditorInstituciones isTestingMode={isTestingMode} />}
    </div>
  );
};

export default DatabaseEditor;
