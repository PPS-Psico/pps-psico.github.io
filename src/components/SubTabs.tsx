
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
    <div className={`w-full flex justify-center ${className}`}>
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
