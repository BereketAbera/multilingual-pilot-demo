// Everything in this file is about the sample itself and is written in English on purpose:
// the footer, the notes pages, the pseudo-locale banner and the one screen left un-enabled.
// The translated application is everything else.

import { BookOpenText, Compass, FlaskConical, Languages, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 font-medium ${
    isActive ? 'bg-action-tint text-action' : 'text-ink hover:bg-page'
  }`;

export function ToolTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-tool px-2 py-0.5 text-xs font-medium text-tool">
      {children}
    </span>
  );
}

export function UnenabledNavItem({ onNavigate }: { onNavigate: () => void }) {
  return (
    <li>
      <NavLink to="/receiving" onClick={onNavigate} className={navClass}>
        <Truck aria-hidden="true" className="size-5 shrink-0" />
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          Receiving <ToolTag>not enabled</ToolTag>
        </span>
      </NavLink>
    </li>
  );
}

export function SampleNav({ onNavigate }: { onNavigate: () => void }) {
  const icon = 'size-5 shrink-0';
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p id="sample-nav" className="px-3 pb-1 text-xs font-medium text-muted">
        About this sample
      </p>
      <ul aria-labelledby="sample-nav" className="space-y-1">
        <li>
          <NavLink to="/" end onClick={onNavigate} className={navClass}>
            <Compass aria-hidden="true" className={icon} />
            <span>Start here</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/translation-status" onClick={onNavigate} className={navClass}>
            <Languages aria-hidden="true" className={icon} />
            <span>Translation status</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/handoff" onClick={onNavigate} className={navClass}>
            <BookOpenText aria-hidden="true" className={icon} />
            <span>Handoff</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
}

export function PseudoBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-tool bg-tool-tint px-4 py-2 text-sm text-tool md:px-6" data-testid="pseudo-banner">
      <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
      <strong className="font-semibold">Pseudo-locale</strong>
      <span>
        Accented text in brackets comes from the translation files. Plain English is either data (product and supplier
        names) or a string that is still hard-coded, as on Receiving.
      </span>
    </div>
  );
}

export function SampleFooter() {
  return (
    <footer className="border-t border-line bg-white px-4 py-3 text-sm text-muted md:px-6">
      Sample by Bereket A. · fictional data
    </footer>
  );
}

/** Heading block for the three notes pages, which are in English only. */
export function SampleNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <ToolTag>Notes about the sample · English only</ToolTag>
      <h1 className="mt-2 text-2xl">{title}</h1>
      {children ? <div className="mt-2 max-w-3xl text-muted">{children}</div> : null}
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-page px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
}
