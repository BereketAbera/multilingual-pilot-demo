import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { OrderStatusChip, ORDER_STATUS_KEYS } from '../../components/status';
import { Button, LoadError, Loading, NoValue, PageHeader, ScrollArea } from '../../components/ui';
import { Msg, useI18n, type MessageKey } from '../../i18n';
import type { Order, OrderStatus, OrdersResponse } from '../../lib/api';
import { usePlant } from '../../lib/plant';
import { useApi } from '../../lib/useApi';
import { ROOM_FOR_A_WIDE_TABLE, useMediaQuery } from '../../lib/useMediaQuery';
import { usePageTitle } from '../../lib/usePageTitle';

const STATUSES: OrderStatus[] = ['planned', 'in_progress', 'completed', 'on_hold'];

function LotLink({ code }: { code: string }) {
  return (
    <Link className="text-action underline underline-offset-2" to={`/lots/${code}`}>
      <Msg id="lot:heading" nodes={{ code: <span className="font-mono">{code}</span> }} />
    </Link>
  );
}

/**
 * Where there is room for all eight columns: a table. Translated labels run a third longer
 * than English, so the product is the one column allowed to wrap, to two lines at most, and
 * the lot sits under the order number instead of in a column of its own.
 */
function OrdersTable({ orders, today }: { orders: Order[]; today: string | undefined }) {
  const i18n = useI18n();
  return (
    <ScrollArea className="border-t border-line" label={i18n.t('orders:title')}>
      <table className="w-full min-w-[54rem] border-collapse" data-testid="orders-table">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="th"><Msg id="orders:col.order" /></th>
            <th scope="col" className="th"><Msg id="orders:col.product" /></th>
            <th scope="col" className="th"><Msg id="orders:col.line" /></th>
            <th scope="col" className="th text-right"><Msg id="orders:col.planned" /></th>
            <th scope="col" className="th text-right"><Msg id="orders:col.produced" /></th>
            <th scope="col" className="th text-right"><Msg id="orders:col.yield" /></th>
            <th scope="col" className="th"><Msg id="orders:col.status" /></th>
            <th scope="col" className="th"><Msg id="orders:col.start" /></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderNo} className="border-b border-line last:border-b-0" data-testid={`order-${order.orderNo}`}>
              <th scope="row" className="td whitespace-nowrap text-left font-normal">
                <span className="block font-mono font-medium">{order.orderNo}</span>
                <span className="block text-sm">{order.lotCode ? <LotLink code={order.lotCode} /> : <NoValue />}</span>
              </th>
              <td className="td min-w-52 text-pretty">{order.product}</td>
              <td className="td whitespace-nowrap"><Msg id="common:line" values={{ number: order.line }} /></td>
              <td className="td num">{i18n.quantity(order.planned.value, order.planned.unit)}</td>
              <td className="td num" data-testid="produced">
                {order.produced ? i18n.quantity(order.produced.value, order.produced.unit) : <NoValue />}
              </td>
              <td className="td num">{order.yield === null ? <NoValue /> : i18n.percent(order.yield)}</td>
              <td className="td"><OrderStatusChip status={order.status} /></td>
              <td className="td whitespace-nowrap">
                {/* The year is left out while it is this year's; the full date is one hover or one screen away. */}
                <time dateTime={order.startDate} title={i18n.date(order.startDate)} data-testid="start">
                  {i18n.dateInYear(order.startDate, today)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function OrderCard({ order }: { order: Order }) {
  const i18n = useI18n();
  const facts: Array<[label: MessageKey, value: ReactNode, testId?: string]> = [
    ['orders:col.start', <time dateTime={order.startDate}>{i18n.date(order.startDate)}</time>, 'start'],
    ['orders:col.line', <Msg id="common:line" values={{ number: order.line }} />],
    ['orders:col.planned', i18n.quantity(order.planned.value, order.planned.unit)],
    ['orders:col.produced', order.produced ? i18n.quantity(order.produced.value, order.produced.unit) : <NoValue />, 'produced'],
    ['orders:col.yield', order.yield === null ? <NoValue /> : i18n.percent(order.yield)],
  ];
  return (
    <li className="rounded-lg border border-line p-4" data-testid={`order-${order.orderNo}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="font-mono font-medium">{order.orderNo}</span>
        <OrderStatusChip status={order.status} />
      </div>
      <p className="mt-1 text-pretty font-medium">{order.product}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {facts.map(([label, value, testId]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted">
              <Msg id={label} />
            </dt>
            <dd className="tabular-nums" data-testid={testId}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {order.lotCode ? (
        <p className="mt-3 text-sm">
          <LotLink code={order.lotCode} />
        </p>
      ) : null}
    </li>
  );
}

/** Where the table would not fit: one card per order, so the status and the date are never off to the side. */
function OrderCards({ orders }: { orders: Order[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 border-t border-line p-4 @2xl:grid-cols-2" data-testid="order-cards">
      {orders.map((order) => (
        <OrderCard key={order.orderNo} order={order} />
      ))}
    </ul>
  );
}

export default function Orders() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t('orders:title'));
  const { data, error, loading, reload } = useApi<OrdersResponse>('/api/orders');
  const plant = usePlant();
  const wide = useMediaQuery(ROOM_FOR_A_WIDE_TABLE);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [line, setLine] = useState('all');

  const lines = useMemo(() => [...new Set((data?.orders ?? []).map((order) => order.line))].sort((a, b) => a - b), [data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.orders ?? []).filter(
      (order) =>
        (status === 'all' || order.status === status) &&
        (line === 'all' || String(order.line) === line) &&
        (needle === '' || order.orderNo.toLowerCase().includes(needle) || order.product.toLowerCase().includes(needle)),
    );
  }, [data, search, status, line]);
  const onHold = filtered.filter((order) => order.status === 'on_hold').length;
  const filtersActive = search !== '' || status !== 'all' || line !== 'all';

  return (
    <>
      <PageHeader title={<Msg id="orders:title" />}>
        <Msg id="orders:intro" />
        {data ? (
          <>
            {' '}
            <span data-testid="orders-updated">
              <Msg id="orders:updated" values={{ when: i18n.relativeTime(data.updatedAt) }} />
            </span>
          </>
        ) : null}
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={reload} /> : null}
      {data ? (
        <div className="@container rounded-lg border border-line bg-white">
          <fieldset className="grid min-w-0 grid-cols-1 gap-3 border-b border-line p-4 @xl:grid-cols-2 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <legend className="sr-only">
              <Msg id="orders:filter.legend" />
            </legend>
            <div>
              <label htmlFor="orders-search" className="mb-1 block text-sm font-medium">
                <Msg id="orders:filter.search" />
              </label>
              <input
                id="orders-search"
                type="search"
                className="control"
                value={search}
                placeholder={t('orders:filter.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="orders-status" className="mb-1 block text-sm font-medium">
                <Msg id="orders:filter.status" />
              </label>
              <select
                id="orders-status"
                className="control"
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus | 'all')}
              >
                <option value="all">{t('orders:filter.statusAll')}</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(ORDER_STATUS_KEYS[value])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="orders-line" className="mb-1 block text-sm font-medium">
                <Msg id="orders:filter.line" />
              </label>
              <select id="orders-line" className="control" value={line} onChange={(event) => setLine(event.target.value)}>
                <option value="all">{t('orders:filter.lineAll')}</option>
                {lines.map((value) => (
                  <option key={value} value={String(value)}>
                    {t('common:line', { number: value })}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              disabled={!filtersActive}
              className="self-end"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setLine('all');
              }}
            >
              <Msg id="orders:filter.clear" />
            </Button>
          </fieldset>

          <div role="status" className="px-4 py-3 text-sm text-muted" data-testid="orders-summary">
            <p className="flex flex-wrap gap-x-2">
              <span className="font-medium text-ink">
                <Msg id="orders:summary.count" values={{ count: filtered.length }} />
              </span>
              {filtered.length > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    <Msg id="orders:summary.onHold" values={{ count: onHold }} />
                  </span>
                </>
              ) : null}
            </p>
            {filtered.length === 0 ? (
              <p className="mt-1">
                <Msg id="orders:empty.hint" />
              </p>
            ) : null}
          </div>

          {filtered.length === 0 ? null : wide ? <OrdersTable orders={filtered} today={plant?.today} /> : <OrderCards orders={filtered} />}
        </div>
      ) : null}
    </>
  );
}
