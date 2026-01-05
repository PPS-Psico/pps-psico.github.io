import React from 'react';
import { CriteriosPanelSkeleton, SkeletonBox } from '../Skeletons';
import WelcomeBanner from './WelcomeBanner';

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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Enrollment Cards */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <SkeletonBox className="h-7 w-48" />
          </div>
          {/* Enrollment Card Skeleton */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="w-full">
                <SkeletonBox className="h-6 w-3/4 mb-3" />
                <SkeletonBox className="h-4 w-1/3" />
              </div>
              <SkeletonBox className="h-8 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <SkeletonBox className="h-12 rounded-xl" />
              <SkeletonBox className="h-12 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Right Column: Opportunities / Upcoming */}
        <div className="space-y-6">
          <SkeletonBox className="h-7 w-40 mb-2" />
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 py-2">
                <SkeletonBox className="h-12 w-12 rounded-lg flex-shrink-0" />
                <div className="space-y-2 w-full">
                  <SkeletonBox className="h-4 w-3/4" />
                  <SkeletonBox className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardLoadingSkeleton;
