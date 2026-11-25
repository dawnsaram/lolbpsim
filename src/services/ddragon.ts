import type { Champion, DamageType, Role } from '@/types/draft';

const DEFAULT_DDRAGON_VERSION = '15.9.1';
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';

let cachedVersion = DEFAULT_DDRAGON_VERSION;

interface DDragonChampionRaw {
  id: string;
  key: string;
  name: string;
  tags: string[];
  info: {
    attack: number;
    defense: number;
    magic: number;
    difficulty: number;
  };
}

interface DDragonChampionResponse {
  version: string;
  data: Record<string, DDragonChampionRaw>;
}

export function getDDragonVersion(): string {
  return cachedVersion;
}

export async function fetchLatestDDragonVersion(): Promise<string> {
  try {
    const response = await fetch(`${DDRAGON_BASE_URL}/api/versions.json`);
    if (!response.ok) return cachedVersion;
    const versions = (await response.json()) as string[];
    if (Array.isArray(versions) && versions.length > 0) {
      cachedVersion = versions[0];
    }
  } catch {
    // 오프라인/네트워크 오류 시 기본 버전 유지
  }
  return cachedVersion;
}

export function getChampionIconUrl(
  championId: string,
  version: string = cachedVersion,
): string {
  return `${DDRAGON_BASE_URL}/cdn/${version}/img/champion/${championId}.png`;
}

function inferRolesFromTags(tags: string[]): Role[] {
  const roles = new Set<Role>();

  for (const tag of tags) {
    switch (tag) {
      case 'Marksman':
        roles.add('BOT');
        break;
      case 'Support':
        roles.add('SUP');
        break;
      case 'Mage':
        roles.add('MID');
        break;
      case 'Tank':
        roles.add('TOP');
        if (tags.includes('Support')) roles.add('SUP');
        else roles.add('JGL');
        break;
      case 'Fighter':
        roles.add('TOP');
        roles.add('JGL');
        break;
      case 'Assassin':
        roles.add('MID');
        roles.add('JGL');
        break;
      default:
        break;
    }
  }

  return roles.size > 0 ? Array.from(roles) : ['MID'];
}

function inferDamageType(info: DDragonChampionRaw['info']): DamageType {
  if (info.magic >= info.attack + 2) return 'AP';
  if (info.attack >= info.magic + 2) return 'AD';
  return 'MIXED';
}

function clampStat(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function buildFallbackChampion(raw: DDragonChampionRaw): Champion {
  const isTank = raw.tags.includes('Tank');
  const isFighter = raw.tags.includes('Fighter');
  const isMage = raw.tags.includes('Mage');
  const isMarksman = raw.tags.includes('Marksman');
  const isAssassin = raw.tags.includes('Assassin');
  const isSupport = raw.tags.includes('Support');

  return {
    id: raw.id,
    name: raw.id,
    nameKo: raw.name,
    roles: inferRolesFromTags(raw.tags),
    tier: 3.2,
    damageType: inferDamageType(raw.info),
    stats: {
      frontline: clampStat(
        isTank ? 4 + raw.info.defense / 10 : isFighter ? 3 : raw.info.defense / 3,
      ),
      engage: clampStat(
        isTank ? 4 : isSupport ? 3 : isAssassin || isFighter ? 3 : 2,
      ),
      dps: clampStat(
        isMarksman
          ? 5
          : isMage || isFighter
            ? 2.5 + Math.max(raw.info.attack, raw.info.magic) / 5
            : isAssassin
              ? 3
              : isSupport || isTank
                ? 1.5
                : 3,
      ),
      waveClear: clampStat(
        isMage ? 4 : isMarksman ? 4 : isSupport ? 1 : 3,
      ),
      range: clampStat(isMarksman || isMage ? 4 : isSupport ? 3 : 1),
      earlyGame: clampStat(isAssassin || isFighter ? 4 : 3),
      lateGame: clampStat(isMarksman || isMage ? 4 : 3),
    },
    counters: [],
    synergies: [],
  };
}

/**
 * Riot Data Dragon에서 최신 패치 전체 챔피언(170+종)을 불러와
 * 정교화된 메타 데이터(champions.json)와 병합하여 가나다순으로 반환합니다.
 */
export async function fetchAllChampionsMerged(
  curatedChampions: Champion[],
): Promise<{ version: string; champions: Champion[] }> {
  const version = await fetchLatestDDragonVersion();
  const curatedMap = new Map(curatedChampions.map((c) => [c.id, c]));

  try {
    const response = await fetch(
      `${DDRAGON_BASE_URL}/cdn/${version}/data/ko_KR/champion.json`,
    );
    if (!response.ok) {
      return { version, champions: curatedChampions };
    }

    const payload = (await response.json()) as DDragonChampionResponse;
    const merged: Champion[] = Object.values(payload.data).map((raw) => {
      const curated = curatedMap.get(raw.id);
      if (curated) {
        return {
          ...curated,
          nameKo: raw.name,
        };
      }
      return buildFallbackChampion(raw);
    });

    merged.sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'));
    return { version, champions: merged };
  } catch {
    return { version, champions: curatedChampions };
  }
}
