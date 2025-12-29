
import React from 'react';
import { IllusSearch, IllusEmpty, IllusError, IllusSuccess, IllusConstruction, IllusDocuments } from './Illustrations';

interface EmptyStateProps {
  icon: string; // Used as key to map to illustration
  title: string;
  message: string;
  className?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, className = '', action }) => {
  
  // Mapping logic to select the right illustration based on the legacy icon name
  const renderIllustration = () => {
      const illustrationClass = "w-32 h-32 sm:w-40 sm:h-40 mx-auto drop-shadow-sm";
      
      switch (icon) {
          case 'search_off':
          case 'person_search':
          case 'search':
              return <IllusSearch className={illustrationClass} />;
          
          case 'error':
          case 'warning':
          case 'report':
              return <IllusError className={illustrationClass} />;
          
          case 'check_circle':
          case 'task_alt':
          case 'verified':
          case 'verified_user':
              return <IllusSuccess className={illustrationClass} />;

          case 'construction':
          case 'pending_actions':
              return <IllusConstruction className={illustrationClass} />;
          
          case 'inbox':
          case 'list_alt':
          case 'description':
          case 'folder_off':
              return <IllusDocuments className={illustrationClass} />;

          default:
              return <IllusEmpty className={illustrationClass} />;
      }
  };

  return (
    <div className={`text-center py-12 px-6 rounded-3xl transition-all duration-300 ${className}`}>
      
      <div className="mb-6 animate-[subtle-bob_4s_ease-in-out_infinite]">
         {renderIllustration()}
      </div>

      <h3 className="font-extrabold text-slate-900 dark:text-white text-xl sm:text-2xl tracking-tight mb-2">
        <span>{title}</span>
      </h3>
      
      <div className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed">
        <span>{message}</span>
      </div>

      {action && (
        <div className="mt-8 flex justify-center">
            {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
