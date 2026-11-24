import { ALL_ROLES, ROLE_LABELS } from '@/constants/draftOrder';
import type { Champion, PoolWarning, Role } from '@/types/draft';

export const HIGH_TIER_THRESHOLD = 2.5;

export function getAvailablePool(
  allChampions: Champion[],
  bannedIds: Set<string>,
  fearlessLockedIds: Set<string>,
  pickedIds: Set<string>,
): Champion[] {
  return allChampions.filter(
    (champ) =>
      !bannedIds.has(champ.id) &&
      !fearlessLockedIds.has(champ.id) &&
      !pickedIds.has(champ.id),
  );
}

export function getHighTierCountByRole(
  availablePool: Champion[],
  role: Role,
): number {
  return availablePool.filter(
    (champ) => champ.roles.includes(role) && champ.tier <= HIGH_TIER_THRESHOLD,
  ).length;
}

/**
 * 현재 픽된 챔피언들의 주/부 포지션을 기반으로 아직 채워지지 않은 포지션을 추정합니다.
 */
export function getUnfilledRoles(picks: Champion[]): Role[] {
  const filled = new Set<Role>();

  // 단일 포지션 챔피언 먼저 배정
  const sortedPicks = [...picks].sort((a, b) => a.roles.length - b.roles.length);

  for (const champ of sortedPicks) {
    const assignableRole = champ.roles.find((role) => !filled.has(role));
    if (assignableRole) {
      filled.add(assignableRole);
    }
  }

  return ALL_ROLES.filter((role) => !filled.has(role));
}

/**
 * 피어리스 다전제 진행 중 특정 포지션의 1~2티어 풀이 얇아질 때 경고를 생성합니다.
 */
export function getPoolWarnings(availablePool: Champion[]): PoolWarning[] {
  const warnings: PoolWarning[] = [];

  for (const role of ALL_ROLES) {
    const remaining = getHighTierCountByRole(availablePool, role);
    if (remaining <= 2) {
      warnings.push({
        role,
        remainingHighTier: remaining,
        severity: 'critical',
        message: `${ROLE_LABELS[role]} 1~2티어 가용 풀 고갈 임박 (남은 챔피언: ${remaining}명)`,
      });
    } else if (remaining <= 4) {
      warnings.push({
        role,
        remainingHighTier: remaining,
        severity: 'warning',
        message: `${ROLE_LABELS[role]} 1~2티어 풀 주의 (남은 챔피언: ${remaining}명)`,
      });
    }
  }

  return warnings;
}

/**
 * 5개 픽 챔피언을 TOP / JGL / MID / BOT / SUP 순서에 가장 잘 맞도록
 * 최적 포지션 배정(5! = 120가지 완전탐색)으로 자동 정렬합니다.
 */
export function arrangePicksByRole(
  pickIds: string[],
  championMap: Record<string, Champion>,
): string[] {
  if (pickIds.length !== ALL_ROLES.length) return pickIds;

  let bestOrder = pickIds;
  let bestScore = -1;

  const permute = (current: string[], remaining: string[]) => {
    if (remaining.length === 0) {
      let score = 0;
      for (let i = 0; i < ALL_ROLES.length; i += 1) {
        const champ = championMap[current[i]];
        const targetRole = ALL_ROLES[i];
        if (!champ) continue;
        if (champ.roles[0] === targetRole) {
          score += 10;
        } else if (champ.roles.includes(targetRole)) {
          score += 6;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestOrder = current;
      }
      return;
    }

    for (let i = 0; i < remaining.length; i += 1) {
      permute(
        [...current, remaining[i]],
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
      );
    }
  };

  permute([], pickIds);
  return bestOrder;
}
