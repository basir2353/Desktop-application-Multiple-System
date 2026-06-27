import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getNavItemsForSystem } from "../../lib/businessSystems";
import { useSystemStore } from "../../stores/systemStore";
import { amberPillActiveClass, pillInactiveClass } from "../lib/themeClasses";
import { type PopsNavGroup, type PopsNavItem } from "../spec/modules";
import { PopsNavIcon } from "./popsNavIcons";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition",
    isActive
      ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30"
      : "text-slate-100 hover:bg-slate-600 hover:text-white",
  ].join(" ");

const childNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "relative flex items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-[12px] font-medium transition",
    isActive
      ? "font-semibold text-amber-300 before:absolute before:left-2.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-amber-400"
      : "text-slate-300 hover:bg-slate-600 hover:text-white before:absolute before:left-2.5 before:h-1 before:w-1 before:rounded-full before:bg-slate-400",
  ].join(" ");

const mobilePillClass = ({ isActive }: { isActive: boolean }) =>
  [
    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
    isActive
      ? "bg-amber-500 text-slate-950"
      : "bg-white text-slate-800 ring-1 ring-slate-200",
  ].join(" ");

function groupPaths(group: PopsNavGroup): string[] {
  return group.children.map((c) => c.path);
}

function isGroupActive(group: PopsNavGroup, pathname: string): boolean {
  return groupPaths(group).some((p) => pathname === `/pops/${p}` || pathname.startsWith(`/pops/${p}/`));
}

function PopsNavGroupSidebar({ group }: { group: PopsNavGroup }): JSX.Element {
  const { pathname } = useLocation();
  const active = isGroupActive(group, pathname);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition",
          active
            ? "bg-slate-600 text-white ring-1 ring-slate-500"
            : "text-slate-100 hover:bg-slate-600 hover:text-white",
        ].join(" ")}
        aria-expanded={open}
      >
        <PopsNavIcon label={group.label} className="h-4 w-4" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 border-l-2 border-slate-500 ml-4 pl-1">
          {group.children.map((child) => (
            <NavLink key={child.path} to={`/pops/${child.path}`} end className={childNavLinkClass}>
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PopsNavGroupMobile({ group }: { group: PopsNavGroup }): JSX.Element {
  const { pathname } = useLocation();
  const active = isGroupActive(group, pathname);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
          active || open ? amberPillActiveClass : pillInactiveClass,
        ].join(" ")}
        aria-expanded={open}
      >
        {group.label} ▾
      </button>
      {open
        ? group.children.map((child) => (
            <NavLink key={child.path} to={`/pops/${child.path}`} end className={mobilePillClass}>
              {child.label}
            </NavLink>
          ))
        : null}
    </>
  );
}

function renderSidebarItem(item: PopsNavItem): JSX.Element {
  if (item.type === "link") {
    return (
      <NavLink key={item.path} to={`/pops/${item.path}`} className={navLinkClass}>
        <PopsNavIcon label={item.label} className="h-4 w-4" />
        <span className="truncate">{item.label}</span>
      </NavLink>
    );
  }
  return <PopsNavGroupSidebar key={item.label} group={item} />;
}

function renderMobileItem(item: PopsNavItem): JSX.Element {
  if (item.type === "link") {
    return (
      <NavLink key={item.path} to={`/pops/${item.path}`} className={mobilePillClass}>
        {item.label}
      </NavLink>
    );
  }
  return <PopsNavGroupMobile key={item.label} group={item} />;
}

function useSystemNavItems(): PopsNavItem[] {
  const systemId = useSystemStore((s) => s.systemId);
  return useMemo(
    () => getNavItemsForSystem(systemId ?? "restaurant"),
    [systemId],
  );
}

export function PopsSidebarNav(): JSX.Element {
  const navItems = useSystemNavItems();
  return <div className="space-y-0.5">{navItems.map(renderSidebarItem)}</div>;
}

export function PopsMobileNav(): JSX.Element {
  const navItems = useSystemNavItems();
  return <>{navItems.map(renderMobileItem)}</>;
}
