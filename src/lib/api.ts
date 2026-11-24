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

function isProblem(body: unknown): body is ProblemDetails {
  return typeof body === 'object' && body !== null && 'status' in body && 'title' in body;
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
    if (isProblem(parsed)) {
      throw new ApiProblem({ ...parsed, code: parsed.code ?? 'unknown', values: parsed.values ?? {} }, exchange);
    }
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
