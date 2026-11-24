// Picks the request culture from Accept-Language, following the default behaviour of
// ASP.NET Core's request localization middleware when no query string or cookie is set:
// values in order of quality, an exact match first, then the parent culture. "es-MX"
// falls back to "es"; a bare "pt" does not select "pt-BR", because a child is not a parent.

export const SUPPORTED_CULTURES = ['en', 'es', 'pt-BR'] as const;
export type Culture = (typeof SUPPORTED_CULTURES)[number];

function match(tag: string): Culture | undefined {
  let candidate = tag;
  while (candidate) {
    const found = SUPPORTED_CULTURES.find((culture) => culture.toLowerCase() === candidate);
    if (found) return found;
    const cut = candidate.lastIndexOf('-');
    if (cut < 0) return undefined;
    candidate = candidate.slice(0, cut);
  }
  return undefined;
}

export function resolveCulture(acceptLanguage: string | null | undefined): Culture {
  if (!acceptLanguage) return 'en';
  const wanted = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of wanted) {
    const found = match(tag);
    if (found) return found;
  }
  return 'en';
}
