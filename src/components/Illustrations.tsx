
import React from 'react';

interface IllustrationProps {
  className?: string;
}

export const IllusSearch: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="90" cy="90" r="50" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="8" strokeDasharray="10 10"/>
        <circle cx="90" cy="90" r="30" className="fill-blue-100 dark:fill-blue-900/30"/>
        <path d="M130 130L160 160" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="12" strokeLinecap="round"/>
        <circle cx="110" cy="70" r="8" className="fill-blue-400 dark:fill-blue-500 animate-pulse"/>
    </svg>
);

export const IllusEmpty: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="50" y="40" width="100" height="120" rx="10" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="8"/>
        <path d="M50 80H150" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="4"/>
        <rect x="70" y="70" width="60" height="60" rx="30" className="fill-slate-50 dark:fill-slate-800/50 stroke-slate-200 dark:stroke-slate-700" strokeWidth="4"/>
        <path d="M90 100L110 100" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="130" cy="140" r="15" className="fill-amber-100 dark:fill-amber-900/30 stroke-amber-200 dark:stroke-amber-700" strokeWidth="4"/>
    </svg>
);

export const IllusSuccess: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="60" className="fill-emerald-50 dark:fill-emerald-900/20 stroke-emerald-100 dark:stroke-emerald-800" strokeWidth="4"/>
        <path d="M70 100L90 120L130 80" className="stroke-emerald-500 dark:stroke-emerald-400" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="50" cy="50" r="5" className="fill-emerald-300 animate-ping"/>
        <circle cx="150" cy="150" r="3" className="fill-emerald-400 animate-bounce"/>
    </svg>
);

export const IllusError: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M100 40L160 150H40L100 40Z" className="fill-rose-50 dark:fill-rose-900/20 stroke-rose-200 dark:stroke-rose-800" strokeWidth="6" strokeLinejoin="round"/>
        <path d="M100 80V110" className="stroke-rose-400 dark:stroke-rose-500" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="100" cy="130" r="6" className="fill-rose-500"/>
    </svg>
);

export const IllusConstruction: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
     <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="40" y="140" width="120" height="20" rx="4" className="fill-slate-200 dark:fill-slate-700"/>
        <path d="M60 140L60 80L100 50L140 80L140 140" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="6" strokeLinejoin="round"/>
        <circle cx="100" cy="90" r="15" className="fill-indigo-100 dark:fill-indigo-900/30 stroke-indigo-300 dark:stroke-indigo-700" strokeWidth="4"/>
        <path d="M90 90H110" className="stroke-indigo-400" strokeWidth="2"/>
        <path d="M100 80V100" className="stroke-indigo-400" strokeWidth="2"/>
     </svg>
);

export const IllusDocuments: React.FC<IllustrationProps> = ({ className = "w-32 h-32" }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
       <rect x="60" y="40" width="80" height="100" rx="8" className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-600" strokeWidth="4"/>
       <path d="M75 70H125" className="stroke-blue-200 dark:stroke-blue-900" strokeWidth="4" strokeLinecap="round"/>
       <path d="M75 90H125" className="stroke-blue-200 dark:stroke-blue-900" strokeWidth="4" strokeLinecap="round"/>
       <path d="M75 110H105" className="stroke-blue-200 dark:stroke-blue-900" strokeWidth="4" strokeLinecap="round"/>
       
       <rect x="80" y="110" width="80" height="60" rx="8" className="fill-blue-50 dark:fill-blue-900/40 stroke-blue-300 dark:stroke-blue-700" strokeWidth="4"/>
       <circle cx="120" cy="140" r="12" className="fill-blue-500"/>
       <path d="M115 140L118 143L125 136" className="stroke-white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
