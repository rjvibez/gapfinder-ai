"use client";

import type { ComponentType, SVGProps } from "react";
import type { NavItem, NavSectionId, StudentProfile } from "@/types/dashboard";
import {
  CloseIcon,
  DiagnosticIcon,
  GapAnalysisIcon,
  GapFinderLogo,
  MaterialsIcon,
  OverviewIcon,
  PlannerIcon,
  ProgressIcon,
  SettingsIcon,
  TopicMapIcon,
} from "@/components/icons";

const NAV_ICONS: Record<NavSectionId, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: OverviewIcon,
  materials: MaterialsIcon,
  "topic-map": TopicMapIcon,
  "diagnostic-quiz": DiagnosticIcon,
  "gap-analysis": GapAnalysisIcon,
  "revision-planner": PlannerIcon,
  progress: ProgressIcon,
  settings: SettingsIcon,
};

interface SidebarProps {
  items: NavItem[];
  activeId: NavSectionId;
  onSelect: (id: NavSectionId) => void;
  student: StudentProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  items,
  activeId,
  onSelect,
  student,
  mobileOpen,
  onCloseMobile,
  onSignOut,
}: SidebarProps) {
  const handleSelect = (id: NavSectionId) => {
    onSelect(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200/90">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100">
        <button
          type="button"
          onClick={() => handleSelect("overview")}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <GapFinderLogo className="h-7 w-7 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              GapFinder
            </span>
            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
              AI
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Close navigation menu"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        <p className="px-2.5 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const isActive = item.id === activeId;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50/90 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive
                          ? "text-indigo-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Student profile footer */}
      <div className="border-t border-slate-200/80 p-3">
        <button
          type="button"
          onClick={() => handleSelect("settings")}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white">
            {student.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">
              {student.name}
            </p>
            <p className="truncate text-[11.5px] text-slate-500">
              {student.program}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            {sidebarContent}
          </div>
        </div>
      ) : null}
    </>
  );
}

