import { useState } from 'react';
import {
  ALL_ROLES,
  getDraftOrder,
  ROLE_LABELS,
  TOURNAMENT_DRAFT_ORDER,
} from '@/constants/draftOrder';
import { getChampionIconUrl } from '@/services/ddragon';
import { getMaxGames, useDraftStore } from '@/store/useDraftStore';
import type { DraftSide } from '@/types/draft';
import { ArrowLeftRight, ArrowUpDown, SkipForward, Trophy } from 'lucide-react';

interface SidePanelProps {
  side: DraftSide;
}

export function SidePanel({ side }: SidePanelProps) {
  const {
    championMap,
    ddragonVersion,
    draftMode,
    firstPickSide,
    roomCode,
    onlineSide,
    currentStepIndex,
    hoveredChampionId,
    blueTeamName,
    redTeamName,
    blueBans,
    redBans,
    bluePicks,
    redPicks,
    swapPickSlots,
  } = useDraftStore();

  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);

  const canSwapThisSide =
    !(draftMode === 'VS_1V1' && roomCode) || onlineSide === side;

  const currentStep = getDraftOrder(firstPickSide)[currentStepIndex];
  const isBlue = side === 'BLUE';
  const teamName = isBlue ? blueTeamName : redTeamName;
  const bans = isBlue ? blueBans : redBans;
  const picks = isBlue ? bluePicks : redPicks;

  const accentBorder = isBlue ? 'border-sky-500/70' : 'border-rose-500/70';
  const accentText = isBlue ? 'text-sky-400' : 'text-rose-400';

  const activeSwapSource =
    swapSourceIndex !== null &&
    picks.length >= 2 &&
    swapSourceIndex < picks.length
      ? swapSourceIndex
      : null;

  const handleSlotSwapClick = (idx: number) => {
    if (idx >= picks.length) return;

    if (activeSwapSource === null) {
      setSwapSourceIndex(idx);
      return;
    }

    if (activeSwapSource === idx) {
      setSwapSourceIndex(null);
      return;
    }

    swapPickSlots(side, activeSwapSource, idx);
    setSwapSourceIndex(null);
  };

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div
        className={`flex items-center justify-between ${
          isBlue ? '' : 'flex-row-reverse'
        }`}
      >
        <div
          className={`flex items-center gap-1.5 ${
            isBlue ? '' : 'flex-row-reverse'
          }`}
        >
          <h2 className={`truncate text-sm font-bold tracking-wide ${accentText}`}>
            {teamName || (isBlue ? 'BLUE SIDE' : 'RED SIDE')}
          </h2>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            {side}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              firstPickSide === side
                ? 'bg-amber-400/20 text-amber-300'
                : 'bg-slate-800/80 text-slate-400'
            }`}
          >
            {firstPickSide === side ? '선픽' : '후픽'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {picks.length}/5
        </span>
      </div>

      {/* 밴 슬롯 (5개) */}
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }, (_, idx) => {
          const isActive =
            currentStep?.side === side &&
            currentStep?.type === 'BAN' &&
            currentStep?.slotIndex === idx;
          const champId = bans[idx] ?? (isActive ? hoveredChampionId : undefined);
          const isPreview = !bans[idx] && isActive && Boolean(hoveredChampionId);
          const champ = champId ? championMap[champId] : undefined;

          return (
            <div
              key={idx}
              className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-slate-950/80 ${
                isActive
                  ? `${accentBorder} ring-2 ring-amber-400/80`
                  : 'border-slate-800'
              }`}
              title={champ ? `BAN: ${champ.nameKo}` : `BAN ${idx + 1}`}
            >
              {champ ? (
                <>
                  <img
                    src={getChampionIconUrl(champ.id, ddragonVersion)}
                    alt={champ.nameKo}
                    className={`h-full w-full object-cover ${
                      isPreview ? 'opacity-85' : 'opacity-50 grayscale'
                    }`}
                  />
                  {isPreview && (
                    <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[8px] font-bold text-slate-950">
                      임시
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-slate-600">B{idx + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 포지션 스왑 안내 */}
      {canSwapThisSide && picks.length >= 2 && (
        <div
          className={`flex items-center justify-between rounded bg-slate-950/60 px-2 py-1 text-[10px] text-slate-400 ${
            isBlue ? '' : 'flex-row-reverse'
          }`}
        >
          <span>
            {activeSwapSource !== null
              ? `${ROLE_LABELS[ALL_ROLES[activeSwapSource]]}와(과) 바꿀 슬롯 선택`
              : '포지션 스왑 가능'}
          </span>
          {activeSwapSource !== null && (
            <button
              type="button"
              onClick={() => setSwapSourceIndex(null)}
              className="text-amber-300 hover:underline"
            >
              취소
            </button>
          )}
        </div>
      )}

      {/* 픽 슬롯 (5개, 레드 진영은 우측 정렬로 롤 클라이언트 스타일 미러링) */}
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: 5 }, (_, idx) => {
          const isActive =
            currentStep?.side === side &&
            currentStep?.type === 'PICK' &&
            currentStep?.slotIndex === idx;
          const isPicked = idx < picks.length;
          const champId = picks[idx] ?? (isActive ? hoveredChampionId : undefined);
          const isPreview = !picks[idx] && isActive && Boolean(hoveredChampionId);
          const champ = champId ? championMap[champId] : undefined;
          const slotRole = ALL_ROLES[idx];
          const isSwapSource = activeSwapSource === idx;
          const isSwapTarget =
            activeSwapSource !== null && activeSwapSource !== idx && isPicked;

          return (
            <div
              key={idx}
              onClick={() => {
                if (isSwapTarget) handleSlotSwapClick(idx);
              }}
              className={`flex items-center gap-2.5 rounded-lg border p-2 transition ${
                isBlue ? '' : 'flex-row-reverse text-right'
              } ${
                isSwapSource
                  ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400'
                  : isSwapTarget
                    ? 'cursor-pointer border-emerald-500/60 bg-slate-800/80 hover:border-emerald-400 hover:bg-emerald-950/30'
                    : isActive
                      ? `${accentBorder} bg-slate-800/90 ring-1 ring-amber-400/80`
                      : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
                {champ && (
                  <img
                    src={getChampionIconUrl(champ.id, ddragonVersion)}
                    alt={champ.nameKo}
                    className={`h-full w-full object-cover ${
                      isPreview ? 'opacity-80' : ''
                    }`}
                  />
                )}
                <span className="absolute bottom-0 left-0 rounded-tr bg-slate-950/85 px-1 text-[9px] font-bold text-slate-300">
                  {slotRole}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`flex items-center gap-1.5 ${
                    isBlue ? '' : 'justify-end'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {champ ? champ.nameKo : `${ROLE_LABELS[slotRole]} (P${idx + 1})`}
                  </p>
                  {isPreview && (
                    <span className="shrink-0 rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-semibold text-amber-300">
                      대기
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  {champ
                    ? `${champ.roles.join('/')} · ${champ.damageType}`
                    : isActive
                      ? '선택 대기 중...'
                      : '비어 있음'}
                </p>
              </div>

              {/* 포지션 스왑 버튼 */}
              {canSwapThisSide && isPicked && picks.length >= 2 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSlotSwapClick(idx);
                  }}
                  title={
                    isSwapSource
                      ? '스왑 취소'
                      : isSwapTarget
                        ? '이 슬롯과 포지션 스왑'
                        : '포지션 스왑 선택'
                  }
                  className={`shrink-0 rounded-md border p-1.5 transition ${
                    isSwapSource
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                      : isSwapTarget
                        ? 'border-emerald-500/70 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-100'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function MatchCompleteBanner() {
  const {
    seriesFormat,
    selectionMode,
    draftMode,
    userSide,
    roomCode,
    onlineSide,
    gameNumber,
    currentStepIndex,
    blueTeamName,
    redTeamName,
    currentWinner,
    nextGameRofsFirst,
    setCurrentWinner,
    setNextGameRofsFirst,
    proceedToNextGame,
  } = useDraftStore();

  const isDraftComplete = currentStepIndex >= TOURNAMENT_DRAFT_ORDER.length;
  if (!isDraftComplete) return null;

  const maxGames = getMaxGames(seriesFormat);
  const hasNextGame = gameNumber < maxGames;
  const isOnlineRoom = draftMode === 'VS_1V1' && Boolean(roomCode);

  const loserSide: DraftSide | null = currentWinner
    ? currentWinner === 'BLUE'
      ? 'RED'
      : 'BLUE'
    : null;
  const loserTeamName =
    loserSide === 'BLUE' ? blueTeamName : redTeamName;
  const winnerTeamName =
    currentWinner === 'BLUE' ? blueTeamName : redTeamName;

  const isLoserAi =
    draftMode === 'SOLO_AI' && loserSide !== null && loserSide !== userSide;
  const isWinnerAi =
    draftMode === 'SOLO_AI' &&
    currentWinner !== null &&
    currentWinner !== userSide;

  const canActAsLoser =
    !isOnlineRoom || (loserSide !== null && onlineSide === loserSide);
  const canActAsWinner =
    !isOnlineRoom || (currentWinner !== null && onlineSide === currentWinner);

  // 수동 / 코인토스 모드: 패배팀 진영 선택
  const handleLoserChooseSide = (chosenSide: DraftSide) => {
    if (!loserSide) return;
    const swapNextSides = chosenSide !== loserSide;
    proceedToNextGame({
      swapNextSides,
      nextFirstPickSide: 'BLUE',
    });
  };

  // RoFS 모드: 패배팀 1차 선택 (진영 또는 픽순)
  const handleLoserRofsFirst = (category: 'SIDE' | 'PICK_ORDER', value: string) => {
    if (!loserSide) return;

    // 솔로 AI 모드에서 승리팀이 AI면 AI가 즉시 2차 선택을 수행하고 다음 세트로 진행
    if (isWinnerAi) {
      if (category === 'SIDE') {
        const loserNextSide = value as DraftSide;
        const swapNextSides = loserNextSide !== loserSide;
        // 승리한 AI는 선픽 선호
        const aiNextSide: DraftSide = loserNextSide === 'BLUE' ? 'RED' : 'BLUE';
        proceedToNextGame({
          swapNextSides,
          nextFirstPickSide: aiNextSide,
        });
      } else {
        // 패배한 유저가 픽순 선택 -> 승리한 AI가 BLUE 진영 선택
        const loserPickOrder = value as 'FIRST' | 'SECOND';
        const loserNextSide: DraftSide = 'RED';
        const swapNextSides = loserNextSide !== loserSide;
        const nextFirstPickSide: DraftSide =
          loserPickOrder === 'FIRST' ? loserNextSide : 'BLUE';
        proceedToNextGame({
          swapNextSides,
          nextFirstPickSide,
        });
      }
      return;
    }

    setNextGameRofsFirst({ category, value });
  };

  // RoFS 모드: 승리팀 2차 선택 (남은 항목)
  const handleWinnerRofsSecond = (value: string) => {
    if (!loserSide || !nextGameRofsFirst) return;

    if (nextGameRofsFirst.category === 'SIDE') {
      const loserNextSide = nextGameRofsFirst.value as DraftSide;
      const winnerNextSide: DraftSide =
        loserNextSide === 'BLUE' ? 'RED' : 'BLUE';
      const swapNextSides = loserNextSide !== loserSide;
      const nextFirstPickSide: DraftSide =
        value === 'FIRST' ? winnerNextSide : loserNextSide;

      proceedToNextGame({
        swapNextSides,
        nextFirstPickSide,
      });
    } else {
      const winnerNextSide = value as DraftSide;
      const loserNextSide: DraftSide =
        winnerNextSide === 'BLUE' ? 'RED' : 'BLUE';
      const swapNextSides = loserNextSide !== loserSide;
      const nextFirstPickSide: DraftSide =
        nextGameRofsFirst.value === 'FIRST' ? loserNextSide : winnerNextSide;

      proceedToNextGame({
        swapNextSides,
        nextFirstPickSide,
      });
    }
  };

  // 솔로 AI 모드에서 패배한 AI가 자동으로 1차 선택(진영 선택권 / RoFS 선선택권)을 행사
  const handleAiLoserAutoSelect = () => {
    if (!loserSide) return;

    if (selectionMode !== 'ROFS') {
      // AI는 패배 시 BLUE 진영을 선호하여 선택
      handleLoserChooseSide('BLUE');
      return;
    }

    // RoFS 모드: 패배한 AI가 1차 선택(선픽 또는 BLUE)을 자동 결정하고 유저에게 2차 선택권 넘김
    const aiPicksFirstOrder = Math.random() < 0.5;
    setNextGameRofsFirst(
      aiPicksFirstOrder
        ? { category: 'PICK_ORDER', value: 'FIRST' }
        : { category: 'SIDE', value: 'BLUE' },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-4 py-3">
      {/* 1단계: 승리 팀 기록 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="font-semibold text-emerald-300">
            Game {gameNumber} 밴픽 완료!
          </span>
          <span className="text-slate-400">
            {currentWinner
              ? `${winnerTeamName} 승리 기록됨`
              : '승리 팀을 먼저 선택해 주세요.'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={onlineSide === 'SPECTATOR'}
            onClick={() => setCurrentWinner('BLUE')}
            className={`rounded-md border px-3 py-1.5 font-semibold transition disabled:opacity-40 ${
              currentWinner === 'BLUE'
                ? 'border-sky-400 bg-sky-500 text-slate-950'
                : 'border-sky-700/70 bg-sky-950/50 text-sky-300 hover:bg-sky-900/60'
            }`}
          >
            {blueTeamName} 승
          </button>
          <button
            type="button"
            disabled={onlineSide === 'SPECTATOR'}
            onClick={() => setCurrentWinner('RED')}
            className={`rounded-md border px-3 py-1.5 font-semibold transition disabled:opacity-40 ${
              currentWinner === 'RED'
                ? 'border-rose-400 bg-rose-500 text-slate-950'
                : 'border-rose-700/70 bg-rose-950/50 text-rose-300 hover:bg-rose-900/60'
            }`}
          >
            {redTeamName} 승
          </button>
        </div>
      </div>

      {/* 2단계: 패배팀 선택권 (수동/코인토스 -> 진영 선택권, RoFS -> RoFS 선선택권) */}
      {hasNextGame && currentWinner && loserSide && (
        <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
          {selectionMode !== 'ROFS' ? (
            /* 수동선택 / 코인토스 모드: 패배팀 진영 선택권 */
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-bold text-amber-300">
                  Game {gameNumber + 1} 패배팀 진영 선택권 — {loserTeamName}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isLoserAi
                    ? `패배한 AI(${loserTeamName})가 다음 세트 진영을 선택합니다.`
                    : canActAsLoser
                      ? `${loserTeamName}이(가) 다음 세트에서 플레이할 진영을 선택하세요.`
                      : `패배팀(${loserTeamName})이 다음 세트 진영을 선택하는 중입니다...`}
                </p>
              </div>

              {isLoserAi ? (
                <button
                  type="button"
                  onClick={handleAiLoserAutoSelect}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  AI 진영 선택 후 Game {gameNumber + 1} 시작
                </button>
              ) : (
                canActAsLoser && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoserChooseSide('BLUE')}
                      className="rounded-md border border-sky-400 bg-sky-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-sky-400"
                    >
                      BLUE 진영 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoserChooseSide('RED')}
                      className="rounded-md border border-rose-400 bg-rose-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-rose-400"
                    >
                      RED 진영 선택
                    </button>
                  </div>
                )
              )}
            </div>
          ) : (
            /* RoFS 모드: 패배팀 RoFS 선선택권 (진영 또는 픽순 중 1차 선택 -> 승리팀 2차 선택) */
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-amber-300">
                    Game {gameNumber + 1} 패배팀 RoFS 선선택권 — {loserTeamName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {!nextGameRofsFirst
                      ? isLoserAi
                        ? `패배한 AI(${loserTeamName})가 진영 또는 픽순 중 한 항목을 먼저 선택합니다.`
                        : canActAsLoser
                          ? `${loserTeamName}이(가) 진영 또는 픽순 중 한 항목을 먼저 선택하세요.`
                          : `패배팀(${loserTeamName})의 RoFS 1차 선택을 기다리는 중...`
                      : `${loserTeamName}이(가) [${
                          nextGameRofsFirst.category === 'SIDE'
                            ? `진영: ${nextGameRofsFirst.value}`
                            : `픽순: ${
                                nextGameRofsFirst.value === 'FIRST'
                                  ? '선픽'
                                  : '후픽'
                              }`
                        }]을(를) 선택했습니다. 이제 승리팀(${winnerTeamName})이 남은 항목을 선택합니다.`}
                  </p>
                </div>

                {nextGameRofsFirst && canActAsLoser && !isLoserAi && (
                  <button
                    type="button"
                    onClick={() => setNextGameRofsFirst(null)}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    1차 선택 다시하기
                  </button>
                )}
              </div>

              {/* RoFS 1차 선택 (패배팀) */}
              {!nextGameRofsFirst && (
                <div>
                  {isLoserAi ? (
                    <button
                      type="button"
                      onClick={handleAiLoserAutoSelect}
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-amber-300"
                    >
                      AI RoFS 1차 선택 확인
                    </button>
                  ) : (
                    canActAsLoser && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => handleLoserRofsFirst('SIDE', 'BLUE')}
                          className="rounded-md border border-sky-500/70 bg-sky-950/50 py-1.5 font-bold text-sky-300 hover:bg-sky-500 hover:text-slate-950"
                        >
                          진영: BLUE
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoserRofsFirst('SIDE', 'RED')}
                          className="rounded-md border border-rose-500/70 bg-rose-950/50 py-1.5 font-bold text-rose-300 hover:bg-rose-500 hover:text-slate-950"
                        >
                          진영: RED
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleLoserRofsFirst('PICK_ORDER', 'FIRST')
                          }
                          className="rounded-md border border-amber-500/70 bg-amber-950/50 py-1.5 font-bold text-amber-300 hover:bg-amber-400 hover:text-slate-950"
                        >
                          픽순: 선픽
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleLoserRofsFirst('PICK_ORDER', 'SECOND')
                          }
                          className="rounded-md border border-amber-500/70 bg-amber-950/50 py-1.5 font-bold text-amber-300 hover:bg-amber-400 hover:text-slate-950"
                        >
                          픽순: 후픽
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* RoFS 2차 선택 (승리팀) */}
              {nextGameRofsFirst && canActAsWinner && (
                <div className="flex flex-wrap items-center gap-2">
                  {nextGameRofsFirst.category === 'SIDE' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleWinnerRofsSecond('FIRST')}
                        className="rounded-md bg-emerald-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        선픽 선택 후 Game {gameNumber + 1} 시작
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWinnerRofsSecond('SECOND')}
                        className="rounded-md border border-emerald-500/70 bg-emerald-950/50 px-3.5 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950"
                      >
                        후픽 선택 후 Game {gameNumber + 1} 시작
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleWinnerRofsSecond('BLUE')}
                        className="rounded-md bg-sky-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-sky-400"
                      >
                        BLUE 진영 선택 후 Game {gameNumber + 1} 시작
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWinnerRofsSecond('RED')}
                        className="rounded-md bg-rose-500 px-3.5 py-1.5 font-bold text-slate-950 hover:bg-rose-400"
                      >
                        RED 진영 선택 후 Game {gameNumber + 1} 시작
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
