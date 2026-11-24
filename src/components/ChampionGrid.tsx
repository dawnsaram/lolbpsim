import {
  ALL_ROLES,
  ROLE_LABELS,
  TOURNAMENT_DRAFT_ORDER,
} from '@/constants/draftOrder';
import { getChampionIconUrl } from '@/services/ddragon';
import { getFearlessLockedIds, useDraftStore } from '@/store/useDraftStore';
import { matchesChampionQuery } from '@/utils/hangul';
import { Check, Lock, Search, Timer } from 'lucide-react';

export function ChampionGrid() {
  const {
    champions,
    championMap,
    ddragonVersion,
    isLoadingChampions,
    roomCode,
    onlineSide,
    roomPeers,
    currentStepIndex,
    hoveredChampionId,
    blueTeamName,
    redTeamName,
    blueBans,
    redBans,
    bluePicks,
    redPicks,
    history,
    fearlessRule,
    userSide,
    draftMode,
    timerEnabled,
    timerDuration,
    timeLeft,
    selectedRole,
    searchQuery,
    setSelectedRole,
    setSearchQuery,
    hoverChampion,
    confirmSelection,
    selectChampion,
  } = useDraftStore();

  const currentStep = TOURNAMENT_DRAFT_ORDER[currentStepIndex];
  const isAiTurn =
    draftMode === 'SOLO_AI' &&
    Boolean(currentStep) &&
    currentStep.side !== userSide;

  const isOnlineRoom = draftMode === 'VS_1V1' && Boolean(roomCode);
  const isWaitingForOpponent =
    isOnlineRoom && (!roomPeers.blueConnected || !roomPeers.redConnected);
  const isNotMyOnlineTurn =
    isOnlineRoom &&
    Boolean(currentStep) &&
    currentStep.side !== onlineSide;
  const isInteractionLocked = isAiTurn || isNotMyOnlineTurn;

  const activeTeamName = currentStep
    ? currentStep.side === 'BLUE'
      ? blueTeamName
      : redTeamName
    : '';

  const hoveredChamp = hoveredChampionId
    ? championMap[hoveredChampionId]
    : undefined;

  const fearlessLockedIds = getFearlessLockedIds(
    history,
    fearlessRule,
    userSide,
  );
  const currentUsedIds = new Set([
    ...blueBans,
    ...redBans,
    ...bluePicks,
    ...redPicks,
  ]);

  const filteredChampions = champions.filter((champ) => {
    const roleMatch =
      selectedRole === 'ALL' || champ.roles.includes(selectedRole);
    const queryMatch = matchesChampionQuery(
      champ.nameKo,
      champ.name,
      searchQuery,
    );
    return roleMatch && queryMatch;
  });

  const timerRatio = Math.max(
    0,
    Math.min(100, (timeLeft / timerDuration) * 100),
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
      {/* 온라인 상대방 대기 안내 */}
      {isWaitingForOpponent && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          상대방 접속 대기 중입니다. 상단 방 코드{' '}
          <strong className="font-extrabold tracking-wider text-amber-300">
            {roomCode}
          </strong>
          를 상대방에게 공유해 주세요.
        </div>
      )}

      {/* 현재 턴 상태 + 타이머 */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold">
            {currentStep ? (
              <span
                className={
                  currentStep.side === 'BLUE' ? 'text-sky-400' : 'text-rose-400'
                }
              >
                {activeTeamName} · {currentStep.type} ({currentStep.phase})
                {isAiTurn
                  ? ' · AI 고민 중...'
                  : isNotMyOnlineTurn
                    ? onlineSide === 'SPECTATOR'
                      ? ' · 관전 중'
                      : ' · 상대방 선택 중...'
                    : ''}
              </span>
            ) : (
              <span className="text-emerald-400">
                현재 세트 밴픽이 완료되었습니다.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {timerEnabled && currentStep && !isAiTurn && (
              <div
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${
                  timeLeft <= 7
                    ? 'bg-rose-950/80 text-rose-300'
                    : 'bg-slate-900 text-amber-300'
                }`}
              >
                <Timer className="h-3.5 w-3.5" />
                {timeLeft}s
              </div>
            )}
            <span className="text-[11px] text-slate-400">
              {isLoadingChampions
                ? '전체 챔피언 불러오는 중...'
                : `챔피언 ${filteredChampions.length}/${champions.length} · 잠금 ${fearlessLockedIds.size}`}
            </span>
          </div>
        </div>

        {/* 카운트다운 진행 바 */}
        {timerEnabled && currentStep && !isAiTurn && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                timeLeft <= 7 ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{ width: `${timerRatio}%` }}
            />
          </div>
        )}
      </div>

      {/* 포지션 필터 + 한글 초성 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedRole('ALL')}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              selectedRole === 'ALL'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            전체
          </button>
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                selectedRole === role
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="relative min-w-[170px] flex-1 sm:max-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색 (초성: ㄹㅅ, ㅋㅅㅌ)"
            className="w-full rounded-md border border-slate-700 bg-slate-950 py-1 pl-8 pr-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 챔피언 그리드 (롤 클라이언트 중앙 창 스타일) */}
      <div className="grid h-[380px] content-start grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-7 xl:grid-cols-8">
        {filteredChampions.map((champ) => {
          const isFearlessLocked = fearlessLockedIds.has(champ.id);
          const isCurrentUsed = currentUsedIds.has(champ.id);
          const isHovered = hoveredChampionId === champ.id;
          const disabled =
            !currentStep ||
            isInteractionLocked ||
            isFearlessLocked ||
            isCurrentUsed;

          return (
            <button
              key={champ.id}
              type="button"
              disabled={disabled}
              onClick={() => hoverChampion(champ.id)}
              onDoubleClick={() => selectChampion(champ.id)}
              title={`${champ.nameKo} (${champ.roles.join('/')}) — 클릭: 임시 선택 / 더블클릭: 즉시 확정`}
              className={`group relative flex flex-col items-center gap-0.5 rounded-md border p-1 text-center transition ${
                isFearlessLocked
                  ? 'border-amber-900/60 bg-slate-950/90 opacity-45'
                  : isCurrentUsed
                    ? 'border-slate-800 bg-slate-950/90 opacity-35'
                    : isHovered
                      ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400'
                      : 'border-slate-800 bg-slate-950/60 hover:border-sky-500 hover:bg-slate-800/80'
              }`}
            >
              <div className="relative aspect-square w-full max-w-[52px] overflow-hidden rounded bg-slate-900">
                <img
                  src={getChampionIconUrl(champ.id, ddragonVersion)}
                  alt={champ.nameKo}
                  loading="lazy"
                  className={`h-full w-full object-cover ${
                    isFearlessLocked || isCurrentUsed ? 'grayscale' : ''
                  }`}
                />
                {isFearlessLocked && (
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-amber-400">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <span className="w-full truncate text-[10px] font-medium text-slate-200">
                {champ.nameKo}
              </span>
            </button>
          );
        })}
      </div>

      {/* 하단 중앙 확정(Lock-in) 버튼 — 실제 롤 클라이언트 위치 */}
      {currentStep && !isInteractionLocked && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={!hoveredChamp}
            onClick={confirmSelection}
            className={`inline-flex min-w-[200px] items-center justify-center gap-1.5 rounded-lg px-6 py-2 text-xs font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
              currentStep.type === 'BAN'
                ? 'bg-rose-500 text-slate-950 hover:bg-rose-400'
                : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            }`}
          >
            <Check className="h-4 w-4" />
            {hoveredChamp
              ? `${hoveredChamp.nameKo} ${currentStep.type === 'BAN' ? '밴' : '픽'} 확정`
              : `챔피언을 선택하세요 (${currentStep.type === 'BAN' ? '밴' : '픽'})`}
          </button>
        </div>
      )}
    </section>
  );
}
