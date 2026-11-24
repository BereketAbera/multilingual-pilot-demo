import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DateField } from '../../components/DateField';
import { ServerExchange, ServerRuleShortcuts, type Scenario, type WireResult } from '../../components/sample/ServerExchange';
import { Button, LoadError, Loading, PageHeader } from '../../components/ui';
import { Msg, fractionDigits, i18nFor, useI18n, type I18n, type MessageKey, type MessageValues, type Unit } from '../../i18n';
import {
  ApiProblem,
  NO_CODE,
  apiPost,
  type Exchange,
  type Order,
  type OrdersResponse,
  type OutputReceipt,
  type OutputRequest,
  type ProblemDetails,
} from '../../lib/api';
import { addDays, addYears, completeDate, yearOf } from '../../lib/plainDate';
import { usePlantState } from '../../lib/plant';
import { problemValues } from '../../lib/problemValues';
import { recordUnknownCode } from '../../lib/unknownCodes';
import { useApi } from '../../lib/useApi';
import { usePageTitle } from '../../lib/usePageTitle';

const FIELDS = ['orderNo', 'quantity', 'shrink', 'productionDate', 'bestBeforeDate', 'temperature', 'notes'] as const;
type FieldName = (typeof FIELDS)[number];
type FormValues = Record<FieldName, string>;

// The same limits the API enforces. The API is the authority; checking here saves a round
// trip, and the line that repeats a value ("Will be recorded as ...") is shown only for a
// value these rules accept, so it never promises a record the form then refuses.
const NOTES_MAX = 280;
const QUANTITY_RANGE = { min: 0.1, max: 20000 };
const TEMPERATURE_RANGE = { min: 0, max: 150 };
const MAX_DECIMALS = 3;
const MAX_BACKDATE_DAYS = 30;
const MAX_SHELF_LIFE_YEARS = 5;

/** An error is stored as a key and raw values, so it re-renders correctly when the language changes. */
type FieldIssue =
  | { from: 'client'; id: MessageKey; values?: (i18n: I18n) => MessageValues }
  /** From the API: a code to translate, its raw values, and the server's own words in case this client has none. */
  | { from: 'server'; code: string; values: unknown; text: string };

type Issues = Partial<Record<FieldName, FieldIssue>>;

interface Units {
  mass: Unit;
  temperature: Unit;
}

/** A typed number is repeated with every decimal it has, so what is shown is what is sent. */
function exact(value: number, unit: Unit, i18n: I18n): string {
  return i18n.quantity(value, unit, Math.min(fractionDigits(value), 20));
}

function validate(values: FormValues, i18n: I18n, today: string, units: Units): { issues: Issues; request: OutputRequest | null } {
  const issues: Issues = {};
  const example = (sample: number) => (current: I18n) => ({ example: current.number(sample) });
  const required: FieldIssue = { from: 'client', id: 'output:validation.required' };
  const tooPrecise: FieldIssue = { from: 'client', id: 'output:validation.decimals', values: (current) => ({ max: current.number(MAX_DECIMALS) }) };
  const between = (min: string, max: string): FieldIssue => ({
    from: 'client',
    id: 'output:validation.dateRange',
    values: (current) => ({ min: current.date(min), max: current.date(max) }),
  });

  if (values.orderNo === '') issues.orderNo = required;

  const quantity = i18n.parseNumber(values.quantity);
  if (values.quantity.trim() === '') issues.quantity = required;
  else if (quantity === null) issues.quantity = { from: 'client', id: 'output:validation.number', values: example(1250.5) };
  else if (quantity <= 0) issues.quantity = { from: 'client', id: 'output:validation.positive' };
  else if (fractionDigits(quantity) > MAX_DECIMALS) issues.quantity = tooPrecise;
  else if (quantity < QUANTITY_RANGE.min || quantity > QUANTITY_RANGE.max) {
    issues.quantity = {
      from: 'client',
      id: 'output:validation.quantityRange',
      values: (current) => ({ min: exact(QUANTITY_RANGE.min, units.mass, current), max: exact(QUANTITY_RANGE.max, units.mass, current) }),
    };
  }

  const shrink = values.shrink.trim() === '' ? 0 : i18n.parseNumber(values.shrink);
  if (shrink === null) issues.shrink = { from: 'client', id: 'output:validation.number', values: example(12.5) };
  else if (shrink < 0) issues.shrink = { from: 'client', id: 'output:validation.notNegative' };
  else if (fractionDigits(shrink) > MAX_DECIMALS) issues.shrink = tooPrecise;
  else if (quantity !== null && quantity > 0 && shrink > quantity) issues.shrink = { from: 'client', id: 'output:validation.shrinkTooHigh' };

  const productionDate = completeDate(values.productionDate);
  const earliest = addDays(today, -MAX_BACKDATE_DAYS);
  if (productionDate === '') issues.productionDate = required;
  else if (productionDate > today) issues.productionDate = { from: 'client', id: 'output:validation.dateFuture' };
  else if (productionDate < earliest) issues.productionDate = between(earliest, today);

  const bestBeforeDate = completeDate(values.bestBeforeDate);
  if (bestBeforeDate === '') issues.bestBeforeDate = required;
  else if (productionDate !== '' && bestBeforeDate <= productionDate) {
    issues.bestBeforeDate = { from: 'client', id: 'output:validation.bestBeforeOrder' };
  } else if (productionDate !== '' && bestBeforeDate > addYears(productionDate, MAX_SHELF_LIFE_YEARS)) {
    issues.bestBeforeDate = between(addDays(productionDate, 1), addYears(productionDate, MAX_SHELF_LIFE_YEARS));
  }

  const temperature = i18n.parseNumber(values.temperature);
  if (values.temperature.trim() === '') issues.temperature = required;
  else if (temperature === null) issues.temperature = { from: 'client', id: 'output:validation.number', values: example(88.5) };
  else if (fractionDigits(temperature) > MAX_DECIMALS) issues.temperature = tooPrecise;
  else if (temperature < TEMPERATURE_RANGE.min || temperature > TEMPERATURE_RANGE.max) {
    issues.temperature = {
      from: 'client',
      id: 'output:validation.temperatureRange',
      values: (current) => ({
        min: current.quantity(TEMPERATURE_RANGE.min, units.temperature),
        max: current.quantity(TEMPERATURE_RANGE.max, units.temperature),
      }),
    };
  }

  if (values.notes.length > NOTES_MAX) {
    issues.notes = { from: 'client', id: 'output:validation.notesTooLong', values: (current) => ({ max: current.number(NOTES_MAX) }) };
  }

  if (Object.keys(issues).length > 0 || quantity === null || shrink === null || temperature === null) {
    return { issues, request: null };
  }
  // What goes to the API: plain JSON numbers and ISO dates, whatever the user typed.
  return {
    issues,
    request: {
      orderNo: values.orderNo,
      quantity,
      shrink,
      productionDate,
      bestBeforeDate,
      temperature,
      notes: values.notes.trim(),
    },
  };
}

/**
 * Field errors from the API land on the same fields as the form's own. With codes, they are
 * translated. An API that does not send codes yet (ASP.NET Core's default validation answer
 * is a title and an "errors" dictionary keyed by property name) still gets its own words
 * shown on the right field, marked as English.
 */
function serverIssues(problem: ProblemDetails): Issues {
  const issues: Issues = {};
  const byLowerName = new Map<string, FieldName>(FIELDS.map((name) => [name.toLowerCase(), name]));
  const fieldFor = (name: string) => byLowerName.get(name.replace(/^\$\./, '').toLowerCase());
  const ownWords = new Map<FieldName, string>();
  for (const [name, messages] of Object.entries(problem.errors ?? {})) {
    const field = fieldFor(name);
    if (field && messages[0]) ownWords.set(field, messages[0]);
  }
  for (const entry of problem.fieldErrors ?? []) {
    const field = fieldFor(entry.field);
    if (field) issues[field] = { from: 'server', code: entry.code, values: entry.values, text: ownWords.get(field) ?? '' };
  }
  for (const [field, text] of ownWords) {
    if (!issues[field]) issues[field] = { from: 'server', code: NO_CODE, values: {}, text };
  }
  return issues;
}

function isReceipt(data: unknown): data is OutputReceipt {
  if (typeof data !== 'object' || data === null) return false;
  const receipt = data as Partial<OutputReceipt>;
  return (
    typeof receipt.orderNo === 'string' &&
    typeof receipt.lotCode === 'string' &&
    typeof receipt.recordedAt === 'string' &&
    !Number.isNaN(Date.parse(receipt.recordedAt)) &&
    typeof receipt.quantity === 'object' &&
    receipt.quantity !== null &&
    typeof receipt.quantity.value === 'number' &&
    (receipt.quantity.unit === 'kilogram' || receipt.quantity.unit === 'pound')
  );
}

function IssueText({ issue }: { issue: FieldIssue }) {
  const i18n = useI18n();
  if (issue.from === 'client') return <Msg id={issue.id} values={issue.values?.(i18n)} />;
  const known = i18n.tCode(issue.code, problemValues(issue.values, i18n));
  if (known) return <span lang={known.fallback ? 'en' : undefined}>{known.text}</span>;
  return (
    <span lang="en" className="i18n-fallback">
      {issue.text || issue.code}
    </span>
  );
}

interface ControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
}

interface FieldProps {
  name: FieldName;
  label: MessageKey;
  hint?: ReactNode;
  issue?: FieldIssue;
  suffix?: string;
  narrow?: boolean;
  /** The second argument is the id of the visible label, for a control that is a group of several. */
  children: (props: ControlProps, labelId: string) => ReactNode;
}

function Field({ name, label, hint, issue, suffix, narrow, children }: FieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, issue ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div data-field={name}>
      <label id={labelId} htmlFor={id} className="mb-1 block font-medium">
        <Msg id={label} />
      </label>
      <div className={`flex items-stretch gap-2 ${narrow ? 'sm:max-w-64' : ''}`}>
        <div className="min-w-0 flex-1">{children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(issue) }, labelId)}</div>
        {suffix ? (
          <span className="inline-flex min-w-12 items-center justify-center rounded-md border border-line bg-page px-3 text-muted" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {issue ? (
        <p id={errorId} className="mt-1 flex items-start gap-1.5 text-sm font-medium text-bad" data-testid={`error-${name}`}>
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <IssueText issue={issue} />
          </span>
        </p>
      ) : null}
    </div>
  );
}

function OrderFacts({ order }: { order: Order }) {
  const i18n = useI18n();
  const facts: Array<[MessageKey, ReactNode]> = [
    ['output:order.product', order.product],
    ['output:order.lot', <span className="font-mono">{order.lotCode}</span>],
    ['output:order.line', <Msg id="common:line" values={{ number: order.line }} />],
    ['output:order.planned', i18n.quantity(order.planned.value, order.planned.unit)],
    ['output:order.produced', order.produced ? i18n.quantity(order.produced.value, order.produced.unit) : i18n.quantity(0, order.planned.unit)],
  ];
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-page p-3 text-sm sm:grid-cols-3" data-testid="order-facts">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted">
            <Msg id={label} />
          </dt>
          <dd className="text-pretty font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Outcome =
  | { kind: 'none' }
  | { kind: 'saved'; receipt: OutputReceipt }
  | { kind: 'problem'; problem: ProblemDetails }
  | { kind: 'unreadable' }
  | { kind: 'network' };

/** The translation of a problem's code, or null when the server's own words have to stand in. */
function translateProblem(problem: ProblemDetails, i18n: I18n) {
  return problem.code === NO_CODE ? null : i18n.tCode(problem.code, problemValues(problem.values, i18n));
}

function ServerMessage({ problem }: { problem: ProblemDetails }) {
  const i18n = useI18n();
  const known = translateProblem(problem, i18n);
  return (
    <div role="alert" className="rounded-lg border border-bad bg-bad-tint p-4" data-testid="server-message">
      <p className="flex items-start gap-2 font-semibold text-bad">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <Msg id="output:server.title" />
      </p>
      {known ? (
        <p className="mt-2" data-testid="server-text" lang={known.fallback ? 'en' : undefined}>
          {known.text}
        </p>
      ) : problem.detail ? (
        <>
          <p className="mt-2 text-sm text-muted">
            <Msg id="output:server.untranslated" />
          </p>
          <p className="i18n-fallback mt-1" lang="en" data-testid="server-text">
            {problem.detail}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Notice({ id, testId }: { id: MessageKey; testId: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad bg-bad-tint p-4 font-medium text-bad" data-testid={testId}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>
        <Msg id={id} />
      </span>
    </p>
  );
}

function emptyValues(today: string): FormValues {
  return { orderNo: '', quantity: '', shrink: '', productionDate: today, bestBeforeDate: '', temperature: '', notes: '' };
}

/** A number typed in one language, written the way the next one writes it: "1.250" in Portuguese is "1,250" in English. */
function rewriteNumber(text: string, from: I18n, to: I18n): string {
  if (from.formatLocale === to.formatLocale) return text;
  const value = from.parseNumber(text);
  return value === null ? text : to.number(value, Math.min(fractionDigits(value), 20));
}

// What the sample's shortcut buttons fill in. Each order trips one rule that only the server can check.
const SCENARIOS: Record<Scenario, { orderNo: string; quantity: number }> = {
  on_hold: { orderNo: 'PO-26-1185', quantity: 120.5 },
  over_planned: { orderNo: 'PO-26-1184', quantity: 500 },
  no_translation: { orderNo: 'PO-26-1187', quantity: 120.5 },
};

function OutputForm({ orders, today, units, timeZone }: { orders: Order[]; today: string; units: Units; timeZone: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const formRef = useRef<HTMLFormElement>(null);
  const showOutcome = useRef(false);
  const [values, setValues] = useState<FormValues>(() => emptyValues(today));
  const [issues, setIssues] = useState<Issues>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [busy, setBusy] = useState(false);

  // A number already typed is re-written when the language changes, so 1.250 kg in Portuguese
  // does not silently become 1.25 kg in English. (State derived from a changed prop is set
  // during render, which React re-runs before painting.)
  const [shownLocale, setShownLocale] = useState(i18n.locale);
  if (shownLocale !== i18n.locale) {
    const previous = i18nFor(shownLocale);
    setShownLocale(i18n.locale);
    setValues((current) => ({
      ...current,
      quantity: rewriteNumber(current.quantity, previous, i18n),
      shrink: rewriteNumber(current.shrink, previous, i18n),
      temperature: rewriteNumber(current.temperature, previous, i18n),
    }));
  }

  // After a shortcut button, bring the answer into view: on a phone it is below the form.
  useEffect(() => {
    if (!showOutcome.current || outcome.kind === 'none') return;
    showOutcome.current = false;
    const answer = formRef.current?.querySelector<HTMLElement>('[data-outcome]');
    if (typeof answer?.scrollIntoView === 'function') answer.scrollIntoView({ block: 'center' });
  }, [outcome]);

  const order = orders.find((candidate) => candidate.orderNo === values.orderNo);
  const quantity = i18n.parseNumber(values.quantity);
  const temperature = i18n.parseNumber(values.temperature);
  const productionDate = completeDate(values.productionDate);
  const bestBeforeDate = completeDate(values.bestBeforeDate);
  const issueCount = Object.keys(issues).length;
  // What submitting right now would find. Nothing from it is shown as an error before the user
  // submits; it only decides whether a value is repeated back as "will be recorded".
  const refused = validate(values, i18n, today, units).issues;
  const notesLeft = NOTES_MAX - values.notes.length;
  const saved = outcome.kind === 'saved';

  const firstYear = yearOf(addDays(today, -MAX_BACKDATE_DAYS));
  const productionYears = Array.from({ length: yearOf(today) - firstYear + 1 }, (_, index) => firstYear + index);
  const bestBeforeYears = Array.from({ length: MAX_SHELF_LIFE_YEARS + 1 }, (_, index) => yearOf(today) + index);

  const set = (name: FieldName) => (next: string | { target: { value: string } }) => {
    const value = typeof next === 'string' ? next : next.target.value;
    setValues((current) => ({ ...current, [name]: value }));
    setIssues((current) => {
      if (!current[name]) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
    // The last answer was about the values as they were; it goes as soon as one changes.
    setOutcome({ kind: 'none' });
    setExchange(null);
  };

  async function send(toSend: FormValues) {
    const checked = validate(toSend, i18n, today, units);
    setIssues(checked.issues);
    setOutcome({ kind: 'none' });
    setExchange(null);
    if (!checked.request) {
      const first = FIELDS.find((name) => checked.issues[name]);
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] [aria-invalid]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { data, exchange: sent } = await apiPost<unknown>('/api/output', checked.request);
      setExchange(sent);
      setOutcome(isReceipt(data) ? { kind: 'saved', receipt: data } : { kind: 'unreadable' });
    } catch (error) {
      if (error instanceof ApiProblem) {
        const { problem } = error;
        setExchange(error.exchange);
        setOutcome({ kind: 'problem', problem });
        // A code this client cannot put into words goes on the Translation status page.
        if (problem.code !== NO_CODE && !translateProblem(problem, i18n)) recordUnknownCode(problem.code, problem.detail);
        setIssues(serverIssues(problem));
      } else {
        setOutcome({ kind: 'network' });
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && !saved) void send(values);
  }

  function runScenario(name: Scenario) {
    const scenario = SCENARIOS[name];
    const filled: FormValues = {
      orderNo: scenario.orderNo,
      quantity: i18n.number(scenario.quantity),
      shrink: i18n.number(2.5),
      productionDate: today,
      bestBeforeDate: addDays(today, 60),
      temperature: i18n.number(88.5),
      notes: '',
    };
    setValues(filled);
    showOutcome.current = true;
    void send(filled);
  }

  function startAgain() {
    setValues(emptyValues(today));
    setIssues({});
    setOutcome({ kind: 'none' });
    setExchange(null);
    formRef.current?.querySelector<HTMLElement>('[name="orderNo"]')?.focus();
  }

  const wire: WireResult | null =
    outcome.kind === 'saved'
      ? { kind: 'saved', quantity: outcome.receipt.quantity.value }
      : outcome.kind === 'problem'
        ? { kind: 'problem', code: outcome.problem.code, translated: translateProblem(outcome.problem, i18n) !== null }
        : null;

  return (
    <>
      <ServerRuleShortcuts onRun={runScenario} disabled={busy} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <form ref={formRef} noValidate onSubmit={submit} className="space-y-5 rounded-lg border border-line bg-white p-4">
          <Field name="orderNo" label="output:field.order" issue={issues.orderNo}>
            {(props) => (
              <>
                <select {...props} name="orderNo" className="control" value={values.orderNo} onChange={set('orderNo')}>
                  <option value="">{t('output:field.orderPlaceholder')}</option>
                  {orders.map((candidate) => (
                    <option key={candidate.orderNo} value={candidate.orderNo}>
                      {`${candidate.orderNo} · ${candidate.product}`}
                    </option>
                  ))}
                </select>
                {order ? <OrderFacts order={order} /> : null}
              </>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              name="quantity"
              label="output:field.quantity"
              suffix={i18n.unit(units.mass)}
              issue={issues.quantity}
              hint={
                issues.quantity ? undefined : quantity !== null && !refused.quantity ? (
                  <span data-testid="reads-quantity">
                    <Msg id="output:reads" values={{ value: exact(quantity, units.mass, i18n) }} />
                  </span>
                ) : (
                  <Msg id="output:field.quantityHint" values={{ example: i18n.number(1250.5) }} />
                )
              }
            >
              {(props) => (
                <input {...props} name="quantity" inputMode="decimal" autoComplete="off" className="control tabular-nums" value={values.quantity} onChange={set('quantity')} />
              )}
            </Field>
            <Field name="shrink" label="output:field.shrink" suffix={i18n.unit(units.mass)} issue={issues.shrink} hint={<Msg id="output:field.shrinkHint" />}>
              {(props) => (
                <input {...props} name="shrink" inputMode="decimal" autoComplete="off" className="control tabular-nums" value={values.shrink} onChange={set('shrink')} />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:max-w-sm">
            <Field
              name="productionDate"
              label="output:field.productionDate"
              issue={issues.productionDate}
              hint={
                productionDate && !issues.productionDate && !refused.productionDate ? (
                  <span data-testid="reads-production-date">
                    <Msg id="output:reads" values={{ value: i18n.date(productionDate) }} />
                  </span>
                ) : undefined
              }
            >
              {(props, labelId) => (
                <DateField {...props} labelledBy={labelId} name="productionDate" years={productionYears} value={values.productionDate} onChange={set('productionDate')} />
              )}
            </Field>
            <Field
              name="bestBeforeDate"
              label="output:field.bestBefore"
              issue={issues.bestBeforeDate}
              hint={
                bestBeforeDate && !issues.bestBeforeDate && !refused.bestBeforeDate ? (
                  <span data-testid="reads-best-before">
                    <Msg id="output:reads" values={{ value: i18n.date(bestBeforeDate) }} />
                  </span>
                ) : undefined
              }
            >
              {(props, labelId) => (
                <DateField {...props} labelledBy={labelId} name="bestBeforeDate" years={bestBeforeYears} value={values.bestBeforeDate} onChange={set('bestBeforeDate')} />
              )}
            </Field>
          </div>

          <Field
            name="temperature"
            label="output:field.temperature"
            suffix={i18n.unit(units.temperature)}
            narrow
            issue={issues.temperature}
            hint={
              issues.temperature ? undefined : temperature !== null && !refused.temperature ? (
                <span data-testid="reads-temperature">
                  <Msg id="output:reads" values={{ value: exact(temperature, units.temperature, i18n) }} />
                </span>
              ) : (
                <Msg id="output:field.temperatureHint" />
              )
            }
          >
            {(props) => (
              <input {...props} name="temperature" inputMode="decimal" autoComplete="off" className="control tabular-nums" value={values.temperature} onChange={set('temperature')} />
            )}
          </Field>

          <Field
            name="notes"
            label="output:field.notes"
            issue={issues.notes}
            hint={
              <>
                <Msg id="output:field.notesHint" /> <Msg id="output:field.notesLeft" values={{ count: Math.max(notesLeft, 0) }} />
              </>
            }
          >
            {(props) => <textarea {...props} name="notes" rows={3} className="control" value={values.notes} onChange={set('notes')} />}
          </Field>

          {issueCount > 0 ? (
            <p role="alert" className="flex items-start gap-2 font-medium text-bad" data-testid="validation-summary">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <Msg id="output:validation.summary" values={{ count: issueCount }} />
            </p>
          ) : null}

          <div data-outcome={outcome.kind === 'none' ? undefined : outcome.kind} className="empty:hidden">
            {outcome.kind === 'problem' ? <ServerMessage problem={outcome.problem} /> : null}
            {outcome.kind === 'network' ? <Notice id="output:server.network" testId="network-error" /> : null}
            {outcome.kind === 'unreadable' ? <Notice id="output:server.unexpected" testId="unreadable-answer" /> : null}
            {outcome.kind === 'saved' ? (
              <div role="status" className="rounded-lg border border-ok bg-ok-tint p-4" data-testid="success">
                <p className="flex items-start gap-2 font-semibold text-ok">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                  <Msg id="output:success.title" />
                </p>
                <p className="mt-2" data-testid="success-body">
                  <Msg
                    id="output:success.body"
                    values={{ quantity: exact(outcome.receipt.quantity.value, outcome.receipt.quantity.unit, i18n) }}
                    nodes={{
                      order: <span className="font-mono">{outcome.receipt.orderNo}</span>,
                      lot: <span className="font-mono">{outcome.receipt.lotCode}</span>,
                    }}
                  />
                </p>
                <p className="mt-1 text-sm text-muted" data-testid="success-time">
                  <Msg id="output:success.time" values={{ dateTime: i18n.dateTime(outcome.receipt.recordedAt, timeZone) }} />
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {saved ? (
              // The record is in. Sending the same values again would be a second record, so the next step is a fresh form.
              <Button type="button" onClick={startAgain}>
                <Msg id="output:success.again" />
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                <Msg id={busy ? 'output:submitting' : 'output:submit'} />
              </Button>
            )}
          </div>
        </form>

        <ServerExchange exchange={exchange} result={wire} />
      </div>
    </>
  );
}

export default function RecordOutput() {
  const { t } = useI18n();
  usePageTitle(t('output:title'));
  const { plant, error: plantError, reload: reloadPlant } = usePlantState();
  const { data, error, reload } = useApi<OrdersResponse>('/api/orders');
  const open = (data?.orders ?? []).filter((order) => order.lotCode && (order.status === 'in_progress' || order.status === 'on_hold'));
  // The form needs the orders and the plant's settings (units, time zone, today). Either can fail, and either can be retried.
  const failed = error ?? plantError;
  const retry = () => {
    if (error) reload();
    if (plantError) reloadPlant();
  };

  return (
    <>
      <PageHeader title={<Msg id="output:title" />}>
        <Msg id="output:intro" />
      </PageHeader>
      {failed ? <LoadError error={failed} onRetry={retry} /> : null}
      {!failed && !(data && plant) ? <Loading shape="form" /> : null}
      {!failed && data && plant ? <OutputForm orders={open} today={plant.today} units={plant.units} timeZone={plant.timeZone} /> : null}
    </>
  );
}
