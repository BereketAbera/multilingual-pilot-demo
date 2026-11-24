// One handler for every route of the stand-in API. The files in /api are thin wrappers
// around it for Vercel; the Vite dev and preview servers mount it directly.

import { resolveCulture, type Culture } from './culture.js';
import {
  LINE_IN_CHANGEOVER,
  OVERRUN_TOLERANCE,
  PLANT,
  findLot,
  findOrder,
  isoDate,
  listLots,
  listOrders,
  lotStatus,
} from './data.js';
import { ERROR_CODES } from './errorCodes.js';
import type {
  FieldError,
  LotSummary,
  OrdersResponse,
  OutputReceipt,
  OutputRequest,
  ProblemDetails,
  ProblemValue,
  Quantity,
} from './types.js';

const kg = (value: number): Quantity => ({ value, unit: 'kilogram' });

function traceId(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `00-${hex(32)}-${hex(16)}-00`;
}

function baseHeaders(culture: Culture): Record<string, string> {
  return {
    'cache-control': 'no-store',
    // The server text is English only in this sample; the culture it resolved is reported separately.
    'content-language': 'en',
    'x-request-culture': culture,
    vary: 'Accept-Language',
  };
}

function json(body: unknown, status: number, culture: Culture): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders(culture), 'content-type': 'application/json; charset=utf-8' },
  });
}

interface ProblemInput {
  code: string;
  detail: string;
  instance: string;
  values?: Record<string, ProblemValue>;
  errors?: Record<string, string[]>;
  fieldErrors?: FieldError[];
}

export function buildProblem(input: ProblemInput): ProblemDetails {
  const spec = ERROR_CODES.find((entry) => entry.code === input.code);
  if (!spec) throw new Error(`Unknown error code: ${input.code}`);
  return {
    type: `/problems/${spec.code.replace(/[._]/g, '-')}`,
    title: spec.title,
    status: spec.status,
    detail: input.detail,
    instance: input.instance,
    code: spec.code,
    values: input.values ?? {},
    traceId: traceId(),
    ...(input.errors ? { errors: input.errors } : {}),
    ...(input.fieldErrors ? { fieldErrors: input.fieldErrors } : {}),
  };
}

function problem(input: ProblemInput, culture: Culture): Response {
  const body = buildProblem(input);
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { ...baseHeaders(culture), 'content-type': 'application/problem+json; charset=utf-8' },
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

interface Validation {
  errors: Record<string, string[]>;
  fieldErrors: FieldError[];
}

function addError(
  validation: Validation,
  field: string,
  code: string,
  message: string,
  values: Record<string, ProblemValue> = {},
) {
  (validation.errors[field] ??= []).push(message);
  validation.fieldErrors.push({ field, code, values });
}

function checkNumber(
  validation: Validation,
  body: Record<string, unknown>,
  field: string,
  range: { min: number; max: number },
) {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    addError(validation, field, 'validation.required', `The ${field} field is required.`);
  } else if (typeof value !== 'number' || !Number.isFinite(value)) {
    // What System.Text.Json reports when a formatted string arrives where a number is expected.
    addError(validation, field, 'validation.invalid_format', `The JSON value could not be converted to a number. Path: $.${field}.`);
  } else if (value < range.min || value > range.max) {
    addError(validation, field, 'validation.out_of_range', `The field ${field} must be between ${range.min} and ${range.max}.`, range);
  }
}

function checkDate(validation: Validation, body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    addError(validation, field, 'validation.required', `The ${field} field is required.`);
  } else if (!isIsoDate(value)) {
    addError(validation, field, 'validation.invalid_format', `The JSON value could not be converted to a date. Path: $.${field}.`);
  }
}

async function recordOutput(request: Request, culture: Culture, now: Date, instance: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return problem(
      {
        code: 'validation.failed',
        detail: 'The request body is not valid JSON.',
        instance,
        errors: { $: ['The request body is not valid JSON.'] },
        fieldErrors: [{ field: '$', code: 'validation.invalid_format', values: {} }],
      },
      culture,
    );
  }

  const validation: Validation = { errors: {}, fieldErrors: [] };
  if (typeof body.orderNo !== 'string' || body.orderNo.trim() === '') {
    addError(validation, 'orderNo', 'validation.required', 'The orderNo field is required.');
  }
  checkNumber(validation, body, 'quantity', { min: 0.1, max: 20000 });
  checkNumber(validation, body, 'shrink', { min: 0, max: 20000 });
  checkNumber(validation, body, 'temperature', { min: 0, max: 150 });
  checkDate(validation, body, 'productionDate');
  checkDate(validation, body, 'bestBeforeDate');
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    addError(validation, 'notes', 'validation.invalid_format', 'The JSON value could not be converted to a string. Path: $.notes.');
  }
  if (validation.fieldErrors.length > 0) {
    return problem(
      {
        code: 'validation.failed',
        detail: 'One or more fields were not accepted.',
        instance,
        errors: validation.errors,
        fieldErrors: validation.fieldErrors,
      },
      culture,
    );
  }

  const input = body as unknown as OutputRequest;
  const order = findOrder(now, input.orderNo);
  if (!order || !order.lotCode) {
    return problem(
      {
        code: 'order.not_found',
        detail: `Production order ${input.orderNo} was not found or is not open.`,
        instance,
        values: { orderNo: input.orderNo },
      },
      culture,
    );
  }

  // Rules only the server can check: they depend on state the browser does not have.
  if (lotStatus(order.lotCode) === 'on_hold') {
    return problem(
      {
        code: 'lot.on_hold',
        detail: `Lot ${order.lotCode} is on hold. Output cannot be recorded until quality control releases it.`,
        instance,
        values: { lotCode: order.lotCode },
      },
      culture,
    );
  }
  if (order.line === LINE_IN_CHANGEOVER) {
    return problem(
      {
        code: 'line.changeover_in_progress',
        detail: `Line ${order.line} is in changeover. Output can be recorded again once the changeover is closed.`,
        instance,
        values: { line: order.line },
      },
      culture,
    );
  }
  const total = Math.round(((order.produced?.value ?? 0) + input.quantity) * 10) / 10;
  if (total > order.planned.value * (1 + OVERRUN_TOLERANCE)) {
    return problem(
      {
        code: 'output.exceeds_planned',
        detail: `With this entry the order reaches ${total} kg, more than ${OVERRUN_TOLERANCE * 100}% over the planned ${order.planned.value} kg.`,
        instance,
        values: {
          total: { quantity: kg(total) },
          planned: { quantity: order.planned },
          tolerance: { ratio: OVERRUN_TOLERANCE },
        },
      },
      culture,
    );
  }

  const receipt: OutputReceipt = {
    id: `OUT-${now.getTime().toString(36).toUpperCase()}`,
    orderNo: order.orderNo,
    lotCode: order.lotCode,
    quantity: kg(input.quantity),
    shrink: kg(input.shrink),
    temperature: { value: input.temperature, unit: 'celsius' },
    productionDate: input.productionDate,
    bestBeforeDate: input.bestBeforeDate,
    notes: typeof input.notes === 'string' ? input.notes.slice(0, 280) : '',
    recordedAt: now.toISOString(),
  };
  return json(receipt, 201, culture);
}

export async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '');
  const culture = resolveCulture(request.headers.get('accept-language'));
  const now = new Date();
  const method = request.method.toUpperCase();

  if (method === 'GET' && path === '/api/plant') {
    return json({ ...PLANT, today: isoDate(now) }, 200, culture);
  }
  if (method === 'GET' && path === '/api/orders') {
    const body: OrdersResponse = {
      updatedAt: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
      orders: listOrders(now),
    };
    return json(body, 200, culture);
  }
  if (method === 'GET' && path === '/api/lots') {
    const body: { lots: LotSummary[] } = { lots: listLots(now) };
    return json(body, 200, culture);
  }
  const lotMatch = /^\/api\/lots\/([^/]+)$/.exec(path);
  if (method === 'GET' && lotMatch?.[1]) {
    const code = decodeURIComponent(lotMatch[1]);
    const lot = findLot(now, code);
    if (!lot) {
      return problem(
        { code: 'lot.not_found', detail: `Lot ${code} was not found.`, instance: path, values: { lotCode: code } },
        culture,
      );
    }
    return json(lot, 200, culture);
  }
  if (method === 'POST' && path === '/api/output') {
    return recordOutput(request, culture, now, path);
  }

  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, detail: `No route for ${method} ${path}.`, instance: path }),
    { status: 404, headers: { ...baseHeaders(culture), 'content-type': 'application/problem+json; charset=utf-8' } },
  );
}
