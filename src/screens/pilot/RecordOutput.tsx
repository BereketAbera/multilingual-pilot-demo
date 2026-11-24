import { CircleAlert, CircleCheck } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ServerExchange, type WireResult } from '../../components/sample/ServerExchange';
import { Button, LoadError, Loading, PageHeader } from '../../components/ui';
import { Msg, useI18n, type I18n, type MessageKey, type MessageValues } from '../../i18n';
import {
  ApiProblem,
  apiPost,
  type Exchange,
  type Order,
  type OrdersResponse,
  type OutputReceipt,
  type OutputRequest,
  type ProblemDetails,
} from '../../lib/api';
import { usePlant } from '../../lib/plant';
import { problemValues } from '../../lib/problemValues';
import { recordUnknownCode } from '../../lib/unknownCodes';
import { useApi } from '../../lib/useApi';
import { usePageTitle } from '../../lib/usePageTitle';

const FIELDS = ['orderNo', 'quantity', 'shrink', 'productionDate', 'bestBeforeDate', 'temperature', 'notes'] as const;
type FieldName = (typeof FIELDS)[number];
type FormValues = Record<FieldName, string>;

const NOTES_MAX = 280;
const TEMPERATURE_RANGE = { min: 0, max: 150 };

/** An error is stored as a key and raw values, so it re-renders correctly when the language changes. */
type FieldIssue =
  | { from: 'client'; id: MessageKey; values?: (i18n: I18n) => MessageValues }
  | { from: 'server'; code: string; values: (i18n: I18n) => MessageValues };

type Issues = Partial<Record<FieldName, FieldIssue>>;

function validate(values: FormValues, i18n: I18n, today: string): { issues: Issues; request: OutputRequest | null } {
  const issues: Issues = {};
  const example = (sample: number) => (current: I18n) => ({ example: current.number(sample) });
  const required: FieldIssue = { from: 'client', id: 'output:validation.required' };

  if (values.orderNo === '') issues.orderNo = required;

  const quantity = i18n.parseNumber(values.quantity);
  if (values.quantity.trim() === '') issues.quantity = required;
  else if (quantity === null) issues.quantity = { from: 'client', id: 'output:validation.number', values: example(1250.5) };
  else if (quantity <= 0) issues.quantity = { from: 'client', id: 'output:validation.positive' };

  const shrink = values.shrink.trim() === '' ? 0 : i18n.parseNumber(values.shrink);
  if (shrink === null || shrink < 0) issues.shrink = { from: 'client', id: 'output:validation.number', values: example(12.5) };
  else if (quantity !== null && quantity > 0 && shrink > quantity) issues.shrink = { from: 'client', id: 'output:validation.shrinkTooHigh' };

  if (values.productionDate === '') issues.productionDate = required;
  else if (values.productionDate > today) issues.productionDate = { from: 'client', id: 'output:validation.dateFuture' };

  if (values.bestBeforeDate === '') issues.bestBeforeDate = required;
  else if (values.productionDate !== '' && values.bestBeforeDate <= values.productionDate) {
    issues.bestBeforeDate = { from: 'client', id: 'output:validation.bestBeforeOrder' };
  }

  const temperature = i18n.parseNumber(values.temperature);
  if (values.temperature.trim() === '') issues.temperature = required;
  else if (temperature === null) issues.temperature = { from: 'client', id: 'output:validation.number', values: example(88.5) };
  else if (temperature < TEMPERATURE_RANGE.min || temperature > TEMPERATURE_RANGE.max) {
    issues.temperature = {
      from: 'client',
      id: 'output:validation.temperatureRange',
      values: (current) => ({
        min: current.quantity(TEMPERATURE_RANGE.min, 'celsius'),
        max: current.quantity(TEMPERATURE_RANGE.max, 'celsius'),
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
      productionDate: values.productionDate,
      bestBeforeDate: values.bestBeforeDate,
      temperature,
      notes: values.notes.trim(),
    },
  };
}

function IssueText({ issue }: { issue: FieldIssue }) {
  const i18n = useI18n();
  if (issue.from === 'client') return <Msg id={issue.id} values={issue.values?.(i18n)} />;
  const known = i18n.tCode(issue.code, issue.values(i18n));
  return <>{known ? known.text : issue.code}</>;
}

interface FieldProps {
  name: FieldName;
  label: MessageKey;
  hint?: ReactNode;
  issue?: FieldIssue;
  suffix?: string;
  narrow?: boolean;
  children: (props: { id: string; 'aria-describedby': string | undefined; 'aria-invalid': boolean }) => ReactNode;
}

function Field({ name, label, hint, issue, suffix, narrow, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, issue ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div data-field={name}>
      <label htmlFor={id} className="mb-1 block font-medium">
        <Msg id={label} />
      </label>
      <div className={`flex items-stretch gap-2 ${narrow ? 'sm:max-w-64' : ''}`}>
        <div className="min-w-0 flex-1">{children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(issue) })}</div>
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
  | { kind: 'network' };

function ServerMessage({ problem }: { problem: ProblemDetails }) {
  const i18n = useI18n();
  const known = i18n.tCode(problem.code, problemValues(problem.values, i18n));
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
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            <Msg id="output:server.untranslated" />
          </p>
          <p className="i18n-fallback mt-1" lang="en" data-testid="server-text">
            {problem.detail}
          </p>
        </>
      )}
    </div>
  );
}

function emptyValues(today: string): FormValues {
  return { orderNo: '', quantity: '', shrink: '', productionDate: today, bestBeforeDate: '', temperature: '', notes: '' };
}

function OutputForm({ orders, today }: { orders: Order[]; today: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const plant = usePlant();
  const massUnit = plant?.units.mass ?? 'kilogram';
  const temperatureUnit = plant?.units.temperature ?? 'celsius';
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(() => emptyValues(today));
  const [issues, setIssues] = useState<Issues>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [busy, setBusy] = useState(false);

  const order = orders.find((candidate) => candidate.orderNo === values.orderNo);
  const quantity = i18n.parseNumber(values.quantity);
  const temperature = i18n.parseNumber(values.temperature);
  const issueCount = Object.keys(issues).length;
  const notesLeft = NOTES_MAX - values.notes.length;

  const set = (name: FieldName) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setIssues((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = validate(values, i18n, today);
    setIssues(checked.issues);
    if (!checked.request) {
      setOutcome({ kind: 'none' });
      const first = FIELDS.find((name) => checked.issues[name]);
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] [aria-invalid]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { data, exchange: sent } = await apiPost<OutputReceipt>('/api/output', checked.request);
      setExchange(sent);
      setOutcome({ kind: 'saved', receipt: data });
    } catch (error) {
      if (error instanceof ApiProblem) {
        setExchange(error.exchange);
        setOutcome({ kind: 'problem', problem: error.problem });
        if (!i18n.tCode(error.problem.code)) recordUnknownCode(error.problem.code, error.problem.detail);
        // Field errors from the server arrive as codes too, and land on the same fields.
        const fromServer: Issues = {};
        for (const fieldError of error.problem.fieldErrors ?? []) {
          if ((FIELDS as readonly string[]).includes(fieldError.field)) {
            fromServer[fieldError.field as FieldName] = {
              from: 'server',
              code: fieldError.code,
              values: (current) => problemValues(fieldError.values, current),
            };
          }
        }
        setIssues(fromServer);
      } else {
        setOutcome({ kind: 'network' });
      }
    } finally {
      setBusy(false);
    }
  }

  const wire: WireResult | null =
    outcome.kind === 'saved'
      ? { kind: 'saved', quantity: outcome.receipt.quantity.value }
      : outcome.kind === 'problem'
        ? { kind: 'problem', code: outcome.problem.code, translated: i18n.tCode(outcome.problem.code) !== null }
        : null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <form ref={formRef} noValidate onSubmit={(event) => void submit(event)} className="space-y-5 rounded-lg border border-line bg-white p-4">
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
            suffix={i18n.unit(massUnit)}
            issue={issues.quantity}
            hint={
              quantity !== null && quantity > 0 ? (
                <span data-testid="reads-quantity">
                  <Msg id="output:reads" values={{ value: i18n.quantity(quantity, massUnit) }} />
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
          <Field name="shrink" label="output:field.shrink" suffix={i18n.unit(massUnit)} issue={issues.shrink} hint={<Msg id="output:field.shrinkHint" />}>
            {(props) => (
              <input {...props} name="shrink" inputMode="decimal" autoComplete="off" className="control tabular-nums" value={values.shrink} onChange={set('shrink')} />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            name="productionDate"
            label="output:field.productionDate"
            issue={issues.productionDate}
            hint={
              values.productionDate ? (
                <span data-testid="reads-production-date">
                  <Msg id="output:reads" values={{ value: i18n.date(values.productionDate) }} />
                </span>
              ) : undefined
            }
          >
            {(props) => <input {...props} name="productionDate" type="date" max={today} className="control" value={values.productionDate} onChange={set('productionDate')} />}
          </Field>
          <Field
            name="bestBeforeDate"
            label="output:field.bestBefore"
            issue={issues.bestBeforeDate}
            hint={
              values.bestBeforeDate ? (
                <span data-testid="reads-best-before">
                  <Msg id="output:reads" values={{ value: i18n.date(values.bestBeforeDate) }} />
                </span>
              ) : undefined
            }
          >
            {(props) => <input {...props} name="bestBeforeDate" type="date" className="control" value={values.bestBeforeDate} onChange={set('bestBeforeDate')} />}
          </Field>
        </div>

        <Field
          name="temperature"
          label="output:field.temperature"
          suffix={i18n.unit(temperatureUnit)}
          narrow
          issue={issues.temperature}
          hint={
            temperature !== null ? (
              <Msg id="output:reads" values={{ value: i18n.quantity(temperature, temperatureUnit) }} />
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

        {outcome.kind === 'problem' ? <ServerMessage problem={outcome.problem} /> : null}
        {outcome.kind === 'network' ? (
          <p role="alert" className="rounded-lg border border-bad bg-bad-tint p-4 font-medium text-bad">
            <Msg id="output:server.network" />
          </p>
        ) : null}
        {outcome.kind === 'saved' ? (
          <div role="status" className="rounded-lg border border-ok bg-ok-tint p-4" data-testid="success">
            <p className="flex items-start gap-2 font-semibold text-ok">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <Msg id="output:success.title" />
            </p>
            <p className="mt-2" data-testid="success-body">
              <Msg
                id="output:success.body"
                values={{ quantity: i18n.quantity(outcome.receipt.quantity.value, outcome.receipt.quantity.unit) }}
                nodes={{
                  order: <span className="font-mono">{outcome.receipt.orderNo}</span>,
                  lot: <span className="font-mono">{outcome.receipt.lotCode}</span>,
                }}
              />
            </p>
            <p className="mt-1 text-sm text-muted">
              <Msg id="output:success.time" values={{ dateTime: i18n.dateTime(outcome.receipt.recordedAt, plant?.timeZone) }} />
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            <Msg id={busy ? 'output:submitting' : 'output:submit'} />
          </Button>
          {outcome.kind === 'saved' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setValues(emptyValues(today));
                setIssues({});
                setOutcome({ kind: 'none' });
                setExchange(null);
              }}
            >
              <Msg id="output:success.again" />
            </Button>
          ) : null}
        </div>
      </form>

      <ServerExchange exchange={exchange} result={wire} />
    </div>
  );
}

export default function RecordOutput() {
  const { t } = useI18n();
  usePageTitle(t('output:title'));
  const plant = usePlant();
  const { data, error, loading, reload } = useApi<OrdersResponse>('/api/orders');
  const open = (data?.orders ?? []).filter((order) => order.lotCode && (order.status === 'in_progress' || order.status === 'on_hold'));

  return (
    <>
      <PageHeader title={<Msg id="output:title" />}>
        <Msg id="output:intro" />
      </PageHeader>
      {loading || !plant ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={reload} /> : null}
      {data && plant ? <OutputForm orders={open} today={plant.today} /> : null}
    </>
  );
}
