import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LotStatusChip, ResultChip } from '../../components/status';
import { LoadError, Loading, NoValue, PageHeader, Panel } from '../../components/ui';
import { Msg, useI18n, type I18n, type MessageKey } from '../../i18n';
import type { CheckCode, HaccpCheck, Lot as LotData, LotEvent, LotEventType, LotSummary } from '../../lib/api';
import { usePlant } from '../../lib/plant';
import { useApi } from '../../lib/useApi';
import { usePageTitle } from '../../lib/usePageTitle';

export const DEFAULT_LOT = 'CF-26-0412';

// Codes from the API are mapped to messages one by one, so every key can be found by a text search.
const CHECK_KEYS: Record<CheckCode, MessageKey> = {
  cook_temperature: 'lot:haccp.check.cook_temperature',
  cooling: 'lot:haccp.check.cooling',
  metal_detection: 'lot:haccp.check.metal_detection',
};

const EVENT_KEYS: Record<LotEventType, MessageKey> = {
  lot_created: 'lot:event.lot_created',
  output_recorded: 'lot:event.output_recorded',
  qc_sample_taken: 'lot:event.qc_sample_taken',
  hold_placed: 'lot:event.hold_placed',
  released: 'lot:event.released',
  shipment_dispatched: 'lot:event.shipment_dispatched',
};

function limitText(check: HaccpCheck, i18n: I18n) {
  if (check.limit.kind === 'none_detected') return <Msg id="lot:haccp.limit.none_detected" />;
  const value = i18n.quantity(check.limit.quantity.value, check.limit.quantity.unit);
  return <Msg id={check.limit.kind === 'min' ? 'lot:haccp.limit.min' : 'lot:haccp.limit.max'} values={{ value }} />;
}

function readingText(check: HaccpCheck, i18n: I18n) {
  if ('detected' in check.reading) {
    return <Msg id={check.reading.detected ? 'lot:haccp.reading.detected' : 'lot:haccp.reading.none_detected'} />;
  }
  return i18n.quantity(check.reading.quantity.value, check.reading.quantity.unit);
}

function eventValues(event: LotEvent, i18n: I18n) {
  return {
    order: event.orderNo ?? '',
    shipment: event.shipmentNo ?? '',
    quantity: event.quantity ? i18n.quantity(event.quantity.value, event.quantity.unit) : '',
  };
}

function Fact({ label, children, testId }: { label: MessageKey; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">
        <Msg id={label} />
      </dt>
      <dd className="mt-0.5 font-medium" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

function LotDetail({ lot }: { lot: LotData }) {
  const i18n = useI18n();
  const plant = usePlant();
  const failed = lot.checks.filter((check) => check.result === 'fail').length;
  const zone = plant?.timeZone;

  return (
    <div className="space-y-5">
      <section aria-labelledby="lot-heading" className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="lot-heading" className="text-xl">
            <Msg id="lot:heading" nodes={{ code: <span className="font-mono">{lot.code}</span> }} />
          </h2>
          <LotStatusChip status={lot.status} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
          <Fact label="lot:summary.product">{lot.product}</Fact>
          <Fact label="lot:summary.order">
            <span className="font-mono">{lot.orderNo}</span>
          </Fact>
          <Fact label="lot:summary.line">
            <Msg id="common:line" values={{ number: lot.line }} />
          </Fact>
          <Fact label="lot:summary.quantity" testId="lot-quantity">
            {i18n.quantity(lot.quantity.value, lot.quantity.unit)}
          </Fact>
          <Fact label="lot:summary.produced" testId="lot-produced">
            {i18n.date(lot.producedDate)}
          </Fact>
          <Fact label="lot:summary.bestBefore" testId="lot-best-before">
            {i18n.date(lot.bestBeforeDate)}
            <span className="block text-sm font-normal text-muted">{i18n.relativeDays(lot.bestBeforeDate, lot.today)}</span>
          </Fact>
          <Fact label="lot:summary.yield">{lot.yield === null ? <NoValue /> : i18n.percent(lot.yield)}</Fact>
          <Fact label="lot:summary.shrink">{lot.shrink === null ? <NoValue /> : i18n.percent(lot.shrink)}</Fact>
        </dl>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel
          id="trace-back"
          title={<Msg id="lot:trace.back.title" />}
          aside={<Msg id="lot:trace.back.count" values={{ count: lot.traceBack.length }} />}
        >
          <p className="px-4 pt-3 text-sm text-muted">
            <Msg id="lot:trace.back.hint" />
          </p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="trace-back">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="th"><Msg id="lot:trace.back.col.ingredient" /></th>
                  <th scope="col" className="th"><Msg id="lot:trace.back.col.lot" /></th>
                  <th scope="col" className="th"><Msg id="lot:trace.back.col.supplier" /></th>
                  <th scope="col" className="th"><Msg id="lot:trace.back.col.received" /></th>
                  <th scope="col" className="th text-right"><Msg id="lot:trace.back.col.used" /></th>
                </tr>
              </thead>
              <tbody>
                {lot.traceBack.map((row) => (
                  <tr key={row.supplierLot} className="border-b border-line last:border-b-0">
                    <th scope="row" className="td text-left font-medium">{row.ingredient}</th>
                    <td className="td whitespace-nowrap font-mono">{row.supplierLot}</td>
                    <td className="td">{row.supplier}</td>
                    <td className="td whitespace-nowrap">{i18n.date(row.receivedDate)}</td>
                    <td className="td num">{i18n.quantity(row.used.value, row.used.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          id="trace-forward"
          title={<Msg id="lot:trace.forward.title" />}
          aside={
            <span data-testid="shipment-count">
              <Msg id="lot:trace.forward.count" values={{ count: lot.traceForward.length }} />
            </span>
          }
        >
          {lot.traceForward.length === 0 ? (
            <p className="px-4 py-4 text-muted">
              <Msg id={lot.status === 'on_hold' ? 'lot:trace.forward.empty.on_hold' : 'lot:trace.forward.empty.quarantine'} />
            </p>
          ) : (
            <>
              <p className="px-4 pt-3 text-sm text-muted">
                <Msg id="lot:trace.forward.hint" />
              </p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="trace-forward">
                <table className="w-full min-w-[30rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="th"><Msg id="lot:trace.forward.col.shipment" /></th>
                      <th scope="col" className="th"><Msg id="lot:trace.forward.col.customer" /></th>
                      <th scope="col" className="th"><Msg id="lot:trace.forward.col.shipped" /></th>
                      <th scope="col" className="th text-right"><Msg id="lot:trace.forward.col.quantity" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lot.traceForward.map((row) => (
                      <tr key={row.shipmentNo} className="border-b border-line last:border-b-0">
                        <th scope="row" className="td whitespace-nowrap text-left font-mono font-medium">{row.shipmentNo}</th>
                        <td className="td">{row.customer}</td>
                        <td className="td whitespace-nowrap">{i18n.date(row.shippedDate)}</td>
                        <td className="td num">{i18n.quantity(row.quantity.value, row.quantity.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Panel
        id="haccp"
        title={<Msg id="lot:haccp.title" />}
        aside={
          <span data-testid="haccp-summary" className={failed > 0 ? 'font-medium text-bad' : undefined}>
            <Msg id="lot:haccp.failed" values={{ count: failed }} />
          </span>
        }
      >
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="haccp">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="th"><Msg id="lot:haccp.col.check" /></th>
                <th scope="col" className="th"><Msg id="lot:haccp.col.limit" /></th>
                <th scope="col" className="th"><Msg id="lot:haccp.col.reading" /></th>
                <th scope="col" className="th"><Msg id="lot:haccp.col.result" /></th>
                <th scope="col" className="th"><Msg id="lot:haccp.col.checked" /></th>
              </tr>
            </thead>
            <tbody>
              {lot.checks.map((check) => (
                <tr key={check.check} className="border-b border-line last:border-b-0">
                  <th scope="row" className="td text-left font-medium">
                    <Msg id={CHECK_KEYS[check.check]} />
                    {check.correctiveAction ? (
                      <span className="mt-1 block text-sm font-normal text-muted">
                        <span className="font-medium text-ink">
                          <Msg id="lot:haccp.action.label" />
                        </span>
                        {': '}
                        <Msg id="lot:haccp.action.hold_and_reinspect" />
                      </span>
                    ) : null}
                  </th>
                  <td className="td">{limitText(check, i18n)}</td>
                  <td className="td whitespace-nowrap tabular-nums">{readingText(check, i18n)}</td>
                  <td className="td"><ResultChip result={check.result} /></td>
                  <td className="td whitespace-nowrap">{i18n.dateTime(check.checkedAt, zone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel id="events" title={<Msg id="lot:events.title" />}>
        <ol className="divide-y divide-line">
          {lot.events.map((event) => (
            <li key={`${event.type}-${event.at}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
              <span>
                <Msg id={EVENT_KEYS[event.type]} values={eventValues(event, i18n)} />
              </span>
              <time dateTime={event.at} title={i18n.dateTime(event.at, zone)} className="text-sm text-muted" data-testid="event-time">
                {i18n.relativeTime(event.at)}
              </time>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

export default function Lot() {
  const { t } = useI18n();
  usePageTitle(t('lot:title'));
  const params = useParams();
  const navigate = useNavigate();
  const code = params.code ?? DEFAULT_LOT;
  const list = useApi<{ lots: LotSummary[] }>('/api/lots');
  const { data, error, loading, reload } = useApi<LotData>(`/api/lots/${encodeURIComponent(code)}`);

  return (
    <>
      <PageHeader title={<Msg id="lot:title" />} />
      <div className="mb-5 max-w-xl">
        <label htmlFor="lot-picker" className="mb-1 block text-sm font-medium">
          <Msg id="lot:picker.label" />
        </label>
        <select
          id="lot-picker"
          className="control"
          value={list.data?.lots.some((lot) => lot.code === code) ? code : ''}
          onChange={(event) => void navigate(`/lots/${event.target.value}`)}
        >
          {list.data?.lots.some((lot) => lot.code === code) ? null : <option value="">{code}</option>}
          {(list.data?.lots ?? []).map((lot) => (
            <option key={lot.code} value={lot.code}>
              {`${lot.code} · ${lot.product}`}
            </option>
          ))}
        </select>
      </div>
      {loading ? <Loading /> : null}
      {error ? (
        <div className="space-y-3">
          <LoadError error={error} onRetry={reload} />
          <Link className="text-action underline underline-offset-2" to={`/lots/${DEFAULT_LOT}`}>
            <span className="font-mono">{DEFAULT_LOT}</span>
          </Link>
        </div>
      ) : null}
      {data ? <LotDetail lot={data} /> : null}
    </>
  );
}
