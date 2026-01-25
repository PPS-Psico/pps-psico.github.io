import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../lib/db';
import { FIELD_NOMBRE_INSTITUCIONES } from '../../../constants';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';

interface Step1InstitucionProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  onNext: () => void;
}

export const Step1Institucion: React.FC<Step1InstitucionProps> = ({
  formData,
  onChange,
  onNext
}) => {
  const { data: instituciones = [] } = useQuery({
    queryKey: ['instituciones'],
    queryFn: () => db.instituciones.getAll()
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="material-icons text-blue-600 dark:text-blue-400 text-lg">business</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">1. Institución</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona o crea la institución</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Buscar Institución
          </label>
          <Input
            type="search"
            placeholder="Escribe para buscar..."
            icon="search"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Institución
          </label>
          <Select
            value={formData.institucionId || ''}
            onChange={(value) => onChange('institucionId', value)}
            options={instituciones.map(inst => ({
              value: inst.id,
              label: inst[FIELD_NOMBRE_INSTITUCIONES] || ''
            }))}
            placeholder="Seleccionar institución..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
            Dirección / Lugar
          </label>
          <Input
            type="text"
            value={formData.direccion || ''}
            onChange={(value) => onChange('direccion', value)}
            placeholder="Calle 123, CABA"
            icon="location_on"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} icon="arrow_forward">
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step1Institucion;