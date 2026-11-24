// The shapes the stand-in API sends. In the real application these come from the .NET API.

export type MassUnit = 'kilogram' | 'pound';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** A quantity always travels with its unit, so the client never guesses. */
export interface Quantity {
  value: number;
  unit: MassUnit | TemperatureUnit;
}

export interface Plant {
  company: string;
  name: string;
  timeZone: string;
  units: { mass: MassUnit; temperature: TemperatureUnit };
}

export type OrderStatus = 'planned' | 'in_progress' | 'completed' | 'on_hold';
export type LotStatus = 'quarantine' | 'released' | 'on_hold';

export interface Order {
  orderNo: string;
  product: string;
  line: number;
  planned: Quantity;
  produced: Quantity | null;
  /** Ratio, 0.966 means 96.6%. Null until the order is completed. */
  yield: number | null;
  status: OrderStatus;
  /** Plain date, YYYY-MM-DD. */
  startDate: string;
  lotCode: string | null;
}

export interface OrdersResponse {
  /** Instant, ISO 8601. */
  updatedAt: string;
  orders: Order[];
}

export interface LotSummary {
  code: string;
  product: string;
  status: LotStatus;
}

export interface TraceBackRow {
  ingredient: string;
  supplierLot: string;
  supplier: string;
  receivedDate: string;
  used: Quantity;
}

export interface TraceForwardRow {
  shipmentNo: string;
  customer: string;
  shippedDate: string;
  quantity: Quantity;
}

export type CheckCode = 'cook_temperature' | 'cooling' | 'metal_detection';

export interface HaccpCheck {
  check: CheckCode;
  limit: { kind: 'min' | 'max'; quantity: Quantity } | { kind: 'none_detected' };
  reading: { quantity: Quantity } | { detected: boolean };
  result: 'pass' | 'fail';
  checkedAt: string;
  correctiveAction: 'hold_and_reinspect' | null;
}

export type LotEventType =
  | 'lot_created'
  | 'output_recorded'
  | 'qc_sample_taken'
  | 'hold_placed'
  | 'released'
  | 'shipment_dispatched';

export interface LotEvent {
  type: LotEventType;
  at: string;
  orderNo?: string;
  shipmentNo?: string;
  quantity?: Quantity;
}

export interface Lot {
  code: string;
  product: string;
  orderNo: string;
  line: number;
  status: LotStatus;
  /** The plant's "today", so day counts match what the server would compute. */
  today: string;
  producedDate: string;
  bestBeforeDate: string;
  quantity: Quantity;
  yield: number | null;
  shrink: number | null;
  traceBack: TraceBackRow[];
  traceForward: TraceForwardRow[];
  checks: HaccpCheck[];
  events: LotEvent[];
}

export interface OutputRequest {
  orderNo: string;
  quantity: number;
  shrink: number;
  productionDate: string;
  bestBeforeDate: string;
  temperature: number;
  notes?: string;
}

export interface OutputReceipt {
  id: string;
  orderNo: string;
  lotCode: string;
  quantity: Quantity;
  shrink: Quantity;
  temperature: Quantity;
  productionDate: string;
  bestBeforeDate: string;
  notes: string;
  recordedAt: string;
}

/** A value inside a problem response. Typed, so the client can format it for the user's locale. */
export type ProblemValue =
  | string
  | number
  | { quantity: Quantity }
  | { ratio: number }
  | { date: string };

export interface FieldError {
  field: string;
  code: string;
  values: Record<string, ProblemValue>;
}

/** RFC 9457 problem details with two extension members: a stable code and its values. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  values: Record<string, ProblemValue>;
  traceId: string;
  /** Same shape as ASP.NET Core's ValidationProblemDetails. */
  errors?: Record<string, string[]>;
  fieldErrors?: FieldError[];
}
