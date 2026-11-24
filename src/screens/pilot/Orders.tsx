import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { OrderStatusChip, ORDER_STATUS_KEYS } from '../../components/status';
import { Button, LoadError, Loading, NoValue, PageHeader } from '../../components/ui';
import { Msg, useI18n } from '../../i18n';
import type { OrderStatus, OrdersResponse } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { usePageTitle } from '../../lib/usePageTitle';

const STATUSES: OrderStatus[] = ['planned', 'in_progress', 'completed', 'on_hold'];

export default function Orders() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t('orders:title'));
  const { data, error, loading, reload } = useApi<OrdersResponse>('/api/orders');
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
        <div className="rounded-lg border border-line bg-white">
          <fieldset className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
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
              className="disabled:text-muted"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setLine('all');
              }}
            >
              <Msg id="orders:filter.clear" />
            </Button>
          </fieldset>

          <p role="status" className="flex flex-wrap gap-x-2 px-4 py-3 text-sm text-muted" data-testid="orders-summary">
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
            ) : (
              <span>
                <Msg id="orders:empty.hint" />
              </span>
            )}
          </p>

          {filtered.length > 0 ? (
            <div className="overflow-x-auto border-t border-line" tabIndex={0} role="region" aria-label={t('orders:title')}>
              <table className="w-full min-w-[56rem] border-collapse">
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
                    <th scope="col" className="th"><Msg id="orders:col.lot" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.orderNo} className="border-b border-line last:border-b-0" data-testid={`order-${order.orderNo}`}>
                      <th scope="row" className="td whitespace-nowrap text-left font-mono font-medium">{order.orderNo}</th>
                      <td className="td text-pretty">{order.product}</td>
                      <td className="td whitespace-nowrap"><Msg id="common:line" values={{ number: order.line }} /></td>
                      <td className="td num">{i18n.quantity(order.planned.value, order.planned.unit)}</td>
                      <td className="td num" data-testid="produced">
                        {order.produced ? i18n.quantity(order.produced.value, order.produced.unit) : <NoValue />}
                      </td>
                      <td className="td num">{order.yield === null ? <NoValue /> : i18n.percent(order.yield)}</td>
                      <td className="td"><OrderStatusChip status={order.status} /></td>
                      <td className="td whitespace-nowrap" data-testid="start">{i18n.date(order.startDate)}</td>
                      <td className="td whitespace-nowrap font-mono">
                        {order.lotCode ? (
                          <Link className="text-action underline underline-offset-2" to={`/lots/${order.lotCode}`}>
                            {order.lotCode}
                          </Link>
                        ) : (
                          <NoValue />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
