import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./student/home/atlas/atlasHome.css";
import { normalizeStringForComparison } from "../utils/formatters";

interface PreSolicitudCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  existingInstitutions: string[];
}

const PreSolicitudCheckModal: React.FC<PreSolicitudCheckModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  existingInstitutions,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInstitutions = useMemo(() => {
    if (!searchTerm) return existingInstitutions;
    const lowerSearch = normalizeStringForComparison(searchTerm);
    return existingInstitutions.filter((inst) =>
      normalizeStringForComparison(inst).includes(lowerSearch)
    );
  }, [existingInstitutions, searchTerm]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className="ah-root ah-unified" data-accent="teal">
      <div className="ah-cmodal-overlay" onClick={handleBackdropClick}>
        <div
          className="ah-cmodal ah-cmodal--precheck"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pre-solicitud-title"
        >
          <div className="ah-cmodal__head">
            <div>
              <span className="eyebrow">Antes de continuar</span>
              <h2 id="pre-solicitud-title" className="ah-cmodal__title">
                Requisitos previos
              </h2>
              <p className="ah-cmodal__sub">
                Verificá estas condiciones antes de iniciar una solicitud de autogestión.
              </p>
            </div>
            <button type="button" className="ah-iconbtn" aria-label="Cerrar" onClick={onClose}>
              <span className="material-icons" aria-hidden>
                close
              </span>
            </button>
          </div>

          <div className="ah-cmodal__body">
            <div className="ah-precheck">
              <section className="ah-precheck__item">
                <span className="ah-precheck__ic">
                  <span className="material-icons" aria-hidden>
                    psychology
                  </span>
                </span>
                <div>
                  <h3>Supervisión profesional</h3>
                  <p>
                    La institución debe contar con un <b>Licenciado/a en Psicología</b> en planta
                    que pueda ejercer el rol de tutor/a y supervisar la práctica.
                  </p>
                </div>
              </section>

              <section className="ah-precheck__item ah-precheck__item--important">
                <span className="ah-precheck__ic">
                  <span className="material-icons" aria-hidden>
                    groups
                  </span>
                </span>
                <div>
                  <h3>Mínimo 3 cupos</h3>
                  <p>
                    La institución debe ofrecer <b>3 cupos como mínimo</b>: tu cupo y al menos{" "}
                    <b>2 cupos adicionales</b>. Si no puede ofrecerlos, no se inicia la gestión.
                  </p>
                </div>
              </section>

              <section className="ah-precheck__item ah-precheck__item--important">
                <span className="ah-precheck__ic">
                  <span className="material-icons" aria-hidden>
                    location_on
                  </span>
                </span>
                <div>
                  <h3>Ubicaciones habilitadas</h3>
                  <p>
                    La institución presencial debe estar en{" "}
                    <b>Cipolletti, Neuquén, General Roca, Fernández Oro o Centenario</b>. También se
                    aceptan propuestas de PPS <b>completamente virtuales</b>.
                  </p>
                </div>
              </section>

              <section className="ah-precheck__section">
                <div className="ah-precheck__sectionhead">
                  <span className="material-icons" aria-hidden>
                    new_releases
                  </span>
                  <div>
                    <h3>Solo para nuevos espacios</h3>
                    <p>
                      Este trámite abre convenios en instituciones donde{" "}
                      <b>no tenemos oferta actual</b>. Verificá que la institución que proponés no
                      esté en el listado.
                    </p>
                  </div>
                </div>

                <div className="ah-precheck__list">
                  <label className="ah-precheck__search">
                    <span className="material-icons" aria-hidden>
                      search
                    </span>
                    <input
                      placeholder="Buscar institución..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </label>
                  <div className="ah-precheck__institutions">
                    {filteredInstitutions.length > 0 ? (
                      <ul>
                        {filteredInstitutions.map((inst, idx) => (
                          <li key={idx} title={inst}>
                            <span className="material-icons" aria-hidden>
                              apartment
                            </span>
                            <span>{inst}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ah-precheck__empty">
                        {existingInstitutions.length === 0
                          ? "Cargando lista de instituciones..."
                          : "No se encontraron instituciones con ese nombre en el listado actual."}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="ah-cmodal__foot">
            <button type="button" className="ah-btn ah-btn--secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="ah-btn ah-btn--primary" onClick={onContinue}>
              Entendido, continuar
              <span className="material-icons" style={{ fontSize: 17 }} aria-hidden>
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreSolicitudCheckModal;
