"use client";

import { useState } from "react";
import type { NavSectionId, NotificationItem, StudentProfile } from "@/types/dashboard";
import { BellIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/icons";

interface HeaderProps {
  title: string;
  welcomeMessage: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  student: StudentProfile;
  onOpenMobileMenu: () => void;
  onNavigate: (id: NavSectionId) => void;
  onSignOut: () => void;
}

export function Header({
  title,
  welcomeMessage,
  searchQuery,
  onSearchChange,
  notifications,
  onMarkAllRead,
  student,
  onOpenMobileMenu,
  onNavigate,
  onSignOut,
}: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile trigger + Title + Welcome */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 lg:hidden"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {title}
              </h1>
            </div>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {welcomeMessage}
            </p>
          </div>
        </div>

        {/* Right: Search + Notifications + Profile Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative hidden md:block md:w-64 lg:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search topics, tasks, materials..."
              aria-label="Search dashboard"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <BellIcon className="h-[18px] w-[18px]" />
              {unreadCount > 0 ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
              ) : null}
            </button>

            {notifOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setNotifOpen(false)}
                />
                <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-900">
                      Notifications ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">
                      No notifications yet
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {notifications.map((item) => (
                        <li
                          key={item.id}
                          className={`px-4 py-3 ${
                            item.unread ? "bg-indigo-50/30" : "bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-slate-900">
                              {item.title}
                            </p>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {item.timeAgo}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
                            {item.detail}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Student Avatar */}
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            title={`${student.name} — ${student.program}`}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-[11px] font-semibold text-white">
              {student.initials}
            </div>
            <span className="hidden text-xs font-medium text-slate-700 sm:inline">
              {student.firstName}
            </span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="hidden h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="border-t border-slate-100 px-4 py-2 md:hidden">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search topics, tasks, materials..."
            aria-label="Search dashboard"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

