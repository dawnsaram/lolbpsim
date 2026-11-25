import type {
  Champion,
  CompFeedback,
  CompGrade,
  TeamCompAnalysis,
} from '@/types/draft';

const HIGH_DPS_IDS = new Set([
  'Azir',
  'Corki',
  'Yone',
  'Jax',
  'Viego',
  'Rumble',
  'Taliyah',
  'Orianna',
  'Jayce',
]);

/**
 * 챔피언의 지속 딜(DPS, 1~5) 수치를 반환합니다.
 */
export function getChampionDps(champ: Champion): number {
  if (typeof champ.stats.dps === 'number') {
    return champ.stats.dps;
  }

  if (champ.roles.includes('BOT')) return 5;
  if (HIGH_DPS_IDS.has(champ.id)) return 4;
  if (champ.roles.includes('SUP') && champ.stats.frontline >= 3) return 1;
  if (champ.roles.includes('SUP')) return 2;
  if (champ.stats.frontline >= 5) return 2;
  if (champ.roles.includes('MID')) return 3;
  if (champ.roles.includes('TOP') || champ.roles.includes('JGL')) return 3;
  return 3;
}

function getCompGrade(score: number): CompGrade {
  if (score >= 86) return 'S';
  if (score >= 76) return 'A';
  if (score >= 65) return 'B';
  if (score >= 54) return 'C';
  return 'D';
}

/**
 * 현재 팀에 픽된 챔피언 목록을 기반으로 실시간 조합 지표 및 종합 점수를 계산합니다.
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
  let totalDps = 0;
  let totalWaveClear = 0;
  let totalRange = 0;

  let totalEarly = 0;
  let totalLate = 0;
  let totalTierScore = 0;

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
    totalDps += getChampionDps(champ);
    totalWaveClear += champ.stats.waveClear;
    totalRange += champ.stats.range;

    totalEarly += champ.stats.earlyGame;
    totalLate += champ.stats.lateGame;
    totalTierScore += Math.max(0, Math.min(1, (5 - champ.tier) / 4));

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

  // 종합 점수 계산 (100점 만점, 픽 수에 비례 정규화)
  let overallScore = 0;
  if (pickCount > 0) {
    const scale = 5 / pickCount;
    const normFrontline = totalFrontline * scale;
    const normEngage = totalEngage * scale;
    const normDps = totalDps * scale;
    const normWaveClear = totalWaveClear * scale;
    const normRange = totalRange * scale;

    // 1) 딜 밸런스 (최대 20점)
    let damageScore = 20;
    if (pickCount >= 3) {
      if ((apCount === 0 && mixedCount === 0) || (adCount === 0 && mixedCount === 0)) {
        damageScore = 6;
      } else if (adRatio >= 75 || apRatio >= 75) {
        damageScore = 13;
      } else if (adRatio >= 35 && adRatio <= 65) {
        damageScore = 20;
      } else {
        damageScore = 17;
      }
    }

    // 2) 앞라인/탱킹 (최대 18점)
    const frontlineScore = Math.min(18, (normFrontline / 13) * 18);
    // 3) 이니시 (최대 16점)
    const engageScore = Math.min(16, (normEngage / 13) * 16);
    // 4) 지속 딜 DPS (최대 18점)
    const dpsScore = Math.min(18, (normDps / 15) * 18);
    // 5) 라인 클리어 (최대 14점)
    const waveClearScore = Math.min(14, (normWaveClear / 15) * 14);
    // 6) 사거리 + 메타 티어 (최대 14점)
    const rangeScore = Math.min(7, (normRange / 14) * 7);
    const tierScore = (totalTierScore / pickCount) * 7;

    overallScore = Math.round(
      Math.min(
        100,
        damageScore +
          frontlineScore +
          engageScore +
          dpsScore +
          waveClearScore +
          rangeScore +
          tierScore,
      ),
    );
  }

  const grade = getCompGrade(overallScore);

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

  // 2. 조합 균형도 & DPS 피드백
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

  if (pickCount >= 4 && totalDps < 11) {
    feedbacks.push({
      level: 'warning',
      category: 'damage',
      message: '지속 딜(DPS) 부족 — 상대 탱커 돌파 및 오브젝트 버스트가 느립니다.',
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
    totalDps,
    totalWaveClear,
    totalRange,
    powerCurve: {
      early: avgEarly,
      mid: avgMid,
      late: avgLate,
    },
    overallScore,
    grade,
    highTierUsedCount,
    tankUsedCount,
    feedbacks,
  };
}
