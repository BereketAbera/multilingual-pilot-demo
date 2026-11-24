import { describe, expect, it } from 'vitest';
import { resolveCulture } from '../../api/_lib/culture';
import { ERROR_CODES } from '../../api/_lib/errorCodes';
import { handleApi } from '../../api/_lib/router';
import type { Lot, OrdersResponse, OutputReceipt, ProblemDetails } from '../../api/_lib/types';

const today = new Date().toISOString().slice(0, 10);

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

const valid = { orderNo: 'PO-26-1186', quantity: 1250.5, shrink: 12.5, productionDate: today, bestBeforeDate: '2099-01-01', temperature: 88.5, notes: '' };

describe('request culture', () => {
  it('follows Accept-Language the way the ASP.NET Core provider does', () => {
    expect(resolveCulture('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt-BR');
    expect(resolveCulture('es-MX')).toBe('es');
    expect(resolveCulture('pt')).toBe('pt-BR');
    expect(resolveCulture('en;q=0.5, pt;q=0.9')).toBe('pt-BR');
    expect(resolveCulture('fr-FR, de;q=0.8')).toBe('en');
    expect(resolveCulture(null)).toBe('en');
  });

  it('reports the culture it resolved on every response', async () => {
    const response = await get('/api/orders', 'pt-BR');
    expect(response.headers.get('x-request-culture')).toBe('pt-BR');
    expect(response.headers.get('content-language')).toBe('en');
    expect(response.headers.get('vary')).toBe('Accept-Language');
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
    const response = await post({ ...valid, orderNo: 'PO-26-1185', quantity: 10 }, 'es');
    const problem = (await response.json()) as ProblemDetails;
    expect(response.status).toBe(409);
    expect(problem.code).toBe('lot.on_hold');
    expect(problem.values).toEqual({ lotCode: 'CF-26-0426' });
    expect(problem.detail).toContain('on hold');
  });

  it('refuses a line in changeover', async () => {
    const problem = (await (await post({ ...valid, orderNo: 'PO-26-1187', quantity: 10 })).json()) as ProblemDetails;
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
    const bodies = [{}, { ...valid, orderNo: 'X' }, { ...valid, orderNo: 'PO-26-1185' }, { ...valid, orderNo: 'PO-26-1187' }, { ...valid, quantity: 99999 }];
    for (const body of bodies) {
      const problem = (await (await post(body)).json()) as ProblemDetails;
      expect(known.has(problem.code)).toBe(true);
      for (const fieldError of problem.fieldErrors ?? []) expect(known.has(fieldError.code)).toBe(true);
    }
  });
});
