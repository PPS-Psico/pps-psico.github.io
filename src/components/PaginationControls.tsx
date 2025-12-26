
import React from 'react';

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
    totalItems: number;
    className?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const PaginationControls: React.FC<PaginationControlsProps> = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    itemsPerPage, 
    onItemsPerPageChange, 
    totalItems,
    className = ""
}) => {
    return (
        <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 py-4 px-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 ${className}`}>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                    <span>Mostrar</span>
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => { onItemsPerPageChange(Number(e.target.value)); onPageChange(1); }}
                        className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200"
                    >
                        {ITEMS_PER_PAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <span className="hidden sm:inline-block border-l border-slate-300 dark:border-slate-600 pl-4 h-4 leading-4">
                    Total: {totalItems}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <button 
                    onClick={() => onPageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300"
                >
                    <span className="material-icons !text-lg">chevron_left</span>
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[3rem] text-center">
                    {currentPage} / {totalPages || 1}
                </span>
                <button 
                    onClick={() => onPageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300"
                >
                    <span className="material-icons !text-lg">chevron_right</span>
                </button>
            </div>
        </div>
    );
};

export default PaginationControls;
