// Picks the request culture from Accept-Language, the way ASP.NET Core's
// request localization middleware does when no query string or cookie is set.

export const SUPPORTED_CULTURES = ['en', 'es', 'pt-BR'] as const;
export type Culture = (typeof SUPPORTED_CULTURES)[number];

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
    const exact = SUPPORTED_CULTURES.find((c) => c.toLowerCase() === tag);
    if (exact) return exact;
    const primary = tag.split('-')[0];
    const byLanguage = SUPPORTED_CULTURES.find((c) => c.toLowerCase().split('-')[0] === primary);
    if (byLanguage) return byLanguage;
  }
  return 'en';
}
