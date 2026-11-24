import type { ButtonHTMLAttributes, ReactNode } from 'react';
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

/** No fixed width; the label may wrap to two lines. 44px tall at least. */
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const tone =
    variant === 'primary'
      ? 'bg-action text-white hover:bg-action-dark disabled:bg-field'
      : 'border border-field bg-white text-ink hover:bg-page';
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-center font-medium ${tone} ${className}`}
    />
  );
}

export type Tone = 'ok' | 'hold' | 'bad' | 'info' | 'neutral' | 'tool';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-tint text-ok',
  hold: 'bg-hold-tint text-hold',
  bad: 'bg-bad-tint text-bad',
  info: 'bg-action-tint text-action',
  neutral: 'bg-page text-ink border border-line',
  tool: 'bg-tool-tint text-tool',
};

/** A state is always an icon, a word and a colour, never colour alone. */
export function Chip({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium ${TONES[tone]}`}>
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

export function Loading() {
  return (
    <p role="status" className="rounded-lg border border-line bg-white px-4 py-6 text-muted">
      <Msg id="common:state.loading" />
    </p>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const i18n = useI18n();
  const known = error instanceof ApiProblem ? i18n.tCode(error.problem.code, problemValues(error.problem.values, i18n)) : null;
  return (
    <div role="alert" className="rounded-lg border border-bad bg-bad-tint px-4 py-4">
      <p className="font-medium text-bad">{known ? known.text : <Msg id="common:state.error" />}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        <Msg id="common:state.retry" />
      </Button>
    </div>
  );
}
