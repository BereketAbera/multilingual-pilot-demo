import { ClipboardList, Menu, PackageSearch, SquarePen, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import markUrl from '../assets/brand/mark.svg';
import { Msg, useI18n, useReview } from '../i18n';
import { usePlantState } from '../lib/plant';
import { APP_NAME } from '../lib/usePageTitle';
import { ErrorBoundary } from './ErrorBoundary';
import { LanguageSelector } from './LanguageSelector';
import { PseudoBanner, SampleFooter, SampleNav, UnenabledNavItem } from './sample/SampleChrome';

function NavItem({ to, icon, children, onNavigate }: { to: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return (
    <li>
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 font-medium ${
            isActive ? 'bg-action-tint text-action' : 'text-ink hover:bg-page'
          }`
        }
      >
        {icon}
        <span>{children}</span>
      </NavLink>
    </li>
  );
}

function PlantInfo({ className = '' }: { className?: string }) {
  const i18n = useI18n();
  const { plant, error } = usePlantState();
  if (!plant) {
    // Still loading: nothing yet. Failed: say so here, quietly. A screen that needs the settings shows the error and a retry.
    return error ? (
      <p className={`text-sm text-muted ${className}`} data-testid="plant-unavailable">
        <Msg id="common:header.plantUnavailable" />
      </p>
    ) : null;
  }
  const units = [i18n.unit(plant.units.mass), i18n.unit(plant.units.temperature)].join(', ');
  return (
    <p className={`text-sm text-muted ${className}`}>
      <span className="font-medium text-ink">
        <Msg id="common:header.plant" values={{ name: plant.name }} />
      </span>
      <span aria-hidden="true"> · </span>
      <Msg id="common:header.units" values={{ units }} />
    </p>
  );
}

/**
 * Review mode: underline the English that stands in for a missing translation. The number is
 * how many messages that is in the current language; with none, there is nothing to mark and
 * the switch is off.
 */
function ReviewToggle({ className = '' }: { className?: string }) {
  const i18n = useI18n();
  const { markFallbacks, setMarkFallbacks } = useReview();
  const count = i18n.fallbackCount;
  const none = count === 0;
  const summary = i18n.t('common:header.fallbackCount', { count });
  return (
    <label
      title={summary}
      className={`flex min-h-11 items-center gap-2 text-sm font-medium ${none ? 'text-muted' : 'cursor-pointer text-tool'} ${className}`}
    >
      <input
        type="checkbox"
        data-testid="mark-fallbacks"
        disabled={none}
        checked={markFallbacks && !none}
        onChange={(event) => setMarkFallbacks(event.target.checked)}
        className="size-4 accent-tool"
      />
      <Msg id="common:header.markFallbacks" />
      <span
        aria-hidden="true"
        data-testid="fallback-count"
        className={`rounded-full border px-2 py-0.5 text-xs tabular-nums ${none ? 'border-line bg-page text-muted' : 'border-tool bg-tool text-white'}`}
      >
        {i18n.number(count)}
      </span>
      <span className="sr-only">{summary}</span>
    </label>
  );
}

export function Shell() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const iconClass = 'size-5 shrink-0';

  // The phone menu closes on Escape, like any other disclosure.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-30 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-md"
      >
        <Msg id="common:header.skip" />
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="flex items-center gap-3 px-4 py-2 md:px-6">
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-field md:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            aria-label={t('common:header.menu')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" className={iconClass} /> : <Menu aria-hidden="true" className={iconClass} />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-sm">
            {/* The mark is a tally of five. It is decoration beside the name, and the narrowest phones have no room for it. */}
            <img src={markUrl} alt="" width={28} height={24} className="hidden shrink-0 sm:block" />
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
              <span className="hidden text-sm text-muted lg:inline">
                <Msg id="common:app.tagline" />
              </span>
            </span>
          </Link>
          <PlantInfo className="ml-4 hidden border-l border-line pl-4 xl:block" />
          <div className="ml-auto flex items-center gap-4">
            <ReviewToggle className="hidden md:flex" />
            <LanguageSelector />
          </div>
        </div>
      </header>
      {locale === 'en-XA' ? <PseudoBanner /> : null}
      <div className="flex flex-1 flex-col md:flex-row">
        <div className={`${menuOpen ? 'block' : 'hidden'} shrink-0 border-b border-line bg-white md:block md:w-60 md:border-b-0 md:border-r`}>
          <nav id="app-nav" aria-label={t('common:nav.label')} className="p-3 md:sticky md:top-[3.8125rem]">
            <ul className="space-y-1">
              <NavItem to="/orders" icon={<ClipboardList aria-hidden="true" className={iconClass} />} onNavigate={closeMenu}>
                <Msg id="common:nav.orders" />
              </NavItem>
              <NavItem to="/lots" icon={<PackageSearch aria-hidden="true" className={iconClass} />} onNavigate={closeMenu}>
                <Msg id="common:nav.lots" />
              </NavItem>
              <NavItem to="/record-output" icon={<SquarePen aria-hidden="true" className={iconClass} />} onNavigate={closeMenu}>
                <Msg id="common:nav.recordOutput" />
              </NavItem>
              <UnenabledNavItem onNavigate={closeMenu} />
            </ul>
            <SampleNav onNavigate={closeMenu} />
            <div className="mt-3 space-y-1 border-t border-line px-3 pt-3 md:hidden">
              <PlantInfo />
              <ReviewToggle />
            </div>
          </nav>
        </div>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none md:px-6 md:py-6">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <SampleFooter />
    </div>
  );
}
