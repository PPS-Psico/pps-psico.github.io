
import React from 'react';

interface MobileSectionHeaderProps {
  title: React.ReactNode;
  description?: string;
}

const MobileSectionHeader: React.FC<MobileSectionHeaderProps> = ({ title, description }) => (
    <div className="relative p-6 rounded-3xl border border-blue-100/60 dark:border-slate-800 shadow-lg overflow-hidden bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/40 dark:from-slate-900 dark:via-[#0B1120] dark:to-slate-950 backdrop-blur-xl animate-fade-in-up group mb-6">
      {/* Decoraciones de fondo sutiles y modernas */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-400/10 to-teal-400/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col gap-2">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight drop-shadow-sm">
            {title}
        </h2>
        {description && (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mt-1 max-w-[95%]">
                {description}
            </p>
        )}
      </div>
    </div>
);

export default MobileSectionHeader;
