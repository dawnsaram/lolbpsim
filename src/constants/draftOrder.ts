import type {
  AiStyle,
  DraftSide,
  DraftStep,
  FearlessRule,
  Role,
} from '@/types/draft';

export const ALL_ROLES: Role[] = ['TOP', 'JGL', 'MID', 'BOT', 'SUP'];

export const ROLE_LABELS: Record<Role, string> = {
  TOP: '탑',
  JGL: '정글',
  MID: '미드',
  BOT: '원딜',
  SUP: '서폿',
};

export const AI_STYLE_META: Record<
  AiStyle,
  { label: string; description: string }
> = {
  META: {
    label: '정석 메타형',
    description: '티어표와 조합 균형 중심의 안정적인 밴픽',
  },
  EARLY: {
    label: '라인전 압박형',
    description: '초반 주도권과 스노우볼 위주의 공격적 밴픽',
  },
  LATE: {
    label: '한타 밸류형',
    description: '후반 캐리력과 광역 CC 위주의 밸류 밴픽',
  },
};

export const FEARLESS_RULE_META: Record<
  FearlessRule,
  { label: string; description: string }
> = {
  NONE: {
    label: '일반 밴픽 (피어리스 OFF)',
    description: '이전 세트 픽 제한 없이 매 세트 전체 챔피언 사용 가능',
  },
  HARD: {
    label: '하드 피어리스',
    description: '양 팀이 이전 세트에서 픽한 모든 챔피언 잠금',
  },
  SOFT: {
    label: '소프트 피어리스',
    description: '우리 팀(블루)이 이전 세트에서 픽한 챔피언만 잠금',
  },
};

/**
 * 표준 토너먼트 5밴 드래프트 순서 (총 20스텝)
 * - BAN_1 (6): B1 -> R1 -> B2 -> R2 -> B3 -> R3
 * - PICK_1 (6): B1 -> R1 -> R2 -> B2 -> B3 -> R3
 * - BAN_2 (4): R4 -> B4 -> R5 -> B5
 * - PICK_2 (4): R4 -> B4 -> B5 -> R5
 */
export const TOURNAMENT_DRAFT_ORDER: DraftStep[] = [
  // Phase 1 Bans
  { index: 0, phase: 'BAN_1', side: 'BLUE', type: 'BAN', slotIndex: 0 },
  { index: 1, phase: 'BAN_1', side: 'RED', type: 'BAN', slotIndex: 0 },
  { index: 2, phase: 'BAN_1', side: 'BLUE', type: 'BAN', slotIndex: 1 },
  { index: 3, phase: 'BAN_1', side: 'RED', type: 'BAN', slotIndex: 1 },
  { index: 4, phase: 'BAN_1', side: 'BLUE', type: 'BAN', slotIndex: 2 },
  { index: 5, phase: 'BAN_1', side: 'RED', type: 'BAN', slotIndex: 2 },
  // Phase 1 Picks
  { index: 6, phase: 'PICK_1', side: 'BLUE', type: 'PICK', slotIndex: 0 },
  { index: 7, phase: 'PICK_1', side: 'RED', type: 'PICK', slotIndex: 0 },
  { index: 8, phase: 'PICK_1', side: 'RED', type: 'PICK', slotIndex: 1 },
  { index: 9, phase: 'PICK_1', side: 'BLUE', type: 'PICK', slotIndex: 1 },
  { index: 10, phase: 'PICK_1', side: 'BLUE', type: 'PICK', slotIndex: 2 },
  { index: 11, phase: 'PICK_1', side: 'RED', type: 'PICK', slotIndex: 2 },
  // Phase 2 Bans
  { index: 12, phase: 'BAN_2', side: 'RED', type: 'BAN', slotIndex: 3 },
  { index: 13, phase: 'BAN_2', side: 'BLUE', type: 'BAN', slotIndex: 3 },
  { index: 14, phase: 'BAN_2', side: 'RED', type: 'BAN', slotIndex: 4 },
  { index: 15, phase: 'BAN_2', side: 'BLUE', type: 'BAN', slotIndex: 4 },
  // Phase 2 Picks
  { index: 16, phase: 'PICK_2', side: 'RED', type: 'PICK', slotIndex: 3 },
  { index: 17, phase: 'PICK_2', side: 'BLUE', type: 'PICK', slotIndex: 3 },
  { index: 18, phase: 'PICK_2', side: 'BLUE', type: 'PICK', slotIndex: 4 },
  { index: 19, phase: 'PICK_2', side: 'RED', type: 'PICK', slotIndex: 4 },
];

/**
 * 선픽 진영(firstPickSide)에 따라 실제 20스텝 드래프트 순서를 반환합니다.
 * - BLUE 선픽: 기본 토너먼트 순서
 * - RED 선픽 (RoFS 등으로 진영과 픽순이 분리된 경우): BLUE/RED 턴을 반전
 */
export function getDraftOrder(firstPickSide: DraftSide = 'BLUE'): DraftStep[] {
  if (firstPickSide === 'BLUE') return TOURNAMENT_DRAFT_ORDER;

  return TOURNAMENT_DRAFT_ORDER.map((step) => ({
    ...step,
    side: step.side === 'BLUE' ? 'RED' : 'BLUE',
  }));
}
