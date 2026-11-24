export type Role = 'TOP' | 'JGL' | 'MID' | 'BOT' | 'SUP';

export type DamageType = 'AD' | 'AP' | 'MIXED';

export type DraftSide = 'BLUE' | 'RED';

export type DraftActionType = 'BAN' | 'PICK';

export type DraftPhase = 'BAN_1' | 'PICK_1' | 'BAN_2' | 'PICK_2' | 'COMPLETE';

export type FearlessRule = 'NONE' | 'HARD' | 'SOFT';

export type AiStyle = 'META' | 'EARLY' | 'LATE';

export type DraftMode = 'SOLO_AI' | 'VS_1V1' | 'MANUAL';

export type SeriesFormat = 'BO1' | 'BO3' | 'BO5';

export type SidePickSelectionMode = 'MANUAL' | 'COIN_TOSS' | 'ROFS';

export type RofsCategory = 'SIDE' | 'PICK_ORDER';

export interface ChampionStats {
  /** 앞라인/탱킹 (0~5) */
  frontline: number;
  /** 이니시에이팅 (0~5) */
  engage: number;
  /** 라인 클리어 (0~5) */
  waveClear: number;
  /** 사거리/포킹 (0~5) */
  range: number;
  /** 초반 주도권 (0~5) */
  earlyGame: number;
  /** 후반 밸류 (0~5) */
  lateGame: number;
}

export interface Champion {
  /** Riot Data Dragon ID (e.g. "LeeSin", "KSante") */
  id: string;
  /** 영문 이름 */
  name: string;
  /** 한글 이름 */
  nameKo: string;
  /** 주/부 포지션 목록 */
  roles: Role[];
  /** 1.0(OP) ~ 5.0(비주류) */
  tier: number;
  damageType: DamageType;
  stats: ChampionStats;
  /** 카운터 치는 챔피언 ID 목록 */
  counters: string[];
  /** 시너지가 좋은 챔피언 ID 목록 */
  synergies: string[];
}

export interface DraftStep {
  index: number;
  phase: Exclude<DraftPhase, 'COMPLETE'>;
  side: DraftSide;
  type: DraftActionType;
  slotIndex: number;
}

export interface GameRecord {
  gameNumber: number;
  blueTeamName: string;
  redTeamName: string;
  blueBans: string[];
  redBans: string[];
  bluePicks: string[];
  redPicks: string[];
  winner?: DraftSide;
}

export interface AiDraftContext {
  gameNumber: number;
  phase: Exclude<DraftPhase, 'COMPLETE'>;
  aiPicks: Champion[];
  enemyPicks: Champion[];
  bannedIds: Set<string>;
  fearlessLockedIds: Set<string>;
  aiStyle: AiStyle;
}

export interface CompFeedback {
  level: 'info' | 'warning' | 'danger';
  category: 'damage' | 'balance' | 'powerCurve' | 'fearless';
  message: string;
}

export interface TeamCompAnalysis {
  pickCount: number;
  adCount: number;
  apCount: number;
  mixedCount: number;
  adRatio: number;
  apRatio: number;
  totalFrontline: number;
  totalEngage: number;
  totalWaveClear: number;
  totalRange: number;
  powerCurve: {
    early: number;
    mid: number;
    late: number;
  };
  highTierUsedCount: number;
  tankUsedCount: number;
  feedbacks: CompFeedback[];
}

export interface PoolWarning {
  role: Role;
  remainingHighTier: number;
  severity: 'warning' | 'critical';
  message: string;
}
