"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { crmNavIconMap } from "@/components/layout/crmNavIconMap";
import { useTheme } from "@/lib/ThemeContext";
import { usePermissions } from "@/lib/hooks/usePermissions";

type SidebarProps = {
  isCollapsed: boolean;
};

export default function Sidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { accessibleNavItems } = usePermissions();

  const mainItems = accessibleNavItems.filter((item) => item.section === "main");
  const managementItems = accessibleNavItems.filter((item) => item.section === "management");

  const renderNavItem = (item: (typeof accessibleNavItems)[number]) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const ItemIcon = crmNavIconMap[item.iconKey];

    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        className={clsx(
          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
          isCollapsed ? "justify-center" : "justify-start",
          isActive
            ? isDark
              ? "bg-primary-blue/20 text-primary-blue"
              : "bg-light-blue/60 text-primary-blue"
            : isDark
              ? "text-dark-text hover:bg-dark-border/50 hover:text-primary-blue"
              : "text-dark-charcoal hover:bg-light-blue/40 hover:text-primary-blue"
        )}
        aria-current={isActive ? "page" : undefined}
        title={isCollapsed ? item.label : undefined}
      >
        <ItemIcon
          className={clsx(
            "h-5 w-5 shrink-0",
            isActive
              ? "text-primary-blue"
              : isDark
                ? "text-dark-text-secondary"
                : "text-dark-charcoal"
          )}
        />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col border-r shadow-sm transition-all duration-200",
        isCollapsed ? "w-20" : "w-64",
        isDark
          ? "border-dark-border bg-dark-card"
          : "border-light-grey bg-pure-white"
      )}
    >
      <nav className="mt-4 flex flex-1 flex-col px-3">
        <div className="flex flex-col gap-2">
          {mainItems.map(renderNavItem)}
        </div>

        {managementItems.length > 0 && (
          <>
            <div
              className={clsx(
                "my-4 border-t",
                isDark ? "border-dark-border" : "border-light-grey"
              )}
            />

            {!isCollapsed && (
              <p
                className={clsx(
                  "mb-2 px-4 text-[10px] font-bold uppercase tracking-wider",
                  isDark ? "text-dark-text-muted" : "text-dark-charcoal/50"
                )}
              >
                Management
              </p>
            )}

            <div className="flex flex-col gap-2 pb-6">
              {managementItems.map(renderNavItem)}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
