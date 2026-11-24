// Fictional data for an invented producer of chilled soups, dips and sauces.
// Dates are built from the request time so the sample always looks like "this week".
// One product was entered in Spanish on purpose: names are data and stay as entered in every language.

import type {
  HaccpCheck,
  Lot,
  LotEvent,
  LotStatus,
  LotSummary,
  Order,
  OrderStatus,
  Plant,
  Quantity,
  TraceBackRow,
  TraceForwardRow,
} from './types.js';

export const PLANT: Plant = {
  company: 'Cedar Fork Foods',
  name: 'Cedar Fork',
  timeZone: 'America/Chicago',
  units: { mass: 'kilogram', temperature: 'celsius' },
};

/** A line that is being changed over. Only the server knows this. */
export const LINE_IN_CHANGEOVER = 4;
/** How far over the planned quantity an order may run before the server refuses. */
export const OVERRUN_TOLERANCE = 0.1;
/** Output can be recorded for a production date up to this many days back. */
export const MAX_BACKDATE_DAYS = 30;
/** A best-before date further out than this is taken for a typing mistake. */
export const MAX_SHELF_LIFE_YEARS = 5;

const kg = (value: number): Quantity => ({ value, unit: 'kilogram' });
const celsius = (value: number): Quantity => ({ value, unit: 'celsius' });

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const plantCalendar = new Intl.DateTimeFormat('en-US', {
  timeZone: PLANT.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Moves a plain date (YYYY-MM-DD) by whole days. A plain date has no time zone, so UTC arithmetic is exact. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}

/** Moves a plain date by whole years. 29 February lands on 1 March in a year without one. */
export function addYears(date: string, years: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
}

/**
 * The plant's calendar date, read in the plant's own time zone. At 7:30 PM in Chicago the UTC
 * date is already tomorrow; the plant's "today" is not. Day offsets are added to that date.
 */
export function isoDate(now: Date, offsetDays = 0): string {
  const parts = Object.fromEntries(plantCalendar.formatToParts(now).map((part) => [part.type, part.value]));
  return addDays(`${parts.year}-${parts.month}-${parts.day}`, offsetDays);
}

function instant(now: Date, hoursAgo: number): string {
  return new Date(now.getTime() - hoursAgo * HOUR).toISOString();
}

interface OrderSeed {
  orderNo: string;
  product: string;
  line: number;
  planned: number;
  produced: number | null;
  yield: number | null;
  status: OrderStatus;
  startOffset: number;
  lotCode: string | null;
}

const ORDER_SEEDS: OrderSeed[] = [
  { orderNo: 'PO-26-1181', product: 'Tomato basil soup 1 L', line: 1, planned: 2400, produced: 2318.4, yield: 0.966, status: 'completed', startOffset: -4, lotCode: 'CF-26-0412' },
  { orderNo: 'PO-26-1182', product: 'Roasted red pepper hummus 250 g', line: 2, planned: 1200, produced: 1164.2, yield: 0.97, status: 'completed', startOffset: -3, lotCode: 'CF-26-0418' },
  { orderNo: 'PO-26-1183', product: 'Butternut squash soup 1 L', line: 1, planned: 2400, produced: 2291, yield: 0.955, status: 'completed', startOffset: -2, lotCode: 'CF-26-0421' },
  { orderNo: 'PO-26-1184', product: 'Lemon herb dressing 350 ml', line: 2, planned: 1500, produced: 1250.5, yield: null, status: 'in_progress', startOffset: -1, lotCode: 'CF-26-0425' },
  { orderNo: 'PO-26-1185', product: 'Classic basil pesto 190 g', line: 3, planned: 800, produced: 412, yield: null, status: 'on_hold', startOffset: -1, lotCode: 'CF-26-0426' },
  { orderNo: 'PO-26-1186', product: 'Tomato basil soup 1 L', line: 1, planned: 2400, produced: 960, yield: null, status: 'in_progress', startOffset: 0, lotCode: 'CF-26-0427' },
  { orderNo: 'PO-26-1187', product: 'Salsa roja tatemada 450 g', line: 4, planned: 1000, produced: 310, yield: null, status: 'in_progress', startOffset: 0, lotCode: 'CF-26-0428' },
  { orderNo: 'PO-26-1188', product: 'Roasted red pepper hummus 250 g', line: 2, planned: 1200, produced: null, yield: null, status: 'planned', startOffset: 1, lotCode: null },
  { orderNo: 'PO-26-1189', product: 'Classic basil pesto 190 g', line: 3, planned: 800, produced: null, yield: null, status: 'planned', startOffset: 2, lotCode: null },
  { orderNo: 'PO-26-1190', product: 'Salsa roja tatemada 450 g', line: 4, planned: 1000, produced: null, yield: null, status: 'planned', startOffset: 3, lotCode: null },
];

export function listOrders(now: Date): Order[] {
  return ORDER_SEEDS.map((seed) => ({
    orderNo: seed.orderNo,
    product: seed.product,
    line: seed.line,
    planned: kg(seed.planned),
    produced: seed.produced === null ? null : kg(seed.produced),
    yield: seed.yield,
    status: seed.status,
    startDate: isoDate(now, seed.startOffset),
    lotCode: seed.lotCode,
  }));
}

export function findOrder(now: Date, orderNo: string): Order | undefined {
  return listOrders(now).find((order) => order.orderNo === orderNo);
}

interface Recipe {
  shelfLifeDays: number;
  cookLimit: number;
  ingredients: Array<{ ingredient: string; supplier: string; supplierLot: string; share: number; receivedOffset: number }>;
}

const RECIPES: Record<string, Recipe> = {
  'Tomato basil soup 1 L': {
    shelfLifeDays: 45,
    cookLimit: 85,
    ingredients: [
      { ingredient: 'Crushed tomatoes', supplier: 'Greenhollow Farms', supplierLot: 'GH-7T-20931', share: 0.58, receivedOffset: -9 },
      { ingredient: 'Vegetable stock', supplier: 'Three Pines Kitchen Supply', supplierLot: 'TP-V-08817', share: 0.3, receivedOffset: -7 },
      { ingredient: 'Fresh basil', supplier: 'Greenhollow Farms', supplierLot: 'GH-BA-20977', share: 0.03, receivedOffset: -5 },
      { ingredient: 'Cream', supplier: 'Sable Ridge Dairy', supplierLot: 'SR-C-1140', share: 0.09, receivedOffset: -5 },
    ],
  },
  'Butternut squash soup 1 L': {
    shelfLifeDays: 45,
    cookLimit: 85,
    ingredients: [
      { ingredient: 'Butternut squash, diced', supplier: 'Greenhollow Farms', supplierLot: 'GH-SQ-21004', share: 0.62, receivedOffset: -6 },
      { ingredient: 'Vegetable stock', supplier: 'Three Pines Kitchen Supply', supplierLot: 'TP-V-08817', share: 0.28, receivedOffset: -7 },
      { ingredient: 'Cream', supplier: 'Sable Ridge Dairy', supplierLot: 'SR-C-1152', share: 0.1, receivedOffset: -3 },
    ],
  },
  'Roasted red pepper hummus 250 g': {
    shelfLifeDays: 30,
    cookLimit: 74,
    ingredients: [
      { ingredient: 'Chickpeas, cooked', supplier: 'Vega Dry Goods', supplierLot: 'VG-CP-5521', share: 0.55, receivedOffset: -12 },
      { ingredient: 'Roasted red peppers', supplier: 'Greenhollow Farms', supplierLot: 'GH-RP-20899', share: 0.2, receivedOffset: -8 },
      { ingredient: 'Tahini', supplier: 'Vega Dry Goods', supplierLot: 'VG-TA-5530', share: 0.15, receivedOffset: -12 },
      { ingredient: 'Olive oil', supplier: 'Three Pines Kitchen Supply', supplierLot: 'TP-O-08790', share: 0.1, receivedOffset: -15 },
    ],
  },
  'Classic basil pesto 190 g': {
    shelfLifeDays: 60,
    cookLimit: 74,
    ingredients: [
      { ingredient: 'Fresh basil', supplier: 'Greenhollow Farms', supplierLot: 'GH-BA-21010', share: 0.4, receivedOffset: -3 },
      { ingredient: 'Olive oil', supplier: 'Three Pines Kitchen Supply', supplierLot: 'TP-O-08790', share: 0.35, receivedOffset: -15 },
      { ingredient: 'Hard cheese, grated', supplier: 'Sable Ridge Dairy', supplierLot: 'SR-HC-1147', share: 0.15, receivedOffset: -6 },
      { ingredient: 'Pine nuts', supplier: 'Vega Dry Goods', supplierLot: 'VG-PN-5544', share: 0.1, receivedOffset: -10 },
    ],
  },
  'Lemon herb dressing 350 ml': {
    shelfLifeDays: 90,
    cookLimit: 74,
    ingredients: [
      { ingredient: 'Sunflower oil', supplier: 'Three Pines Kitchen Supply', supplierLot: 'TP-S-08802', share: 0.6, receivedOffset: -14 },
      { ingredient: 'Lemon juice', supplier: 'Greenhollow Farms', supplierLot: 'GH-LJ-20950', share: 0.25, receivedOffset: -6 },
      { ingredient: 'Dried herb blend', supplier: 'Vega Dry Goods', supplierLot: 'VG-HB-5538', share: 0.15, receivedOffset: -11 },
    ],
  },
  'Salsa roja tatemada 450 g': {
    shelfLifeDays: 60,
    cookLimit: 85,
    ingredients: [
      { ingredient: 'Fire-roasted tomatoes', supplier: 'Greenhollow Farms', supplierLot: 'GH-7T-20988', share: 0.7, receivedOffset: -4 },
      { ingredient: 'Onions, diced', supplier: 'Greenhollow Farms', supplierLot: 'GH-ON-20991', share: 0.2, receivedOffset: -4 },
      { ingredient: 'Lime juice', supplier: 'Vega Dry Goods', supplierLot: 'VG-LI-5551', share: 0.1, receivedOffset: -9 },
    ],
  },
};

interface LotSeed {
  code: string;
  orderNo: string;
  status: LotStatus;
  shrink: number | null;
  cookReading: number;
  metalDetected: boolean;
  /** Hours since the lot was created. */
  ageHours: number;
  shipments: Array<{ shipmentNo: string; customer: string; shippedOffset: number; quantity: number; hoursAgo: number }>;
}

const LOT_SEEDS: LotSeed[] = [
  {
    code: 'CF-26-0412',
    orderNo: 'PO-26-1181',
    status: 'released',
    shrink: 0.034,
    cookReading: 88.5,
    metalDetected: false,
    ageHours: 98,
    shipments: [
      { shipmentNo: 'SH-26-3051', customer: 'Lakeshore Grocers', shippedOffset: -2, quantity: 1200, hoursAgo: 50 },
      { shipmentNo: 'SH-26-3058', customer: 'Bright Pantry Co-op', shippedOffset: -1, quantity: 640.5, hoursAgo: 27 },
      { shipmentNo: 'SH-26-3064', customer: 'Northfield Catering', shippedOffset: 0, quantity: 320, hoursAgo: 3 },
    ],
  },
  {
    code: 'CF-26-0418',
    orderNo: 'PO-26-1182',
    status: 'released',
    shrink: 0.03,
    cookReading: 76,
    metalDetected: false,
    ageHours: 74,
    shipments: [{ shipmentNo: 'SH-26-3060', customer: 'Harvest Lane Markets', shippedOffset: -1, quantity: 480, hoursAgo: 22 }],
  },
  { code: 'CF-26-0421', orderNo: 'PO-26-1183', status: 'quarantine', shrink: 0.045, cookReading: 87, metalDetected: false, ageHours: 50, shipments: [] },
  { code: 'CF-26-0425', orderNo: 'PO-26-1184', status: 'quarantine', shrink: null, cookReading: 75.5, metalDetected: false, ageHours: 26, shipments: [] },
  { code: 'CF-26-0426', orderNo: 'PO-26-1185', status: 'on_hold', shrink: null, cookReading: 76.5, metalDetected: true, ageHours: 25, shipments: [] },
  { code: 'CF-26-0427', orderNo: 'PO-26-1186', status: 'quarantine', shrink: null, cookReading: 89, metalDetected: false, ageHours: 5, shipments: [] },
  { code: 'CF-26-0428', orderNo: 'PO-26-1187', status: 'quarantine', shrink: null, cookReading: 86.5, metalDetected: false, ageHours: 4, shipments: [] },
];

export function listLots(now: Date): LotSummary[] {
  return LOT_SEEDS.map((seed) => {
    const order = findOrder(now, seed.orderNo);
    return { code: seed.code, product: order?.product ?? '', status: seed.status };
  });
}

export function lotStatus(code: string): LotStatus | undefined {
  return LOT_SEEDS.find((seed) => seed.code === code)?.status;
}

export function findLot(now: Date, code: string): Lot | undefined {
  const seed = LOT_SEEDS.find((candidate) => candidate.code.toLowerCase() === code.toLowerCase());
  if (!seed) return undefined;
  const order = findOrder(now, seed.orderNo);
  if (!order) return undefined;
  const recipe = RECIPES[order.product];
  if (!recipe) return undefined;

  const quantity = order.produced ?? kg(0);
  const producedDate = order.startDate;
  const producedOffset = Math.round((Date.parse(producedDate) - Date.parse(isoDate(now))) / DAY);

  const traceBack: TraceBackRow[] = recipe.ingredients.map((item) => ({
    ingredient: item.ingredient,
    supplierLot: item.supplierLot,
    supplier: item.supplier,
    receivedDate: isoDate(now, item.receivedOffset),
    used: kg(Math.round(order.planned.value * item.share * 10) / 10),
  }));

  const traceForward: TraceForwardRow[] = seed.shipments.map((shipment) => ({
    shipmentNo: shipment.shipmentNo,
    customer: shipment.customer,
    shippedDate: isoDate(now, shipment.shippedOffset),
    quantity: kg(shipment.quantity),
  }));

  const checks: HaccpCheck[] = [
    {
      check: 'cook_temperature',
      limit: { kind: 'min', quantity: celsius(recipe.cookLimit) },
      reading: { quantity: celsius(seed.cookReading) },
      result: seed.cookReading >= recipe.cookLimit ? 'pass' : 'fail',
      checkedAt: instant(now, seed.ageHours - 0.5),
      correctiveAction: null,
    },
    {
      check: 'cooling',
      limit: { kind: 'max', quantity: celsius(4) },
      reading: { quantity: celsius(3.5) },
      result: 'pass',
      checkedAt: instant(now, seed.ageHours - 2.5),
      correctiveAction: null,
    },
    {
      check: 'metal_detection',
      limit: { kind: 'none_detected' },
      reading: { detected: seed.metalDetected },
      result: seed.metalDetected ? 'fail' : 'pass',
      checkedAt: instant(now, seed.ageHours - 3),
      correctiveAction: seed.metalDetected ? 'hold_and_reinspect' : null,
    },
  ];

  const events: LotEvent[] = [
    { type: 'lot_created', at: instant(now, seed.ageHours), orderNo: seed.orderNo },
    { type: 'output_recorded', at: instant(now, seed.ageHours - 1.5), quantity },
    { type: 'qc_sample_taken', at: instant(now, seed.ageHours - 2) },
  ];
  if (seed.status === 'on_hold') {
    events.push({ type: 'hold_placed', at: instant(now, seed.ageHours - 3.2) });
  }
  if (seed.status === 'released') {
    events.push({ type: 'released', at: instant(now, seed.ageHours - 20) });
  }
  for (const shipment of seed.shipments) {
    events.push({ type: 'shipment_dispatched', at: instant(now, shipment.hoursAgo), shipmentNo: shipment.shipmentNo });
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    code: seed.code,
    product: order.product,
    orderNo: seed.orderNo,
    line: order.line,
    status: seed.status,
    today: isoDate(now),
    producedDate,
    bestBeforeDate: isoDate(now, producedOffset + recipe.shelfLifeDays),
    quantity,
    yield: order.yield,
    shrink: seed.shrink,
    traceBack,
    traceForward,
    checks,
    events,
  };
}
