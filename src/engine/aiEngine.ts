import { analyzeTeamComp } from '@/engine/compAnalyzer';
import type { AiDraftContext, Champion, TeamCompAnalysis } from '@/types/draft';
import {
  getAvailablePool,
  getHighTierCountByRole,
  getUnfilledRoles,
  HIGH_TIER_THRESHOLD,
} from '@/utils/pool';

export interface ScoredCandidate {
  champion: Champion;
  score: number;
}

/**
 * 상위 K개 후보 중 점수 비례 확률(Softmax)로 선택하여
 * 매 판 동일한 밴픽이 반복되지 않도록 합니다.
 */
export function selectFromTopK(
  candidates: ScoredCandidate[],
  k: number = 3,
  temperature: number = 12,
): Champion | null {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const topK = sorted.slice(0, Math.min(k, sorted.length));
  const maxScore = topK[0].score;

  const weights = topK.map((item) =>
    Math.exp((item.score - maxScore) / temperature),
  );
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < topK.length; i += 1) {
    random -= weights[i];
    if (random <= 0) {
      return topK[i].champion;
    }
  }

  return topK[0].champion;
}

/**
 * 조합 보완 세부 점수 계산 (후반 픽일수록 결핍 해소 가중치 상승)
 */
export function evaluateCompNeed(
  champ: Champion,
  comp: TeamCompAnalysis,
  currentPickCount: number,
): number {
  let bonus = 0;
  const urgency = 1.0 + currentPickCount * 0.4;

  // 1. AD / AP 딜 밸런스 보정
  if (comp.adCount >= 2 && comp.apCount === 0 && champ.damageType === 'AP') {
    bonus += 25 * urgency;
  }
  if (comp.apCount >= 2 && comp.adCount === 0 && champ.damageType === 'AD') {
    bonus += 25 * urgency;
  }

  // 올 AD / 올 AP 방지 페널티
  if (comp.adCount >= 3 && champ.damageType === 'AD') {
    bonus -= 30;
  }
  if (comp.apCount >= 3 && champ.damageType === 'AP') {
    bonus -= 30;
  }

  // 2. 앞라인(탱커) 보강
  if (comp.totalFrontline < 4 && champ.stats.frontline >= 3) {
    bonus += champ.stats.frontline * 5 * urgency;
  }

  // 3. 이니시 수단 보강
  if (comp.totalEngage < 3 && champ.stats.engage >= 3) {
    bonus += champ.stats.engage * 5 * urgency;
  }

  // 4. 라인 클리어 보강
  if (comp.totalWaveClear < 4 && champ.stats.waveClear >= 4) {
    bonus += 10 * urgency;
  }

  return bonus;
}

/**
 * 밴(Ban) 의사결정 알고리즘 (OP 견제 + 피어리스 포지션 말리기 중심)
 */
export function decideBan(
  allChampions: Champion[],
  state: AiDraftContext,
): Champion | null {
  const pickedIds = new Set([
    ...state.aiPicks.map((c) => c.id),
    ...state.enemyPicks.map((c) => c.id),
  ]);
  const pool = getAvailablePool(
    allChampions,
    state.bannedIds,
    state.fearlessLockedIds,
    pickedIds,
  );

  const enemyOpenRoles = getUnfilledRoles(state.enemyPicks);
  const aiOpenRoles = getUnfilledRoles(state.aiPicks);

  // 상대방이 이미 픽한 포지션만 수행하는 챔피언은 밴 후보에서 제외
  const banEligiblePool =
    state.enemyPicks.length > 0 && enemyOpenRoles.length > 0
      ? pool.filter((champ) =>
          champ.roles.some((role) => enemyOpenRoles.includes(role)),
        )
      : pool;

  const targetPool = banEligiblePool.length > 0 ? banEligiblePool : pool;

  const candidates: ScoredCandidate[] = [];

  for (const champ of targetPool) {
    let score = 0;

    // 1. 기본 티어 점수 (OP 챔피언 견제)
    score += (6.0 - champ.tier) * 10;

    // 2. 피어리스 포지션 말리기 (Pinch) 가산점
    for (const role of champ.roles) {
      if (enemyOpenRoles.includes(role)) {
        const remainingHighTier = getHighTierCountByRole(pool, role);

        if (remainingHighTier <= 4 && champ.tier <= HIGH_TIER_THRESHOLD) {
          let pinchBonus = (5 - remainingHighTier) * 15;

          // AI는 이미 해당 라인을 뽑았을 때 말리기 효율 극대화 (자충수 방지)
          if (!aiOpenRoles.includes(role)) {
            pinchBonus *= 1.5;
          }

          // 2페이즈 밴이나 3세트 이상일수록 가중치 강화
          if (state.phase === 'BAN_2' || state.gameNumber >= 3) {
            pinchBonus *= 1.3;
          }

          score += pinchBonus;
        }
      }
    }

    // 3. 상대 조합 시너지 및 우리 팀 카운터 차단
    const enemySynergyCount = state.enemyPicks.filter((e) =>
      champ.synergies.includes(e.id),
    ).length;
    const aiCounterCount = state.aiPicks.filter((a) =>
      champ.counters.includes(a.id),
    ).length;

    score += enemySynergyCount * 12;
    score += aiCounterCount * 15;

    candidates.push({ champion: champ, score });
  }

  return selectFromTopK(candidates, 2);
}

/**
 * 픽(Pick) 의사결정 알고리즘 (조합 보완 + 피어리스 희소 자원 선점)
 */
export function decidePick(
  allChampions: Champion[],
  state: AiDraftContext,
): Champion | null {
  const pickedIds = new Set([
    ...state.aiPicks.map((c) => c.id),
    ...state.enemyPicks.map((c) => c.id),
  ]);
  const pool = getAvailablePool(
    allChampions,
    state.bannedIds,
    state.fearlessLockedIds,
    pickedIds,
  );

  const aiOpenRoles = getUnfilledRoles(state.aiPicks);
  const enemyOpenRoles = getUnfilledRoles(state.enemyPicks);
  const comp = analyzeTeamComp(state.aiPicks, state.gameNumber);

  const candidates: ScoredCandidate[] = [];

  for (const champ of pool) {
    const validRoles = champ.roles.filter((role) => aiOpenRoles.includes(role));
    if (validRoles.length === 0) continue;

    let score = 0;

    // 1. 기본 티어 점수
    score += (6.0 - champ.tier) * 10;

    // 2. 조합 보완 점수
    score += evaluateCompNeed(champ, comp, state.aiPicks.length);

    // 3. 피어리스 희소 포지션 선점 점수
    for (const role of validRoles) {
      const remaining = getHighTierCountByRole(pool, role);
      if (
        enemyOpenRoles.includes(role) &&
        remaining <= 3 &&
        champ.tier <= HIGH_TIER_THRESHOLD
      ) {
        score += (4 - remaining) * 14;
      }
    }

    // 4. 상성(카운터) 및 아군 시너지
    const counterCount = state.enemyPicks.filter((e) =>
      champ.counters.includes(e.id),
    ).length;
    const synergyCount = state.aiPicks.filter((a) =>
      champ.synergies.includes(a.id),
    ).length;

    score += counterCount * 14;
    score += synergyCount * 10;

    // 5. AI 성향 프리셋 반영
    if (state.aiStyle === 'EARLY') {
      score += champ.stats.earlyGame * 4;
    } else if (state.aiStyle === 'LATE') {
      score += champ.stats.lateGame * 4;
    }

    candidates.push({ champion: champ, score });
  }

  // 만약 남은 포지션에 맞는 챔피언이 풀에 없다면 전체 가용 풀에서 대체 선택
  if (candidates.length === 0 && pool.length > 0) {
    const fallback = pool.map((champion) => ({
      champion,
      score: (6.0 - champion.tier) * 10,
    }));
    return selectFromTopK(fallback, 2);
  }

  return selectFromTopK(candidates, 3);
}
