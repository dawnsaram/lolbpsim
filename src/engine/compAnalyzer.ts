import type { Champion, CompFeedback, TeamCompAnalysis } from '@/types/draft';

/**
 * 현재 팀에 픽된 챔피언 목록을 기반으로 실시간 조합 지표를 계산합니다.
 */
export function analyzeTeamComp(
  picks: Champion[],
  gameNumber: number = 1,
): TeamCompAnalysis {
  const pickCount = picks.length;

  let adCount = 0;
  let apCount = 0;
  let mixedCount = 0;
  let adWeight = 0;
  let apWeight = 0;

  let totalFrontline = 0;
  let totalEngage = 0;
  let totalWaveClear = 0;
  let totalRange = 0;

  let totalEarly = 0;
  let totalLate = 0;

  let highTierUsedCount = 0;
  let tankUsedCount = 0;

  for (const champ of picks) {
    if (champ.damageType === 'AD') {
      adCount += 1;
      adWeight += 1;
    } else if (champ.damageType === 'AP') {
      apCount += 1;
      apWeight += 1;
    } else {
      mixedCount += 1;
      adWeight += 0.5;
      apWeight += 0.5;
    }

    totalFrontline += champ.stats.frontline;
    totalEngage += champ.stats.engage;
    totalWaveClear += champ.stats.waveClear;
    totalRange += champ.stats.range;

    totalEarly += champ.stats.earlyGame;
    totalLate += champ.stats.lateGame;

    if (champ.tier <= 1.8) {
      highTierUsedCount += 1;
    }
    if (champ.stats.frontline >= 4) {
      tankUsedCount += 1;
    }
  }

  const totalDamageWeight = adWeight + apWeight;
  const adRatio =
    totalDamageWeight > 0 ? Math.round((adWeight / totalDamageWeight) * 100) : 50;
  const apRatio = totalDamageWeight > 0 ? 100 - adRatio : 50;

  const avgEarly = pickCount > 0 ? Number((totalEarly / pickCount).toFixed(1)) : 0;
  const avgLate = pickCount > 0 ? Number((totalLate / pickCount).toFixed(1)) : 0;
  const avgMid =
    pickCount > 0 ? Number(((avgEarly + avgLate) / 2).toFixed(1)) : 0;

  const feedbacks: CompFeedback[] = [];

  // 1. 딜 비중 피드백
  if (pickCount >= 3) {
    if (apCount === 0 && mixedCount === 0) {
      feedbacks.push({
        level: 'danger',
        category: 'damage',
        message: '올 AD 조합 위험 — 상대 탱커 방어력 효율이 급증합니다.',
      });
    } else if (adCount === 0 && mixedCount === 0) {
      feedbacks.push({
        level: 'danger',
        category: 'damage',
        message: '올 AP 조합 위험 — 상대 마법 저항력 아이템 효율이 급증합니다.',
      });
    } else if (adRatio >= 75) {
      feedbacks.push({
        level: 'warning',
        category: 'damage',
        message: 'AD 비중 편중 — 남은 픽에서 AP 딜러 보완을 권장합니다.',
      });
    } else if (apRatio >= 75) {
      feedbacks.push({
        level: 'warning',
        category: 'damage',
        message: 'AP 비중 편중 — 남은 픽에서 AD 딜러 보완을 권장합니다.',
      });
    }
  }

  // 2. 조합 균형도 피드백
  if (pickCount >= 3 && totalFrontline < 6) {
    feedbacks.push({
      level: 'warning',
      category: 'balance',
      message: '앞라인(탱킹) 부족 — 한타 구도에서 진형 유지가 어렵습니다.',
    });
  }

  if (pickCount >= 3 && totalEngage < 6) {
    feedbacks.push({
      level: 'warning',
      category: 'balance',
      message: '확정 이니시 수단 부족 — 받아치는 구도가 강제됩니다.',
    });
  }

  if (pickCount >= 4 && totalWaveClear < 10) {
    feedbacks.push({
      level: 'info',
      category: 'balance',
      message: '라인 클리어 다소 부족 — 사이드 운영 및 수성 시 주의가 필요합니다.',
    });
  }

  // 3. 시간대별 파워커브 피드백
  if (pickCount >= 3) {
    if (avgEarly - avgLate >= 0.8) {
      feedbacks.push({
        level: 'info',
        category: 'powerCurve',
        message: '초반 주도권 우세 — 2용·전령 타이밍 전 스노우볼이 핵심입니다.',
      });
    } else if (avgLate - avgEarly >= 0.8) {
      feedbacks.push({
        level: 'info',
        category: 'powerCurve',
        message: '후반 밸류 강점 — 초반 손실을 최소화하며 25분 이후 한타를 노리세요.',
      });
    }
  }

  // 4. 피어리스 자원 소모도 피드백
  if (tankUsedCount >= 2 && gameNumber <= 3) {
    feedbacks.push({
      level: 'warning',
      category: 'fearless',
      message: `이번 세트에 앞라인 탱커 ${tankUsedCount}명 소모 — 후반 세트 탱커 풀 부족이 예상됩니다.`,
    });
  }

  if (highTierUsedCount >= 3 && gameNumber <= 2) {
    feedbacks.push({
      level: 'info',
      category: 'fearless',
      message: `1티어 핵심 카드 ${highTierUsedCount}장 투입 — 다음 세트 대비 플랜 B가 필요합니다.`,
    });
  }

  return {
    pickCount,
    adCount,
    apCount,
    mixedCount,
    adRatio,
    apRatio,
    totalFrontline,
    totalEngage,
    totalWaveClear,
    totalRange,
    powerCurve: {
      early: avgEarly,
      mid: avgMid,
      late: avgLate,
    },
    highTierUsedCount,
    tankUsedCount,
    feedbacks,
  };
}
