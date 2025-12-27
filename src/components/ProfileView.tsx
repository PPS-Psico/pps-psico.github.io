
import React, { useState, useEffect } from 'react';
import {
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_DNI_ESTUDIANTES,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_TELEFONO_ESTUDIANTES,
  FIELD_NOTAS_INTERNAS_ESTUDIANTES,
} from '../constants';
import { SkeletonBox } from './Skeletons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useModal } from '../contexts/ModalContext';
import type { EstudianteFields } from '../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../lib/db';
import Input from './Input';

const ProfileField: React.FC<{ 
    label: string; 
    value?: string | number | null; 
    icon: string; 
    isEditable?: boolean;
    name?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}> = ({ label, value, icon, isEditable, name, onChange, type = "text" }) => (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 group ${isEditable ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-white dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-700'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isEditable ? 'bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500'}`}>
            <span className="material-icons !text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            {isEditable && onChange && name ? (
                <input 
                    type={type}
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    className="w-full bg-transparent border-b border-blue-300 dark:border-blue-700 text-sm font-bold text-blue-900 dark:text-blue-100 focus:outline-none focus:border-blue-500 pb-0.5"
                    autoFocus={name === FIELD_CORREO_ESTUDIANTES}
                />
            ) : (
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{value || '---'}</p>
            )}
        </div>
        {isEditable && (
            <span className="material-icons text-blue-400 !text-sm animate-pulse">edit</span>
        )}
    </div>
);

interface ProfileViewProps {
  studentDetails: EstudianteFields | null;
  isLoading: boolean;
  updateInternalNotes: any;
}

const ProfileView: React.FC<ProfileViewProps> = ({ studentDetails, isLoading, updateInternalNotes }) => {
  const { isSuperUserMode, isJefeMode } = useAuth();
  const { subscribeToPush, isPushEnabled } = useNotifications();
  const { showModal } = useModal();
  const queryClient = useQueryClient();
  
  // Internal Notes (Admin)
  const [internalNotes, setInternalNotes] = useState('');
  const [isNotesChanged, setIsNotesChanged] = useState(false);

  // Editing Profile (Student)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ correo: string, telefono: string }>({ correo: '', telefono: '' });

  useEffect(() => {
    if (studentDetails) {
        setInternalNotes(studentDetails[FIELD_NOTAS_INTERNAS_ESTUDIANTES] || '');
        setEditForm({
            correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ''),
            telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || '')
        });
    }
    setIsNotesChanged(false);
  }, [studentDetails]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalNotes(e.target.value);
    setIsNotesChanged(e.target.value !== (studentDetails?.[FIELD_NOTAS_INTERNAS_ESTUDIANTES] || ''));
  };

  const handleSaveNotes = () => {
    if (isNotesChanged) updateInternalNotes.mutate(internalNotes);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { correo: string, telefono: string }) => {
        if (!(studentDetails as any).id) throw new Error("ID no encontrado");
        return db.estudiantes.update((studentDetails as any).id, {
            [FIELD_CORREO_ESTUDIANTES]: data.correo,
            [FIELD_TELEFONO_ESTUDIANTES]: data.telefono
        });
    },
    onSuccess: () => {
        showModal('Actualizado', 'Tus datos de contacto han sido guardados correctamente.');
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: ['student'] });
    },
    onError: (error: any) => {
        showModal('Error', `No se pudo actualizar: ${error.message}`);
    }
  });

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = () => {
      if (!editForm.correo || !editForm.correo.includes('@')) {
          showModal('Error', 'Por favor ingresa un correo electrónico válido.');
          return;
      }
      updateProfileMutation.mutate(editForm);
  };

  if (isLoading || !studentDetails) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <SkeletonBox key={i} className="h-20 w-full" />)}
        </div>
    );
  }

  const {
    [FIELD_NOMBRE_ESTUDIANTES]: nombre,
    [FIELD_LEGAJO_ESTUDIANTES]: legajo,
    [FIELD_DNI_ESTUDIANTES]: dni,
  } = studentDetails;

  return (
    <div className="space-y-8 animate-fade-in">
        {/* Grid de Datos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-2">
                 <ProfileField label="Nombre Completo" value={nombre} icon="badge" />
             </div>
             
             {/* Datos Fijos (Identidad) */}
             <ProfileField label="Legajo" value={legajo} icon="numbers" />
             <ProfileField label="DNI" value={dni} icon="fingerprint" />
             
             {/* Datos Editables (Contacto) */}
             <ProfileField 
                label="Correo Electrónico" 
                value={isEditing ? editForm.correo : studentDetails[FIELD_CORREO_ESTUDIANTES]} 
                icon="email" 
                isEditable={isEditing}
                name="correo"
                onChange={handleEditChange}
                type="email"
            />
             <ProfileField 
                label="Teléfono" 
                value={isEditing ? editForm.telefono : studentDetails[FIELD_TELEFONO_ESTUDIANTES]} 
                icon="phone" 
                isEditable={isEditing}
                name="telefono"
                onChange={handleEditChange}
                type="tel"
            />
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
             {!isEditing ? (
                 <>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 group transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <span className="material-icons text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">edit_note</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">Editar Datos de Contacto</span>
                    </button>
                    
                    <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Notificaciones</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Recibe alertas sobre cambios.</p>
                        </div>
                        <button 
                            onClick={subscribeToPush}
                            disabled={isPushEnabled}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isPushEnabled ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}
                        >
                            {isPushEnabled ? 'Activadas' : 'Activar'}
                        </button>
                    </div>
                 </>
             ) : (
                 <div className="w-full flex gap-3 animate-fade-in">
                     <button
                        onClick={() => { setIsEditing(false); setEditForm({ correo: String(studentDetails[FIELD_CORREO_ESTUDIANTES] || ''), telefono: String(studentDetails[FIELD_TELEFONO_ESTUDIANTES] || '') }); }}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={updateProfileMutation.isPending}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="flex-[2] py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                    >
                        {updateProfileMutation.isPending ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"/>
                        ) : (
                            <>
                                <span className="material-icons !text-lg">save</span>
                                Guardar Cambios
                            </>
                        )}
                    </button>
                 </div>
             )}
        </div>
        
        {isEditing && (
            <div className="text-center">
                 <p className="text-xs text-slate-400 italic">
                    Nota: Actualizar tu correo aquí modificará dónde recibes las notificaciones, pero tu usuario de acceso seguirá siendo el mismo hasta que lo cambies en seguridad.
                </p>
            </div>
        )}

        {/* Notas Internas (Solo Admin) */}
        {(isSuperUserMode || isJefeMode) && (
            <div className="mt-8 bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-500">
                    <span className="material-icons">lock</span>
                    <h3 className="font-bold text-sm uppercase tracking-wide">Notas Internas (Privado)</h3>
                </div>
                <textarea
                    value={internalNotes}
                    onChange={handleNotesChange}
                    rows={4}
                    className="w-full text-sm rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900/50 p-4 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                    placeholder="Escribir nota..."
                />
                <div className="mt-3 flex justify-end">
                     <button
                        onClick={handleSaveNotes}
                        disabled={!isNotesChanged || updateInternalNotes.isPending}
                        className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg text-xs shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-all"
                    >
                        {updateInternalNotes.isPending ? 'Guardando...' : 'Guardar Nota'}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProfileView;
