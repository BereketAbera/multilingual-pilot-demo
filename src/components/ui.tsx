import { CircleAlert, MoveHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Msg, useI18n } from '../i18n';
import { ApiProblem } from '../lib/api';
import { problemValues } from '../lib/problemValues';

export function Panel({ title, aside, children, id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line bg-white">
      {title ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
          <h2 id={id} className="text-base">
            {title}
          </h2>
          {aside ? <div className="text-sm text-muted">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' };

/** No fixed width; the label may wrap to two lines. 44px tall at least. A disabled button looks disabled. */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const tone =
    variant === 'primary'
      ? 'bg-action text-white hover:bg-action-dark disabled:bg-line disabled:text-muted'
      : 'border border-field bg-white text-ink hover:bg-page disabled:border-line disabled:bg-white disabled:text-field';
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-center font-medium disabled:cursor-not-allowed ${tone} ${className}`}
    />
  );
}

export type Tone = 'ok' | 'hold' | 'bad' | 'info' | 'neutral' | 'tool';

// Every tone carries a border, drawn or transparent, so all chips are the same height.
const TONES: Record<Tone, string> = {
  ok: 'border-transparent bg-ok-tint text-ok',
  hold: 'border-transparent bg-hold-tint text-hold',
  bad: 'border-transparent bg-bad-tint text-bad',
  info: 'border-transparent bg-action-tint text-action',
  neutral: 'border-line bg-page text-ink',
  tool: 'border-transparent bg-tool-tint text-tool',
};

/** A state is always an icon, a word and a colour, never colour alone. */
export function Chip({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium ${TONES[tone]}`}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

/** A dash for "nothing here yet", with words for screen readers. */
export function NoValue() {
  const { t } = useI18n();
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t('common:noValue')}</span>
    </>
  );
}

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl">{title}</h1>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </div>
  );
}

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Grey bars in the shape of what is coming, so the page does not jump when the data arrives. */
export function Loading({ shape = 'table' }: { shape?: 'table' | 'form' }) {
  return (
    <div role="status" className="rounded-lg border border-line bg-white p-4" data-testid="loading">
      <span className="sr-only">
        <Msg id="common:state.loading" />
      </span>
      <div aria-hidden="true" className="animate-pulse">
        {shape === 'table' ? (
          <div className="space-y-3">
            <div className="h-4 w-2/5 rounded bg-line" />
            {SKELETON_ROWS.map((row) => (
              <div key={row} className="h-9 rounded bg-page" />
            ))}
          </div>
        ) : (
          <div className="max-w-xl space-y-5">
            {SKELETON_ROWS.slice(0, 4).map((row) => (
              <div key={row} className="space-y-2">
                <div className="h-4 w-1/3 rounded bg-line" />
                <div className="h-11 rounded bg-page" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Something could not be loaded. A problem the API named by code is shown in the user's
 * language. Retry is offered only where trying again can help.
 */
export function LoadError({ error, onRetry, children }: { error: unknown; onRetry?: () => void; children?: ReactNode }) {
  const i18n = useI18n();
  const known = error instanceof ApiProblem ? i18n.tCode(error.problem.code, problemValues(error.problem.values, i18n)) : null;
  return (
    <div role="alert" className="rounded-lg border border-bad bg-bad-tint px-4 py-4" data-testid="load-error">
      <p className="flex items-start gap-2 font-medium text-bad">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]" lang={known?.fallback ? 'en' : undefined}>
          {known ? known.text : <Msg id="common:state.error" />}
        </span>
      </p>
      {children ? <div className="mt-2 pl-7">{children}</div> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          <Msg id="common:state.retry" />
        </Button>
      ) : null}
    </div>
  );
}

type ScrollAreaProps = { className?: string; children: ReactNode } & ({ label: string; labelledBy?: undefined } | { labelledBy: string; label?: undefined });

/**
 * A wide table scrolls inside its own box instead of widening the page. While there is more
 * to the side, the right edge fades and a line under the table says so; neither shows when
 * everything fits. The box can be focused, so it also scrolls from the keyboard.
 */
export function ScrollArea({ label, labelledBy, className = '', children }: ScrollAreaProps) {
  const area = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ overflows: false, moreToTheRight: false });

  useEffect(() => {
    const element = area.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      const next = { overflows: hidden > 1, moreToTheRight: hidden - element.scrollLeft > 1 };
      setState((current) => (current.overflows === next.overflows && current.moreToTheRight === next.moreToTheRight ? current : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, []);

  return (
    <div className={className} data-overflows={state.overflows || undefined}>
      <div className="relative">
        <div ref={area} className="scroll-x" tabIndex={0} role="group" aria-label={label} aria-labelledby={labelledBy}>
          {children}
        </div>
        {state.moreToTheRight ? <div aria-hidden="true" className="scroll-fade" data-testid="scroll-fade" /> : null}
      </div>
      {state.overflows ? (
        <p className="flex items-center justify-end gap-1.5 border-t border-line px-3 py-2 text-sm text-muted" data-testid="scroll-hint">
          <MoveHorizontal aria-hidden="true" className="size-4 shrink-0" />
          <Msg id="common:table.more" />
        </p>
      ) : null}
    </div>
  );
}
