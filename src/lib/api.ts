// The client for the stand-in API. Every call says which language the user chose.

import { acceptLanguage } from '../i18n';
import type { ProblemDetails } from '../../api/_lib/types';

export type * from '../../api/_lib/types';

/** What went over the wire, kept so the sample can show it beside the rendered message. */
export interface Exchange {
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  response: { status: number; headers: Record<string, string>; body: unknown };
}

export class ApiProblem extends Error {
  readonly problem: ProblemDetails;
  readonly exchange: Exchange;
  constructor(problem: ProblemDetails, exchange: Exchange) {
    super(problem.detail);
    this.name = 'ApiProblem';
    this.problem = problem;
    this.exchange = exchange;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('The server could not be reached.');
    this.name = 'NetworkError';
  }
}

const SHOWN_RESPONSE_HEADERS = ['content-type', 'content-language', 'x-request-culture'];

/** What a problem's code reads as when the API sent none, as ASP.NET Core does by default. */
export const NO_CODE = 'unknown';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProblem(body: unknown): body is Json {
  return isRecord(body) && 'status' in body && 'title' in body;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Reads a problem response without trusting its shape. An API that has not adopted codes yet
 * answers with a title and, for validation, an "errors" dictionary and nothing else; the user
 * still has to see something. The text to show falls back from detail to title to the first
 * message in "errors".
 */
function toProblem(body: Json, status: number): ProblemDetails {
  const errors = isRecord(body.errors)
    ? Object.fromEntries(
        Object.entries(body.errors).map(([field, messages]) => [
          field,
          (Array.isArray(messages) ? messages : [messages]).filter((message): message is string => typeof message === 'string'),
        ]),
      )
    : undefined;
  const fieldErrors = Array.isArray(body.fieldErrors)
    ? body.fieldErrors.flatMap((entry) =>
        isRecord(entry) && typeof entry.field === 'string' && typeof entry.code === 'string'
          ? [{ field: entry.field, code: entry.code, values: (isRecord(entry.values) ? entry.values : {}) as ProblemDetails['values'] }]
          : [],
      )
    : undefined;
  return {
    type: text(body.type),
    title: text(body.title),
    status,
    detail: text(body.detail) || text(body.title) || Object.values(errors ?? {}).flat()[0] || '',
    instance: text(body.instance),
    code: text(body.code) || NO_CODE,
    values: (isRecord(body.values) ? body.values : {}) as ProblemDetails['values'],
    traceId: text(body.traceId),
    ...(errors ? { errors } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal): Promise<{ data: T; exchange: Exchange }> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': acceptLanguage() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  let parsed: unknown;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
    parsed = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new NetworkError();
  }

  const exchange: Exchange = {
    request: { method, path, headers, body: body ?? null },
    response: {
      status: response.status,
      headers: Object.fromEntries(
        SHOWN_RESPONSE_HEADERS.flatMap((name) => {
          const value = response.headers.get(name);
          return value ? [[name, value]] : [];
        }),
      ),
      body: parsed,
    },
  };

  if (!response.ok) {
    if (isProblem(parsed)) throw new ApiProblem(toProblem(parsed, response.status), exchange);
    throw new NetworkError();
  }
  return { data: parsed as T, exchange };
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await call<T>('GET', path, undefined, signal)).data;
}

export function apiPost<T>(path: string, body: unknown): Promise<{ data: T; exchange: Exchange }> {
  return call<T>('POST', path, body);
}
