import rawChampions from '@/data/champions.json';
import type { Champion } from '@/types/draft';

export const CURATED_CHAMPIONS: Champion[] = (rawChampions as Champion[]).sort(
  (a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'),
);

export const ALL_CHAMPIONS: Champion[] = CURATED_CHAMPIONS;

export function buildChampionMap(
  champions: Champion[],
): Record<string, Champion> {
  return Object.fromEntries(
    champions.map((champion) => [champion.id, champion]),
  );
}

export function getChampionsByIds(
  ids: string[],
  championMap: Record<string, Champion>,
): Champion[] {
  return ids
    .map((id) => championMap[id])
    .filter((champion): champion is Champion => Boolean(champion));
}
