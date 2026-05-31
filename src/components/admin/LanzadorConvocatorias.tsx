/**
 * LanzadorConvocatorias — Capa de presentación del Lanzador de convocatorias en
 * el sistema visual Paper & Ink (v3).
 *
 * La lógica de estado, queries y mutaciones vive en useLaunchManager. Las
 * piezas visuales (formulario, modales e historial) viven en ./launcher/*.
 * Este archivo solo compone esas piezas según la pestaña activa.
 *
 * Reemplaza la maqueta anterior basada en Tailwind (slate/blue/indigo).
 */
import React from "react";
import SubTabs from "../SubTabs";
import Toast from "../ui/Toast";
import { LaunchHistoryList } from "./launcher/LaunchHistoryList";
import { LaunchPreviewModal } from "./launcher/LaunchPreviewModal";
import { NewInstitutionModalV3 } from "./launcher/NewInstitutionModalV3";
import { NewLaunchForm } from "./launcher/NewLaunchForm";
import { useLaunchManager } from "./launcher/useLaunchManager";
import { LAUNCH_TABLE_CONFIG } from "./launcher/launchTableConfig";
import RecordEditModal from "./RecordEditModal";

export { LAUNCH_TABLE_CONFIG };

interface LanzadorConvocatoriasProps {
  isTestingMode?: boolean;
  forcedTab?: "new" | "history";
}

const LanzadorConvocatorias: React.FC<LanzadorConvocatoriasProps> = ({
  isTestingMode = false,
  forcedTab,
}) => {
  const m = useLaunchManager(isTestingMode, forcedTab);

  return (
    <div style={{ paddingBottom: 32 }}>
      {m.toastInfo && (
        <Toast
          message={m.toastInfo.message}
          type={m.toastInfo.type}
          onClose={() => m.setToastInfo(null)}
        />
      )}

      <NewInstitutionModalV3
        isOpen={m.isNewInstitutionModalOpen}
        onClose={() => m.setIsNewInstitutionModalOpen(false)}
        onConfirm={m.createInstitutionMutation.mutate}
        isLoading={m.createInstitutionMutation.isPending}
      />

      {!forcedTab && (
        <div style={{ maxWidth: 880, margin: "0 auto 24px" }}>
          <SubTabs
            tabs={[
              { id: "new", label: "Nuevo Lanzamiento", icon: "add_circle" },
              { id: "history", label: "Historial", icon: "history" },
            ]}
            activeTabId={m.activeTab}
            onTabChange={(id) => m.setInternalTab(id as "new" | "history")}
          />
        </div>
      )}

      {m.activeTab === "new" ? (
        <NewLaunchForm
          formData={m.formData}
          setFormData={m.setFormData}
          handleChange={m.handleChange}
          instiSearch={m.instiSearch}
          setInstiSearch={m.setInstiSearch}
          isDropdownOpen={m.isDropdownOpen}
          setIsDropdownOpen={m.setIsDropdownOpen}
          filteredInstitutions={m.filteredInstitutions}
          selectedInstitution={m.selectedInstitution}
          onSelectInstitution={m.handleSelectInstitution}
          onOpenNewInstitution={() => m.setIsNewInstitutionModalOpen(true)}
          lastLanzamiento={m.lastLanzamiento}
          onLoadLastData={m.handleLoadLastData}
          schedules={m.schedules}
          onScheduleChange={m.handleScheduleChange}
          onAddSchedule={m.addSchedule}
          onRemoveSchedule={m.removeSchedule}
          isMultiOrientation={m.isMultiOrientation}
          safeOrientacion={m.safeOrientacion}
          actividades={m.actividades}
          onActivityChange={m.handleActivityChange}
          onAddActivity={m.addActivity}
          onRemoveActivity={m.removeActivity}
          rawActivityText={m.rawActivityText}
          setRawActivityText={m.setRawActivityText}
          isGenerating={m.isGenerating}
          onRunAI={m.runAIExtraction}
          uploadingFile={m.uploadingFile}
          onUploadFile={m.handleUploadFile}
          onPreview={m.handleSmartPreview}
        />
      ) : (
        <LaunchHistoryList
          scheduled={m.scheduledHistory}
          visible={m.visibleHistory}
          hidden={m.hiddenHistory}
          copiedLaunchId={m.copiedLaunchId}
          onEdit={m.setEditingLaunch}
          onViewInscriptos={m.handleViewInscriptos}
          onStatusAction={m.handleStatusAction}
          onCopyWhatsApp={m.handleCopyHistoryWhatsApp}
          onDelete={m.handleDeleteLaunch}
        />
      )}

      <LaunchPreviewModal
        isOpen={m.showPreviewModal}
        onClose={() => m.setShowPreviewModal(false)}
        formData={m.formData}
        setFormData={m.setFormData}
        schedules={m.schedules}
        actividades={m.actividades}
        isMultiOrientation={m.isMultiOrientation}
        safeOrientacion={m.safeOrientacion}
        selectedInstitution={m.selectedInstitution}
        isCopied={m.isCopied}
        onCopy={m.copyToClipboard}
        onConfirm={m.handleSubmit}
        isSubmitting={m.createLaunchMutation.isPending}
      />

      {m.editingLaunch && (
        <RecordEditModal
          isOpen={!!m.editingLaunch}
          onClose={() => m.setEditingLaunch(null)}
          record={m.editingLaunch as Record<string, unknown>}
          tableConfig={LAUNCH_TABLE_CONFIG}
          onSave={(id, fields) => m.updateDetailsMutation.mutate({ id: id!, fields })}
          isSaving={m.updateDetailsMutation.isPending}
        />
      )}
    </div>
  );
};

export default LanzadorConvocatorias;
