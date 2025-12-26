
import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Card from './Card';
import EditorEstudiantes from './EditorEstudiantes';
import EditorPracticas from './EditorPracticas';
import EditorConvocatorias from './EditorConvocatorias';
import EditorInstituciones from './EditorInstituciones';

interface DatabaseEditorProps {
  isTestingMode?: boolean;
}

type TableKey = 'estudiantes' | 'practicas' | 'convocatorias' | 'instituciones';

const DatabaseEditor: React.FC<DatabaseEditorProps> = ({ isTestingMode = false }) => {
    const [activeTable, setActiveTable] = useState<TableKey>('estudiantes');

    const tableTabs = [
        { id: 'estudiantes', label: 'Estudiantes', icon: 'school' },
        { id: 'convocatorias', label: 'Inscripciones', icon: 'how_to_reg' },
        { id: 'practicas', label: 'Prácticas', icon: 'work_history' },
        { id: 'instituciones', label: 'Instituciones', icon: 'apartment' },
    ];

    return (
        <Card title="Editor de Base de Datos" icon="storage" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] shadow-lg">
            <div className="mt-4">
                <SubTabs 
                    tabs={tableTabs} 
                    activeTabId={activeTable} 
                    onTabChange={(id) => setActiveTable(id as TableKey)} 
                />
            </div>

            <div className="mt-6 pt-2">
                {activeTable === 'estudiantes' && <EditorEstudiantes isTestingMode={isTestingMode} />}
                {activeTable === 'practicas' && <EditorPracticas isTestingMode={isTestingMode} />}
                {activeTable === 'convocatorias' && <EditorConvocatorias isTestingMode={isTestingMode} />}
                {activeTable === 'instituciones' && <EditorInstituciones isTestingMode={isTestingMode} />}
            </div>
        </Card>
    );
};

export default DatabaseEditor;
