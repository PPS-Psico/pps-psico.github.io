import React from 'react';
import Card from './ui/Card';
import EmptyState from './EmptyState';

const SyncManager: React.FC = () => {
    return (
        <Card
            icon="sync_disabled"
            title="Sincronización con Supabase"
            description="Esta funcionalidad para forzar la sincronización de datos desde Airtable ha sido deshabilitada."
        >
            <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700">
                <EmptyState
                    icon="construction"
                    title="Funcionalidad Deshabilitada"
                    message="La sincronización con Supabase está actualmente deshabilitada en esta versión de la aplicación."
                />
            </div>
        </Card>
    );
};

export default SyncManager;