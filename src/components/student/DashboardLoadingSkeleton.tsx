import React from "react";
import {
  CriteriosPanelSkeleton,
  SkeletonBox,
  ConvocatoriaCardSkeleton,
  ListSkeleton,
} from "../Skeletons";
import WelcomeBanner from "./WelcomeBanner";

const DashboardLoadingSkeleton: React.FC = () => (
  <div className="space-y-8 animate-fade-in w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WelcomeBanner isLoading={true} studentDetails={null} />

    <div className="hidden md:block">
      <CriteriosPanelSkeleton />
    </div>

    {/* TABS MIMIC */}
    <div className="w-full">
      <div className="border-b border-slate-200 dark:border-slate-700/60 mb-8">
        <div className="flex space-x-8 px-2 overflow-x-auto">
          <div className="pb-4 border-b-2 border-blue-500/50">
            <SkeletonBox className="h-5 w-24" />
          </div>
          <div className="pb-4 opacity-50">
            <SkeletonBox className="h-5 w-32" />
          </div>
          <div className="pb-4 opacity-50">
            <SkeletonBox className="h-5 w-28" />
          </div>
          <div className="pb-4 opacity-50">
            <SkeletonBox className="h-5 w-20" />
          </div>
        </div>
      </div>

      {/* CONTENT MIMIC (Home View) */}
      <div className="space-y-12">
        {/* Convocatorias Section */}
        <div>
          <SkeletonBox className="h-4 w-48 mb-6" />
          <div className="grid grid-cols-1 gap-6">
            <ConvocatoriaCardSkeleton />
            <ConvocatoriaCardSkeleton />
          </div>
        </div>

        {/* Secondary Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <SkeletonBox className="h-6 w-40 mb-4" />
            <ListSkeleton items={3} />
          </div>
          <div>
            <SkeletonBox className="h-6 w-32 mb-4" />
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
              <ListSkeleton items={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardLoadingSkeleton;
