import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../components/student/ds";
import { MOODLE_ASSIGN, useAulaEntregas, type DeliveryArea } from "../../hooks/useAulaEntregas";
import type { InformeTask, Practica } from "../../types";
import { buildGuidedDeliveries, type GuidedDelivery } from "./deliveryGuide";

interface StudentDeliveriesPanelProps {
  practicas?: Practica[];
  informeTasks?: InformeTask[];
  isPracticasLoading?: boolean;
  isPublic?: boolean;
}

const areaIcons: Partial<Record<string, IconName>> = {
  clinica: "clinical",
  laboral: "community",
  comunitaria: "community",
  educacional: "education",
};

function PracticeDeliveryCard({
  delivery,
  onOpenDirectory,
}: {
  delivery: GuidedDelivery;
  onOpenDirectory: (areaId: string | null) => void;
}) {
  const directHref = delivery.institution
    ? `${MOODLE_ASSIGN}${delivery.institution.moodleId}`
    : null;

  const content = (
    <>
      <span className="ah-delivery-space__top">
        <span className="ah-delivery-space__icon" aria-hidden>
          <Icon name={areaIcons[delivery.areaId ?? ""] ?? "upload"} size={19} />
        </span>
        <span className="ah-delivery-space__area">{delivery.areaName}</span>
      </span>
      <strong className="ah-delivery-space__name">{delivery.practiceName}</strong>
      <span className="ah-delivery-space__meta">
        {delivery.deadline ? `Entrega hasta el ${delivery.deadlineLabel}` : "Informe final de PPS"}
      </span>
      <span className="ah-delivery-space__foot">
        <span>{directHref ? "Abrir espacio de entrega" : "Buscar espacio de entrega"}</span>
        <Icon name={directHref ? "arrow" : "search"} size={16} />
      </span>
    </>
  );

  if (directHref) {
    return (
      <a
        className="ah-delivery-space"
        href={directHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ["--area" as string]: delivery.areaColor }}
        aria-label={`Abrir el espacio de entrega de ${delivery.practiceName} en Moodle`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="ah-delivery-space"
      style={{ ["--area" as string]: delivery.areaColor }}
      onClick={() => onOpenDirectory(delivery.areaId)}
      aria-label={`Buscar el espacio de entrega de ${delivery.practiceName}`}
    >
      {content}
    </button>
  );
}

const StudentDeliveriesPanel: React.FC<StudentDeliveriesPanelProps> = ({
  practicas = [],
  informeTasks = [],
  isPracticasLoading = false,
  isPublic = false,
}) => {
  const { areas } = useAulaEntregas();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(isPublic);
  const catalogRef = useRef<HTMLDetailsElement>(null);

  const guidedDeliveries = useMemo(
    () => buildGuidedDeliveries(practicas, informeTasks, areas),
    [areas, informeTasks, practicas]
  );
  const selectedArea = useMemo(
    () => areas.find((area) => area.id === activeAreaId) ?? areas[0],
    [activeAreaId, areas]
  );
  const destinationCount = areas.reduce((total, area) => total + area.institutions.length, 0);

  const openDirectory = useCallback((areaId: string | null) => {
    if (areaId) setActiveAreaId(areaId);
    setCatalogOpen(true);
    window.requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (areaId) document.getElementById(`delivery-directory-tab-${areaId}`)?.focus();
    });
  }, []);

  const handleAreaKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % areas.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + areas.length) % areas.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = areas.length - 1;
      else return;

      event.preventDefault();
      const nextArea = areas[nextIndex];
      setActiveAreaId(nextArea.id);
      document.getElementById(`delivery-directory-tab-${nextArea.id}`)?.focus();
    },
    [areas]
  );

  return (
    <div className="ah-delivery-guide">
      {!isPublic && (
        <section className="ah-delivery-guide__mine" aria-labelledby="my-delivery-spaces">
          <header className="ah-delivery-guide__section-head">
            <div>
              <span className="eyebrow">Tus prácticas</span>
              <h2 id="my-delivery-spaces">Tus espacios de entrega</h2>
            </div>
            {guidedDeliveries.length > 0 && (
              <span className="ah-delivery-guide__count">{guidedDeliveries.length} PPS</span>
            )}
          </header>

          {isPracticasLoading ? (
            <div
              className="ah-delivery-guide__loading"
              aria-busy="true"
              aria-label="Cargando prácticas"
            >
              <span />
              <span />
            </div>
          ) : guidedDeliveries.length > 0 ? (
            <div className="ah-delivery-guide__spaces">
              {guidedDeliveries.map((delivery) => (
                <PracticeDeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onOpenDirectory={openDirectory}
                />
              ))}
            </div>
          ) : (
            <div className="ah-delivery-guide__empty">
              <span className="ah-delivery-guide__empty-icon" aria-hidden>
                <Icon name="file" size={21} />
              </span>
              <div>
                <strong>Todavía no tenés una PPS para mostrar acá.</strong>
                <p>
                  Cuando una práctica figure en Mi Panel, su espacio de entrega aparecerá primero.
                </p>
              </div>
              <Link to="/student/practicas">Ver Mis Prácticas</Link>
            </div>
          )}
        </section>
      )}

      <details
        ref={catalogRef}
        className="ah-delivery-catalog"
        open={isPublic || catalogOpen}
        onToggle={(event) => setCatalogOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="ah-delivery-catalog__summary-icon" aria-hidden>
            <Icon name="upload" size={18} />
          </span>
          <span>
            <strong>{isPublic ? "Todos los espacios de entrega" : "Ver todos los espacios"}</strong>
            <small>
              {destinationCount} destinos disponibles · usalo si tu informe no aparece arriba
            </small>
          </span>
          <Icon name="chev" size={17} className="ah-delivery-catalog__chevron" />
        </summary>

        <div className="ah-delivery-catalog__body">
          <p className="ah-delivery-catalog__instruction">
            Elegí el área y luego la institución donde realizaste la práctica.
          </p>
          <div className="ah-aula__areas" role="tablist" aria-label="Áreas de entrega">
            {areas.map((area: DeliveryArea, index) => {
              const selected = area.id === selectedArea.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  role="tab"
                  id={`delivery-directory-tab-${area.id}`}
                  aria-selected={selected}
                  aria-controls="delivery-directory-panel"
                  tabIndex={selected ? 0 : -1}
                  className={"ah-aula__area" + (selected ? " is-active" : "")}
                  style={{ ["--area" as string]: area.color }}
                  onClick={() => setActiveAreaId(area.id)}
                  onKeyDown={(event) => handleAreaKeyDown(event, index)}
                >
                  <span className="ah-aula__area-ic" aria-hidden>
                    <Icon name={areaIcons[area.id] ?? "upload"} size={18} />
                  </span>
                  <span className="ah-aula__area-copy">
                    <strong>{area.name}</strong>
                    <small>
                      {area.institutions.length}{" "}
                      {area.institutions.length === 1 ? "institución" : "instituciones"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="delivery-directory-panel"
            role="tabpanel"
            aria-labelledby={`delivery-directory-tab-${selectedArea.id}`}
            className="ah-aula__delivery-grid"
            key={selectedArea.id}
          >
            {selectedArea.institutions.map((institution) => (
              <a
                key={institution.moodleId}
                className="ah-aula__delivery"
                href={`${MOODLE_ASSIGN}${institution.moodleId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ["--area" as string]: selectedArea.color }}
                aria-label={`Abrir la entrega de ${institution.name} en Moodle`}
              >
                <strong>{institution.name}</strong>
                <span className="ah-aula__delivery-foot">
                  <span className="ah-aula__open">Abrir espacio de entrega</span>
                  <Icon name="arrow" size={15} />
                </span>
              </a>
            ))}
          </div>

          <p className="ah-delivery-catalog__note">
            Cada tarjeta abre la tarea de esa institución en Moodle, donde cargás el informe final
            y, si corresponde, la planilla firmada.
          </p>
        </div>
      </details>
    </div>
  );
};

export default StudentDeliveriesPanel;
