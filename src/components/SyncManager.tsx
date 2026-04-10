import React from "react";
import Card from "./ui/Card";
import EmptyState from "./EmptyState";

const SyncManager: React.FC = () => {
  return (
    <Card
      icon="sync_disabled"
      title="Sincronizacion con Supabase"
      description="Esta funcionalidad de resincronizacion manual fue deshabilitada en esta version."
    >
      <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700">
        <EmptyState
          icon="construction"
          title="Funcionalidad deshabilitada"
          message="La resincronizacion manual con Supabase no esta disponible en esta version de la aplicacion."
        />
      </div>
    </Card>
  );
};

export default SyncManager;
