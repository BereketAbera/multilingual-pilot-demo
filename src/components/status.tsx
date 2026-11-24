import { CalendarClock, Check, CircleCheck, CirclePause, CirclePlay, Hourglass, X } from 'lucide-react';
import { Msg, type MessageKey } from '../i18n';
import type { LotStatus, OrderStatus } from '../lib/api';
import { Chip, type Tone } from './ui';

// Order and lot statuses are separate messages on purpose: in Portuguese and Spanish the
// word agrees with the noun ("ordem retida", "lote retido"), so one shared string would be wrong.

const ORDER_STATUS: Record<OrderStatus, { key: MessageKey; tone: Tone; Icon: typeof Check }> = {
  planned: { key: 'common:orderStatus.planned', tone: 'neutral', Icon: CalendarClock },
  in_progress: { key: 'common:orderStatus.in_progress', tone: 'info', Icon: CirclePlay },
  completed: { key: 'common:orderStatus.completed', tone: 'neutral', Icon: Check },
  on_hold: { key: 'common:orderStatus.on_hold', tone: 'hold', Icon: CirclePause },
};

const LOT_STATUS: Record<LotStatus, { key: MessageKey; tone: Tone; Icon: typeof Check }> = {
  quarantine: { key: 'common:lotStatus.quarantine', tone: 'neutral', Icon: Hourglass },
  released: { key: 'common:lotStatus.released', tone: 'ok', Icon: CircleCheck },
  on_hold: { key: 'common:lotStatus.on_hold', tone: 'hold', Icon: CirclePause },
};

export const ORDER_STATUS_KEYS: Record<OrderStatus, MessageKey> = {
  planned: ORDER_STATUS.planned.key,
  in_progress: ORDER_STATUS.in_progress.key,
  completed: ORDER_STATUS.completed.key,
  on_hold: ORDER_STATUS.on_hold.key,
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const { key, tone, Icon } = ORDER_STATUS[status];
  return (
    <Chip tone={tone} icon={<Icon aria-hidden="true" className="size-4 shrink-0" />}>
      <Msg id={key} />
    </Chip>
  );
}

export function LotStatusChip({ status }: { status: LotStatus }) {
  const { key, tone, Icon } = LOT_STATUS[status];
  return (
    <Chip tone={tone} icon={<Icon aria-hidden="true" className="size-4 shrink-0" />}>
      <Msg id={key} />
    </Chip>
  );
}

export function ResultChip({ result }: { result: 'pass' | 'fail' }) {
  return result === 'pass' ? (
    <Chip tone="ok" icon={<Check aria-hidden="true" className="size-4 shrink-0" />}>
      <Msg id="common:result.pass" />
    </Chip>
  ) : (
    <Chip tone="bad" icon={<X aria-hidden="true" className="size-4 shrink-0" />}>
      <Msg id="common:result.fail" />
    </Chip>
  );
}
