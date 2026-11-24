import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCulture } from '../../api/_lib/culture';
import { addDays, addYears, isoDate } from '../../api/_lib/data';
import { ERROR_CODES } from '../../api/_lib/errorCodes';
import { handleApi } from '../../api/_lib/router';
import type { Lot, OrdersResponse, OutputReceipt, Plant, ProblemDetails } from '../../api/_lib/types';

// The plant's date, not the UTC date: in the evening at the plant the two differ.
const today = isoDate(new Date());
const inTwoMonths = addDays(today, 60);

function get(path: string, acceptLanguage?: string) {
  return handleApi(new Request(`http://localhost${path}`, { headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} }));
}

function post(body: unknown, acceptLanguage = 'en') {
  return handleApi(
    new Request('http://localhost/api/output', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': acceptLanguage },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

const valid = { orderNo: 'PO-26-1186', quantity: 1250.5, shrink: 12.5, productionDate: today, bestBeforeDate: inTwoMonths, temperature: 88.5, notes: '' };

afterEach(() => {
  vi.useRealTimers();
});

describe('request culture', () => {
  it('takes an exact match, in order of quality', () => {
    expect(resolveCulture('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt-BR');
    expect(resolveCulture('en;q=0.5, pt-BR;q=0.9')).toBe('pt-BR');
    expect(resolveCulture('fr-FR, de;q=0.8')).toBe('en');
    expect(resolveCulture(null)).toBe('en');
  });

  it('falls back to the parent culture, never to a child', () => {
    expect(resolveCulture('es-MX')).toBe('es');
    expect(resolveCulture('es-419')).toBe('es');
    // "pt" and "pt-PT" are not parents of "pt-BR", so they do not select it.
    expect(resolveCulture('pt')).toBe('en');
    expect(resolveCulture('pt-PT')).toBe('en');
    expect(resolveCulture('pt-PT, es-MX;q=0.8')).toBe('es');
  });

  it('reports the culture it resolved on every response', async () => {
    const response = await get('/api/orders', 'pt-BR');
    expect(response.headers.get('x-request-culture')).toBe('pt-BR');
    expect(response.headers.get('content-language')).toBe('en');
    expect(response.headers.get('vary')).toBe('Accept-Language');
  });
});

describe('the plant’s day', () => {
  it('is the plant’s date in the evening, when the UTC date is already tomorrow', async () => {
    // 01:30 UTC on the 25th is 7:30 PM on the 24th in Chicago, and 8:30 PM in the Eastern zone.
    vi.useFakeTimers({ now: new Date('2026-11-25T01:30:00Z') });
    const plant = (await (await get('/api/plant')).json()) as Plant & { today: string };
    expect(plant.timeZone).toBe('America/Chicago');
    expect(plant.today).toBe('2026-11-24');

    const orders = (await (await get('/api/orders')).json()) as OrdersResponse;
    expect(orders.orders.find((entry) => entry.orderNo === 'PO-26-1186')?.startDate).toBe('2026-11-24');

    const lot = (await (await get('/api/lots/CF-26-0427')).json()) as Lot;
    expect(lot.today).toBe('2026-11-24');
    expect(lot.producedDate).toBe('2026-11-24');
  });

  it('accepts that evening’s date as the production date and refuses the next day’s', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-25T01:30:00Z') });
    const accepted = await post({ ...valid, productionDate: '2026-11-24', bestBeforeDate: '2027-01-15' });
    expect(accepted.status).toBe(201);
    expect(((await accepted.json()) as OutputReceipt).recordedAt).toBe('2026-11-25T01:30:00.000Z');

    const refused = (await (await post({ ...valid, productionDate: '2026-11-25', bestBeforeDate: '2027-01-15' })).json()) as ProblemDetails;
    expect(refused.fieldErrors).toEqual([
      { field: 'productionDate', code: 'output.production_date_in_future', values: { today: { date: '2026-11-24' } } },
    ]);
  });

  it('is still the plant’s date just after midnight UTC and across the winter clock change', () => {
    expect(isoDate(new Date('2026-07-01T04:59:00Z'))).toBe('2026-06-30');
    expect(isoDate(new Date('2026-07-01T05:00:00Z'))).toBe('2026-07-01');
    expect(isoDate(new Date('2026-12-01T05:59:00Z'))).toBe('2026-11-30');
    expect(isoDate(new Date('2026-12-01T06:00:00Z'), 1)).toBe('2026-12-02');
  });
});

describe('reads', () => {
  it('sends quantities with their unit and dates as ISO text', async () => {
    const body = (await (await get('/api/orders')).json()) as OrdersResponse;
    expect(body.orders).toHaveLength(10);
    const order = body.orders.find((entry) => entry.orderNo === 'PO-26-1184');
    expect(order?.produced).toEqual({ value: 1250.5, unit: 'kilogram' });
    expect(order?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sends statuses and checks as codes, never as English words', async () => {
    const lot = (await (await get('/api/lots/CF-26-0426')).json()) as Lot;
    expect(lot.status).toBe('on_hold');
    expect(lot.traceForward).toEqual([]);
    expect(lot.checks.map((check) => `${check.check}:${check.result}`)).toEqual([
      'cook_temperature:pass',
      'cooling:pass',
      'metal_detection:fail',
    ]);
  });

  it('answers an unknown lot with problem details and a code', async () => {
    const response = await get('/api/lots/NOPE');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const problem = (await response.json()) as ProblemDetails;
    expect(problem).toMatchObject({ status: 404, code: 'lot.not_found', values: { lotCode: 'NOPE' } });
    expect(problem.traceId).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/);
  });
});

describe('recording output', () => {
  it('accepts a JSON number and ISO dates', async () => {
    const response = await post(valid);
    expect(response.status).toBe(201);
    const receipt = (await response.json()) as OutputReceipt;
    expect(receipt).toMatchObject({ orderNo: 'PO-26-1186', lotCode: 'CF-26-0427', quantity: { value: 1250.5, unit: 'kilogram' } });
  });

  it('refuses a lot on hold with a code and the lot as a value', async () => {
    const response = await post({ ...valid, orderNo: 'PO-26-1185', quantity: 10, shrink: 0 }, 'es');
    const problem = (await response.json()) as ProblemDetails;
    expect(response.status).toBe(409);
    expect(problem.code).toBe('lot.on_hold');
    expect(problem.values).toEqual({ lotCode: 'CF-26-0426' });
    expect(problem.detail).toContain('on hold');
  });

  it('refuses a line in changeover', async () => {
    const problem = (await (await post({ ...valid, orderNo: 'PO-26-1187', quantity: 10, shrink: 0 })).json()) as ProblemDetails;
    expect(problem).toMatchObject({ status: 409, code: 'line.changeover_in_progress', values: { line: 4 } });
  });

  it('sends typed values, so the client can format them', async () => {
    const response = await post({ ...valid, orderNo: 'PO-26-1184', quantity: 500 });
    const problem = (await response.json()) as ProblemDetails;
    expect(response.status).toBe(422);
    expect(problem.code).toBe('output.exceeds_planned');
    expect(problem.values).toEqual({
      total: { quantity: { value: 1750.5, unit: 'kilogram' } },
      planned: { quantity: { value: 1500, unit: 'kilogram' } },
      tolerance: { ratio: 0.1 },
    });
  });

  it('refuses formatted text where a number belongs, field by field', async () => {
    const response = await post({ ...valid, quantity: '1.250,5', temperature: 900 });
    const problem = (await response.json()) as ProblemDetails;
    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation.failed');
    expect(problem.fieldErrors).toEqual([
      { field: 'quantity', code: 'validation.invalid_format', values: {} },
      { field: 'temperature', code: 'validation.out_of_range', values: { min: 0, max: 150 } },
    ]);
    expect(Object.keys(problem.errors ?? {})).toEqual(['quantity', 'temperature']);
  });

  it('enforces by itself the rules the form also checks', async () => {
    const codes = async (body: unknown) => {
      const response = await post(body);
      const problem = (await response.json()) as ProblemDetails;
      return [response.status, ...(problem.fieldErrors ?? []).map((entry) => `${entry.field}:${entry.code}`)];
    };
    expect(await codes({ ...valid, shrink: 19999, quantity: 5 })).toEqual([400, 'shrink:output.shrink_exceeds_quantity']);
    expect(await codes({ ...valid, productionDate: addDays(today, 1) })).toEqual([400, 'productionDate:output.production_date_in_future']);
    expect(await codes({ ...valid, productionDate: addDays(today, -31) })).toEqual([400, 'productionDate:validation.date_out_of_range']);
    expect(await codes({ ...valid, bestBeforeDate: today })).toEqual([400, 'bestBeforeDate:output.best_before_not_after_production']);
    expect(await codes({ ...valid, bestBeforeDate: '1999-01-01' })).toEqual([400, 'bestBeforeDate:output.best_before_not_after_production']);
    expect(await codes({ ...valid, bestBeforeDate: addDays(addYears(today, 5), 1) })).toEqual([400, 'bestBeforeDate:validation.date_out_of_range']);
    expect(await codes({ ...valid, bestBeforeDate: addYears(today, 5) })).toEqual([201]);
  });

  it('sends the limits of a date range as dates, for the client to format', async () => {
    const problem = (await (await post({ ...valid, productionDate: addDays(today, -31) })).json()) as ProblemDetails;
    expect(problem.fieldErrors?.[0]?.values).toEqual({ min: { date: addDays(today, -30) }, max: { date: today } });
  });

  it('refuses a date that is not in the calendar instead of rolling it forward', async () => {
    const problem = (await (await post({ ...valid, productionDate: '2026-02-31', bestBeforeDate: '2026-04-31' })).json()) as ProblemDetails;
    expect(problem.fieldErrors?.map((entry) => `${entry.field}:${entry.code}`)).toEqual([
      'productionDate:validation.invalid_format',
      'bestBeforeDate:validation.invalid_format',
    ]);
  });

  it('refuses an order that is completed or not started, as it does one that does not exist', async () => {
    for (const orderNo of ['PO-26-1181', 'PO-26-1188', 'PO-00-0000']) {
      const response = await post({ ...valid, orderNo });
      expect(response.status).toBe(404);
      expect(((await response.json()) as ProblemDetails).code).toBe('order.not_found');
    }
  });

  it('lists every missing field', async () => {
    const problem = (await (await post({})).json()) as ProblemDetails;
    expect(problem.fieldErrors?.map((entry) => `${entry.field}:${entry.code}`)).toEqual([
      'orderNo:validation.required',
      'quantity:validation.required',
      'shrink:validation.required',
      'temperature:validation.required',
      'productionDate:validation.required',
      'bestBeforeDate:validation.required',
    ]);
  });

  it('answers a body that is not JSON with problem details', async () => {
    const response = await post('not json');
    expect(response.status).toBe(400);
    expect(((await response.json()) as ProblemDetails).code).toBe('validation.failed');
  });

  it('only ever sends codes from the published list', async () => {
    const known = new Set(ERROR_CODES.map((entry) => entry.code));
    const bodies = [
      {},
      { ...valid, orderNo: 'X' },
      { ...valid, orderNo: 'PO-26-1185' },
      { ...valid, orderNo: 'PO-26-1187' },
      { ...valid, quantity: 99999 },
      { ...valid, shrink: 5000 },
      { ...valid, productionDate: addDays(today, 3) },
      { ...valid, productionDate: addDays(today, -90), bestBeforeDate: addYears(today, 9) },
      { ...valid, bestBeforeDate: addDays(today, -2) },
    ];
    for (const body of bodies) {
      const problem = (await (await post(body)).json()) as ProblemDetails;
      expect(known.has(problem.code)).toBe(true);
      for (const fieldError of problem.fieldErrors ?? []) expect(known.has(fieldError.code)).toBe(true);
    }
  });
});

describe('answers before any rule runs', () => {
  it('says which method an address takes when asked with another', async () => {
    const response = await get('/api/output');
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(((await response.json()) as ProblemDetails).title).toBe('Method Not Allowed');

    const posted = await handleApi(new Request('http://localhost/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    expect(posted.status).toBe(405);
    expect(posted.headers.get('allow')).toBe('GET');
  });

  it('keeps 404 for an address that does not exist', async () => {
    expect((await get('/api/nothing')).status).toBe(404);
  });

  it('refuses a body that is not sent as JSON', async () => {
    for (const contentType of ['text/plain', 'text/xml']) {
      const response = await handleApi(
        new Request('http://localhost/api/output', { method: 'POST', headers: { 'content-type': contentType }, body: JSON.stringify(valid) }),
      );
      expect(response.status).toBe(415);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
    }
    const withCharset = await handleApi(
      new Request('http://localhost/api/output', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(valid),
      }),
    );
    expect(withCharset.status).toBe(201);
  });
});
