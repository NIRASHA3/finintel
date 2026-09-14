import React from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  isPrototype?: boolean;
  prototypeLabel?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  actions,
  isPrototype = false,
  prototypeLabel = "PROTOTYPE",
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[#15616D] transition font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#15616D] rounded px-1"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-700 font-semibold" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {isPrototype && (
            <StatusBadge status="PROTOTYPE" label={prototypeLabel} size="sm" />
          )}
        </div>

        {description && (
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
