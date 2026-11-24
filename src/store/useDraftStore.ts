import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDraftOrder, TOURNAMENT_DRAFT_ORDER } from '@/constants/draftOrder';
import {
  buildChampionMap,
  CURATED_CHAMPIONS,
  getChampionsByIds,
} from '@/data';
import { decideBan, decidePick } from '@/engine/aiEngine';
import {
  fetchAllChampionsMerged,
  getDDragonVersion,
} from '@/services/ddragon';
import {
  roomClient,
  type OnlineRole,
  type RoomPeers,
  type SyncedDraftPayload,
} from '@/services/roomClient';
import type {
  AiStyle,
  Champion,
  DraftMode,
  DraftSide,
  FearlessRule,
  GameRecord,
  Role,
  SeriesFormat,
  SidePickSelectionMode,
} from '@/types/draft';
import { arrangePicksByRole, getAvailablePool } from '@/utils/pool';

export const DEFAULT_TURN_SECONDS = 30;

const DEFAULT_PEERS: RoomPeers = {
  blueConnected: false,
  redConnected: false,
  spectatorCount: 0,
};

interface DraftStoreState {
  // 챔피언 풀 (DDragon 전체 챔피언 병합)
  champions: Champion[];
  championMap: Record<string, Champion>;
  ddragonVersion: string;
  isLoadingChampions: boolean;

  // 온라인 1:1 방 상태 (비영속)
  roomCode: string | null;
  onlineSide: OnlineRole | null;
  roomPeers: RoomPeers;
  roomStatus: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  roomError: string | null;

  // 시리즈 및 1:1 설정
  seriesFormat: SeriesFormat;
  fearlessRule: FearlessRule;
  draftMode: DraftMode;
  selectionMode: SidePickSelectionMode;
  firstPickSide: DraftSide;
  userSide: DraftSide;
  aiStyle: AiStyle;
  blueTeamName: string;
  redTeamName: string;

  // 1:1 밴픽 타이머 설정
  timerEnabled: boolean;
  timerDuration: number;
  timeLeft: number;

  // 현재 세트 상태
  gameNumber: number;
  currentStepIndex: number;
  hoveredChampionId: string | null;
  blueBans: string[];
  redBans: string[];
  bluePicks: string[];
  redPicks: string[];
  currentWinner: DraftSide | null;

  // 이전 세트 기록 (다전제 히스토리 & What-if 분기)
  history: GameRecord[];

  // UI 필터 상태
  selectedRole: Role | 'ALL';
  searchQuery: string;

  // Actions
  loadAllChampions: () => Promise<void>;
  createOnlineRoom: (hostSide?: DraftSide) => Promise<boolean>;
  joinOnlineRoom: (roomCode: string) => Promise<boolean>;
  leaveOnlineRoom: () => void;
  clearRoomError: () => void;

  setSeriesFormat: (format: SeriesFormat) => void;
  setFearlessRule: (rule: FearlessRule) => void;
  setDraftMode: (mode: DraftMode) => void;
  setSelectionMode: (mode: SidePickSelectionMode) => void;
  setFirstPickSide: (side: DraftSide) => void;
  setUserSide: (side: DraftSide) => void;
  setAiStyle: (style: AiStyle) => void;
  setTeamName: (side: DraftSide, name: string) => void;
  swapSides: () => void;
  setTimerEnabled: (enabled: boolean) => void;
  tickTimer: () => void;
  setSelectedRole: (role: Role | 'ALL') => void;
  setSearchQuery: (query: string) => void;

  hoverChampion: (championId: string | null) => void;
  confirmSelection: () => void;
  selectChampion: (championId: string) => void;
  swapPickSlots: (side: DraftSide, fromIndex: number, toIndex: number) => void;
  getAiDecision: () => string | null;
  runAiTurn: () => void;
  undoLastAction: () => void;
  setCurrentWinner: (winner: DraftSide) => void;
  proceedToNextGame: (swapNextSides?: boolean) => void;
  branchFromGame: (targetGameNumber: number) => void;
  resetCurrentGame: () => void;
  resetSeries: () => void;
}

export function getMaxGames(format: SeriesFormat): number {
  if (format === 'BO1') return 1;
  if (format === 'BO3') return 3;
  return 5;
}

export function getFearlessLockedIds(
  history: GameRecord[],
  fearlessRule: FearlessRule,
  userSide: DraftSide,
): Set<string> {
  const locked = new Set<string>();
  if (fearlessRule === 'NONE') return locked;

  for (const record of history) {
    if (fearlessRule === 'HARD') {
      record.bluePicks.forEach((id) => locked.add(id));
      record.redPicks.forEach((id) => locked.add(id));
    } else {
      const targetPicks =
        userSide === 'BLUE' ? record.bluePicks : record.redPicks;
      targetPicks.forEach((id) => locked.add(id));
    }
  }

  return locked;
}

function buildSyncedPayload(state: DraftStoreState): SyncedDraftPayload {
  return {
    seriesFormat: state.seriesFormat,
    fearlessRule: state.fearlessRule,
    firstPickSide: state.firstPickSide,
    blueTeamName: state.blueTeamName,
    redTeamName: state.redTeamName,
    timerEnabled: state.timerEnabled,
    timeLeft: state.timeLeft,
    gameNumber: state.gameNumber,
    currentStepIndex: state.currentStepIndex,
    hoveredChampionId: state.hoveredChampionId,
    blueBans: state.blueBans,
    redBans: state.redBans,
    bluePicks: state.bluePicks,
    redPicks: state.redPicks,
    currentWinner: state.currentWinner,
    history: state.history,
  };
}

let isListenerBound = false;

function ensureRoomListeners(
  set: (partial: Partial<DraftStoreState>) => void,
) {
  if (isListenerBound) return;
  isListenerBound = true;

  roomClient.onMessage((msg) => {
    if (msg.type === 'STATE_UPDATED') {
      set({ ...msg.state });
      return;
    }

    if (msg.type === 'PEERS_UPDATED') {
      set({ roomPeers: msg.peers });
      return;
    }

    if (msg.type === 'SIDE_ASSIGNED') {
      set({
        onlineSide: msg.assignedSide,
        ...(msg.assignedSide === 'BLUE' || msg.assignedSide === 'RED'
          ? { userSide: msg.assignedSide }
          : {}),
      });
      return;
    }

    if (msg.type === 'ERROR') {
      set({ roomError: msg.message, roomStatus: 'ERROR' });
    }
  });

  roomClient.onClose(() => {
    set({
      roomStatus: 'IDLE',
      roomPeers: DEFAULT_PEERS,
    });
  });
}

function syncIfOnline(get: () => DraftStoreState) {
  const state = get();
  if (state.draftMode === 'VS_1V1' && state.roomCode) {
    roomClient.send({
      type: 'SYNC_STATE',
      roomCode: state.roomCode,
      state: buildSyncedPayload(state),
    });
  }
}

export const useDraftStore = create<DraftStoreState>()(
  persist(
    (set, get) => ({
      champions: CURATED_CHAMPIONS,
      championMap: buildChampionMap(CURATED_CHAMPIONS),
      ddragonVersion: getDDragonVersion(),
      isLoadingChampions: false,

      roomCode: null,
      onlineSide: null,
      roomPeers: DEFAULT_PEERS,
      roomStatus: 'IDLE',
      roomError: null,

      seriesFormat: 'BO5',
      fearlessRule: 'HARD',
      draftMode: 'VS_1V1',
      selectionMode: 'MANUAL',
      firstPickSide: 'BLUE',
      userSide: 'BLUE',
      aiStyle: 'META',
      blueTeamName: 'BLUE TEAM',
      redTeamName: 'RED TEAM',

      timerEnabled: true,
      timerDuration: DEFAULT_TURN_SECONDS,
      timeLeft: DEFAULT_TURN_SECONDS,

      gameNumber: 1,
      currentStepIndex: 0,
      hoveredChampionId: null,
      blueBans: [],
      redBans: [],
      bluePicks: [],
      redPicks: [],
      currentWinner: null,
      history: [],

      selectedRole: 'ALL',
      searchQuery: '',

      loadAllChampions: async () => {
        set({ isLoadingChampions: true });
        const { version, champions } =
          await fetchAllChampionsMerged(CURATED_CHAMPIONS);
        set({
          ddragonVersion: version,
          champions,
          championMap: buildChampionMap(champions),
          isLoadingChampions: false,
        });
      },

      createOnlineRoom: async (hostSide = 'BLUE') => {
        ensureRoomListeners(set);
        set({
          roomStatus: 'CONNECTING',
          roomError: null,
          draftMode: 'VS_1V1',
          userSide: hostSide,
          gameNumber: 1,
          currentStepIndex: 0,
          hoveredChampionId: null,
          blueBans: [],
          redBans: [],
          bluePicks: [],
          redPicks: [],
          currentWinner: null,
          history: [],
          timeLeft: get().timerDuration,
        });

        try {
          await roomClient.connect();
        } catch (err) {
          set({
            roomStatus: 'ERROR',
            roomError:
              err instanceof Error ? err.message : '방 서버 연결에 실패했습니다.',
          });
          return false;
        }

        return new Promise<boolean>((resolve) => {
          const unsubscribe = roomClient.onMessage((msg) => {
            if (msg.type === 'ROOM_CREATED') {
              unsubscribe();
              set({
                roomCode: msg.roomCode,
                onlineSide: msg.assignedSide,
                roomPeers: msg.peers,
                roomStatus: 'CONNECTED',
                roomError: null,
              });
              resolve(true);
            } else if (msg.type === 'ERROR') {
              unsubscribe();
              set({ roomStatus: 'ERROR', roomError: msg.message });
              resolve(false);
            }
          });

          roomClient.send({
            type: 'CREATE_ROOM',
            hostSide,
            initialState: buildSyncedPayload(get()),
          });
        });
      },

      joinOnlineRoom: async (rawCode) => {
        const roomCode = rawCode.trim().toUpperCase();
        if (!roomCode) {
          set({ roomError: '방 코드를 입력해 주세요.' });
          return false;
        }

        ensureRoomListeners(set);
        set({ roomStatus: 'CONNECTING', roomError: null, draftMode: 'VS_1V1' });

        try {
          await roomClient.connect();
        } catch (err) {
          set({
            roomStatus: 'ERROR',
            roomError:
              err instanceof Error ? err.message : '방 서버 연결에 실패했습니다.',
          });
          return false;
        }

        return new Promise<boolean>((resolve) => {
          const unsubscribe = roomClient.onMessage((msg) => {
            if (msg.type === 'ROOM_JOINED') {
              unsubscribe();
              set({
                ...(msg.state ?? {}),
                draftMode: 'VS_1V1',
                roomCode: msg.roomCode,
                onlineSide: msg.assignedSide,
                ...(msg.assignedSide === 'BLUE' || msg.assignedSide === 'RED'
                  ? { userSide: msg.assignedSide }
                  : {}),
                roomPeers: msg.peers,
                roomStatus: 'CONNECTED',
                roomError: null,
              });
              resolve(true);
            } else if (msg.type === 'ERROR') {
              unsubscribe();
              set({ roomStatus: 'ERROR', roomError: msg.message });
              resolve(false);
            }
          });

          roomClient.send({
            type: 'JOIN_ROOM',
            roomCode,
          });
        });
      },

      leaveOnlineRoom: () => {
        roomClient.disconnect();
        set({
          roomCode: null,
          onlineSide: null,
          roomPeers: DEFAULT_PEERS,
          roomStatus: 'IDLE',
          roomError: null,
        });
      },

      clearRoomError: () => set({ roomError: null }),

      setSeriesFormat: (seriesFormat) => {
        set({ seriesFormat });
        syncIfOnline(get);
      },
      setFearlessRule: (fearlessRule) => {
        set({ fearlessRule });
        syncIfOnline(get);
      },
      setDraftMode: (draftMode) =>
        set((state) => ({
          draftMode,
          hoveredChampionId: null,
          timeLeft: state.timerDuration,
        })),
      setSelectionMode: (selectionMode) => set({ selectionMode }),
      setFirstPickSide: (firstPickSide) => {
        set({ firstPickSide });
        syncIfOnline(get);
      },
      setUserSide: (userSide) => set({ userSide }),
      setAiStyle: (aiStyle) => set({ aiStyle }),
      setTeamName: (side, name) => {
        set(side === 'BLUE' ? { blueTeamName: name } : { redTeamName: name });
        syncIfOnline(get);
      },

      swapSides: () => {
        const state = get();
        set({
          blueTeamName: state.redTeamName,
          redTeamName: state.blueTeamName,
          userSide: state.userSide === 'BLUE' ? 'RED' : 'BLUE',
        });
        if (state.draftMode === 'VS_1V1' && state.roomCode) {
          roomClient.send({ type: 'SWAP_ROOM_SIDES' });
          syncIfOnline(get);
        }
      },

      setTimerEnabled: (timerEnabled) => {
        set((state) => ({
          timerEnabled,
          timeLeft: state.timerDuration,
        }));
        syncIfOnline(get);
      },

      tickTimer: () => {
        const state = get();
        if (!state.timerEnabled) return;

        const step = getDraftOrder(state.firstPickSide)[state.currentStepIndex];
        if (!step) return;

        if (state.draftMode === 'SOLO_AI' && step.side !== state.userSide) {
          return;
        }

        // 온라인 1:1에서는 현재 턴 주인만 타임아웃 확정 실행
        if (
          state.draftMode === 'VS_1V1' &&
          state.roomCode &&
          state.onlineSide !== step.side
        ) {
          if (state.timeLeft > 1) {
            set({ timeLeft: state.timeLeft - 1 });
          }
          return;
        }

        if (state.timeLeft > 1) {
          set({ timeLeft: state.timeLeft - 1 });
          return;
        }

        if (state.hoveredChampionId) {
          state.selectChampion(state.hoveredChampionId);
          return;
        }

        const available = getAvailablePool(
          state.champions,
          new Set([...state.blueBans, ...state.redBans]),
          getFearlessLockedIds(state.history, state.fearlessRule, state.userSide),
          new Set([...state.bluePicks, ...state.redPicks]),
        );

        if (available.length > 0) {
          const randomChamp =
            available[Math.floor(Math.random() * available.length)];
          state.selectChampion(randomChamp.id);
        }
      },

      setSelectedRole: (selectedRole) => set({ selectedRole }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      hoverChampion: (championId) => {
        set({ hoveredChampionId: championId });
        syncIfOnline(get);
      },

      confirmSelection: () => {
        const state = get();
        if (!state.hoveredChampionId) return;
        state.selectChampion(state.hoveredChampionId);
      },

      selectChampion: (championId) => {
        const state = get();
        const step = getDraftOrder(state.firstPickSide)[state.currentStepIndex];
        if (!step) return;

        const lockedIds = getFearlessLockedIds(
          state.history,
          state.fearlessRule,
          state.userSide,
        );
        const alreadyUsed = new Set([
          ...state.blueBans,
          ...state.redBans,
          ...state.bluePicks,
          ...state.redPicks,
        ]);

        if (lockedIds.has(championId) || alreadyUsed.has(championId)) {
          return;
        }

        const nextStepIndex = state.currentStepIndex + 1;
        const nextState: Partial<DraftStoreState> = {
          currentStepIndex: nextStepIndex,
          hoveredChampionId: null,
          timeLeft: state.timerDuration,
        };

        if (step.side === 'BLUE' && step.type === 'BAN') {
          nextState.blueBans = [...state.blueBans, championId];
        } else if (step.side === 'RED' && step.type === 'BAN') {
          nextState.redBans = [...state.redBans, championId];
        } else if (step.side === 'BLUE' && step.type === 'PICK') {
          nextState.bluePicks = [...state.bluePicks, championId];
        } else if (step.side === 'RED' && step.type === 'PICK') {
          nextState.redPicks = [...state.redPicks, championId];
        }

        // 솔로(vs AI) 모드에서 20스텝(밴픽) 완료 시 AI 진영 자동 포지션 스왑
        if (
          nextStepIndex === TOURNAMENT_DRAFT_ORDER.length &&
          state.draftMode === 'SOLO_AI'
        ) {
          const aiSide: DraftSide = state.userSide === 'BLUE' ? 'RED' : 'BLUE';
          if (aiSide === 'BLUE') {
            const finalBlue = nextState.bluePicks ?? state.bluePicks;
            nextState.bluePicks = arrangePicksByRole(
              finalBlue,
              state.championMap,
            );
          } else {
            const finalRed = nextState.redPicks ?? state.redPicks;
            nextState.redPicks = arrangePicksByRole(
              finalRed,
              state.championMap,
            );
          }
        }

        set(nextState);
        syncIfOnline(get);
      },

      swapPickSlots: (side, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const state = get();
        const picks = side === 'BLUE' ? [...state.bluePicks] : [...state.redPicks];
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= picks.length ||
          toIndex >= picks.length
        ) {
          return;
        }

        [picks[fromIndex], picks[toIndex]] = [picks[toIndex], picks[fromIndex]];

        set(side === 'BLUE' ? { bluePicks: picks } : { redPicks: picks });
        syncIfOnline(get);
      },

      getAiDecision: () => {
        const state = get();
        if (state.draftMode !== 'SOLO_AI') return null;

        const step = getDraftOrder(state.firstPickSide)[state.currentStepIndex];
        if (!step || step.side === state.userSide) return null;

        const aiSide = step.side;
        const aiPickIds = aiSide === 'BLUE' ? state.bluePicks : state.redPicks;
        const enemyPickIds =
          aiSide === 'BLUE' ? state.redPicks : state.bluePicks;

        const context = {
          gameNumber: state.gameNumber,
          phase: step.phase,
          aiPicks: getChampionsByIds(aiPickIds, state.championMap),
          enemyPicks: getChampionsByIds(enemyPickIds, state.championMap),
          bannedIds: new Set([...state.blueBans, ...state.redBans]),
          fearlessLockedIds: getFearlessLockedIds(
            state.history,
            state.fearlessRule,
            state.userSide,
          ),
          aiStyle: state.aiStyle,
        };

        const decision =
          step.type === 'BAN'
            ? decideBan(state.champions, context)
            : decidePick(state.champions, context);

        return decision ? decision.id : null;
      },

      runAiTurn: () => {
        const decisionId = get().getAiDecision();
        if (decisionId) {
          get().selectChampion(decisionId);
        }
      },

      undoLastAction: () => {
        const state = get();
        if (state.currentStepIndex === 0) return;

        const prevIndex = state.currentStepIndex - 1;
        const prevStep = getDraftOrder(state.firstPickSide)[prevIndex];
        if (!prevStep) return;

        const nextState: Partial<DraftStoreState> = {
          currentStepIndex: prevIndex,
          hoveredChampionId: null,
          currentWinner: null,
          timeLeft: state.timerDuration,
        };

        if (prevStep.side === 'BLUE' && prevStep.type === 'BAN') {
          nextState.blueBans = state.blueBans.slice(0, -1);
        } else if (prevStep.side === 'RED' && prevStep.type === 'BAN') {
          nextState.redBans = state.redBans.slice(0, -1);
        } else if (prevStep.side === 'BLUE' && prevStep.type === 'PICK') {
          nextState.bluePicks = state.bluePicks.slice(0, -1);
        } else if (prevStep.side === 'RED' && prevStep.type === 'PICK') {
          nextState.redPicks = state.redPicks.slice(0, -1);
        }

        set(nextState);
        syncIfOnline(get);
      },

      setCurrentWinner: (currentWinner) => {
        set({ currentWinner });
        syncIfOnline(get);
      },

      proceedToNextGame: (swapNextSides = false) => {
        const state = get();
        const maxGames = getMaxGames(state.seriesFormat);
        if (state.gameNumber >= maxGames) return;

        const record: GameRecord = {
          gameNumber: state.gameNumber,
          blueTeamName: state.blueTeamName,
          redTeamName: state.redTeamName,
          blueBans: state.blueBans,
          redBans: state.redBans,
          bluePicks: state.bluePicks,
          redPicks: state.redPicks,
          winner: state.currentWinner ?? undefined,
        };

        set({
          history: [...state.history, record],
          gameNumber: state.gameNumber + 1,
          currentStepIndex: 0,
          hoveredChampionId: null,
          blueBans: [],
          redBans: [],
          bluePicks: [],
          redPicks: [],
          currentWinner: null,
          timeLeft: state.timerDuration,
          ...(swapNextSides
            ? {
              blueTeamName: state.redTeamName,
              redTeamName: state.blueTeamName,
              userSide: state.userSide === 'BLUE' ? 'RED' : 'BLUE',
            }
            : {}),
        });

        if (swapNextSides && state.draftMode === 'VS_1V1' && state.roomCode) {
          roomClient.send({ type: 'SWAP_ROOM_SIDES' });
        }
        syncIfOnline(get);
      },

      branchFromGame: (targetGameNumber) => {
        const state = get();
        const keptHistory = state.history.filter(
          (record) => record.gameNumber < targetGameNumber,
        );
        set({
          history: keptHistory,
          gameNumber: targetGameNumber,
          currentStepIndex: 0,
          hoveredChampionId: null,
          blueBans: [],
          redBans: [],
          bluePicks: [],
          redPicks: [],
          currentWinner: null,
          timeLeft: state.timerDuration,
        });
        syncIfOnline(get);
      },

      resetCurrentGame: () => {
        set((state) => ({
          currentStepIndex: 0,
          hoveredChampionId: null,
          blueBans: [],
          redBans: [],
          bluePicks: [],
          redPicks: [],
          currentWinner: null,
          timeLeft: state.timerDuration,
        }));
        syncIfOnline(get);
      },

      resetSeries: () => {
        set((state) => ({
          gameNumber: 1,
          currentStepIndex: 0,
          hoveredChampionId: null,
          blueBans: [],
          redBans: [],
          bluePicks: [],
          redPicks: [],
          currentWinner: null,
          history: [],
          timeLeft: state.timerDuration,
        }));
        syncIfOnline(get);
      },
    }),
    {
      name: 'lol-fearless-draft-sim-v2',
      partialize: (state) => ({
        seriesFormat: state.seriesFormat,
        fearlessRule: state.fearlessRule,
        draftMode: state.draftMode,
        selectionMode: state.selectionMode,
        firstPickSide: state.firstPickSide,
        userSide: state.userSide,
        aiStyle: state.aiStyle,
        blueTeamName: state.blueTeamName,
        redTeamName: state.redTeamName,
        timerEnabled: state.timerEnabled,
        gameNumber: state.gameNumber,
        currentStepIndex: state.currentStepIndex,
        blueBans: state.blueBans,
        redBans: state.redBans,
        bluePicks: state.bluePicks,
        redPicks: state.redPicks,
        currentWinner: state.currentWinner,
        history: state.history,
      }),
    },
  ),
);
