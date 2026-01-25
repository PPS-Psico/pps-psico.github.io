
import React from 'react';
import UnifiedTabs, { TabItem } from './UnifiedTabs';

interface SubTab {
  id: string;
  label: string;
  icon?: string;
}

interface SubTabsProps {
  tabs: SubTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const SubTabs: React.FC<SubTabsProps> = ({ tabs, activeTabId, onTabChange, className = '' }) => {
  // Adapt old prop structure to new UnifiedTabs structure
  const formattedTabs: TabItem[] = tabs.map(t => ({
    id: t.id,
    label: t.label,
    icon: t.icon
  }));

  return (
    <div className={`relative w-full flex justify-start md:justify-center overflow-x-auto ${className}`}>
      {/* Indicator shadow for scrollability if content overflows */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-20 md:hidden" />
      <UnifiedTabs
        tabs={formattedTabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        layoutIdPrefix="subtabs"
        variant="secondary" // Use secondary styling for inner tabs
      />
    </div>
  );
};

export default SubTabs;
