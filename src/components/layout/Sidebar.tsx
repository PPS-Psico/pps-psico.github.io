
import React from 'react';

// Define the shape of the main navigation items
interface NavItem {
    id: string;
    label: string;
    icon: string;
}

// Define the shape of the dynamic student tabs
interface StudentTab {
    id: string; // legajo
    nombre: string;
}

interface SidebarProps {
    mainNavItems: NavItem[];
    studentTabs: StudentTab[];
    activeTabId: string;
    onTabChange: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    className?: string;
}

const NavLink: React.FC<{
    item: NavItem;
    isActive: boolean;
    onClick: () => void;
}> = ({ item, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-50'
            }`}
    >
        <span className="material-icons !text-xl">{item.icon}</span>
        <span className="truncate">{item.label}</span>
    </button>
);

const StudentLink: React.FC<{
    student: StudentTab;
    isActive: boolean;
    onClick: () => void;
    onClose: (e: React.MouseEvent) => void;
}> = ({ student, isActive, onClick, onClose }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 pl-4 pr-9 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-50'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
        >
            <span className="material-icons !text-lg text-slate-400 dark:text-slate-500">school</span>
            <span className="truncate">{student.nombre}</span>
        </button>
        <button
            onClick={onClose}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 dark:text-slate-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
            aria-label={`Cerrar panel de ${student.nombre}`}
        >
            <span className="material-icons !text-base">close</span>
        </button>
    </div>
);


const Sidebar: React.FC<SidebarProps> = ({
    mainNavItems,
    studentTabs,
    activeTabId,
    onTabChange,
    onTabClose,
    className = '',
}) => {
    return (
        <aside className={`flex-shrink-0 glass-panel p-4 rounded-2xl transition-all duration-300 ${className}`}>
            <nav className="flex flex-col h-full">
                {/* Main Navigation */}
                <div className="space-y-2">
                    {mainNavItems.map(item => (
                        <NavLink
                            key={item.id}
                            item={item}
                            isActive={activeTabId === item.id}
                            onClick={() => onTabChange(item.id)}
                        />
                    ))}
                </div>

                {/* Divider and Student Tabs */}
                {studentTabs.length > 0 && (
                    <>
                        <hr className="my-4 border-slate-200 dark:border-slate-700" />
                        <div className="space-y-1.5 flex-grow overflow-y-auto">
                            <h3 className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Paneles Abiertos</h3>
                            {studentTabs.map(student => (
                                <StudentLink
                                    key={student.id}
                                    student={student}
                                    isActive={activeTabId === student.id}
                                    onClick={() => onTabChange(student.id)}
                                    onClose={(e) => {
                                        e.stopPropagation();
                                        onTabClose(student.id);
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
