import { useState } from 'react';
import {
  AI_STYLE_META,
  FEARLESS_RULE_META,
} from '@/constants/draftOrder';
import { getMaxGames, useDraftStore } from '@/store/useDraftStore';
import type {
  AiStyle,
  DraftMode,
  FearlessRule,
  SeriesFormat,
} from '@/types/draft';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Home,
  RotateCcw,
  Settings,
  Timer,
  TimerOff,
  Undo2,
  X,
} from 'lucide-react';

interface HeaderProps {
  onGoHome: () => void;
}

export function Header({ onGoHome }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    roomCode,
    onlineSide,
    roomPeers,
    seriesFormat,
    fearlessRule,
    draftMode,
    aiStyle,
    blueTeamName,
    redTeamName,
    timerEnabled,
    gameNumber,
    currentStepIndex,
    currentWinner,
    history,
    setSeriesFormat,
    setFearlessRule,
    setDraftMode,
    setAiStyle,
    setTeamName,
    swapSides,
    setTimerEnabled,
    undoLastAction,
    branchFromGame,
    resetCurrentGame,
    resetSeries,
  } = useDraftStore();

  const maxGames = getMaxGames(seriesFormat);
  const isOnlineRoom = draftMode === 'VS_1V1' && Boolean(roomCode);

  const countWinsForTeam = (teamName: string): number => {
    let wins = history.filter((record) => {
      if (!record.winner) return false;
      const winnerName =
        record.winner === 'BLUE' ? record.blueTeamName : record.redTeamName;
      return winnerName === teamName;
    }).length;

    if (currentWinner) {
      const currentWinnerName =
        currentWinner === 'BLUE' ? blueTeamName : redTeamName;
      if (currentWinnerName === teamName) wins += 1;
    }

    return wins;
  };

  const blueScore = countWinsForTeam(blueTeamName);
  const redScore = countWinsForTeam(redTeamName);

  const modeLabel =
    draftMode === 'VS_1V1'
      ? '1:1 온라인'
      : draftMode === 'SOLO_AI'
        ? `vs AI (${AI_STYLE_META[aiStyle].label})`
        : '수동';

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
      <nav className="relative mx-auto flex h-13 max-w-[1440px] items-center justify-between gap-2 px-4">
        {/* 좌측: 홈 버튼 + 온라인 방 코드 / 모드 배지 + 세트 타임라인 */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onGoHome}
            title="시작 화면으로 (방 나가기)"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-xs font-bold text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
          >
            <Home className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">LoL BP Sim</span>
          </button>

          {isOnlineRoom && roomCode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                title="클릭하여 방 코드 복사"
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-950/50 px-2.5 py-1 text-xs font-extrabold tracking-wider text-sky-300 transition hover:bg-sky-900/60"
              >
                <span>{roomCode}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>

              <span
                className={`hidden rounded px-1.5 py-0.5 text-[10px] font-bold sm:inline ${
                  onlineSide === 'BLUE'
                    ? 'bg-sky-500/20 text-sky-300'
                    : onlineSide === 'RED'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-300'
                }`}
              >
                내 진영: {onlineSide === 'SPECTATOR' ? '관전' : onlineSide}
              </span>

              <span
                className="hidden items-center gap-1 rounded bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300 md:inline-flex"
                title="플레이어 접속 상태"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    roomPeers.blueConnected ? 'bg-sky-400' : 'bg-slate-600'
                  }`}
                />
                B
                <span
                  className={`ml-1 h-2 w-2 rounded-full ${
                    roomPeers.redConnected ? 'bg-rose-400' : 'bg-slate-600'
                  }`}
                />
                R
              </span>
            </div>
          ) : (
            <span className="hidden rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 md:inline">
              {modeLabel} · {seriesFormat} ·{' '}
              {fearlessRule === 'HARD'
                ? '하드 피어리스'
                : fearlessRule === 'SOFT'
                  ? '소프트 피어리스'
                  : '일반'}
            </span>
          )}

          {/* 세트 타임라인 */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxGames }, (_, idx) => {
              const num = idx + 1;
              const isPast = history.some((h) => h.gameNumber === num);
              const isCurrent = num === gameNumber;

              return (
                <button
                  key={num}
                  type="button"
                  disabled={!isPast}
                  onClick={() => branchFromGame(num)}
                  title={
                    isPast
                      ? `Game ${num}부터 다시 분기(What-if) 테스트`
                      : `Game ${num}`
                  }
                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition ${
                    isCurrent
                      ? 'bg-sky-500 text-slate-950'
                      : isPast
                        ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        : 'bg-slate-950 text-slate-600'
                  }`}
                >
                  G{num}
                </button>
              );
            })}
          </div>
        </div>

        {/* 중앙: 컴팩트 스코어보드 */}
        <div className="hidden items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-bold xl:flex">
          <span className="max-w-[110px] truncate text-sky-400">
            {blueTeamName}
          </span>
          <span className="rounded bg-slate-900 px-2 py-0.5 text-slate-100">
            <span className="text-sky-400">{blueScore}</span>
            <span className="mx-1 text-slate-500">:</span>
            <span className="text-rose-400">{redScore}</span>
          </span>
          <span className="max-w-[110px] truncate text-rose-400">
            {redTeamName}
          </span>
        </div>

        {/* 우측: 빠른 액션 + 설정 드롭다운 */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setTimerEnabled(!timerEnabled)}
            title="30초 타이머 켜기/끄기"
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 transition ${
              timerEnabled
                ? 'border-amber-600/70 bg-amber-950/40 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
          >
            {timerEnabled ? (
              <Timer className="h-3.5 w-3.5" />
            ) : (
              <TimerOff className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={swapSides}
            disabled={currentStepIndex > 0 || onlineSide === 'SPECTATOR'}
            title="블루/레드 진영 교체 (시작 전에만 가능)"
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">진영 교체</span>
          </button>

          <button
            type="button"
            onClick={undoLastAction}
            disabled={currentStepIndex === 0 || onlineSide === 'SPECTATOR'}
            title="마지막 밴/픽 되돌리기"
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">되돌리기</span>
          </button>

          <button
            type="button"
            onClick={resetCurrentGame}
            disabled={onlineSide === 'SPECTATOR'}
            title="현재 세트 초기화"
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-semibold transition ${
              settingsOpen
                ? 'border-sky-500 bg-sky-500 text-slate-950'
                : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>설정</span>
          </button>
        </div>

        {/* 설정 드롭다운 패널 */}
        {settingsOpen && (
          <div className="absolute right-4 top-14 z-40 w-80 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100">게임 설정</span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isOnlineRoom && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">대전 모드</label>
                <select
                  value={draftMode}
                  onChange={(e) => setDraftMode(e.target.value as DraftMode)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-200"
                >
                  <option value="SOLO_AI">솔로 연습 (vs AI)</option>
                  <option value="MANUAL">양팀 수동 조작</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">시리즈</label>
                <select
                  value={seriesFormat}
                  onChange={(e) =>
                    setSeriesFormat(e.target.value as SeriesFormat)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                >
                  <option value="BO1">단판 (Bo1)</option>
                  <option value="BO3">Bo3</option>
                  <option value="BO5">Bo5</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">피어리스 룰</label>
                <select
                  value={fearlessRule}
                  onChange={(e) =>
                    setFearlessRule(e.target.value as FearlessRule)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                >
                  {(Object.keys(FEARLESS_RULE_META) as FearlessRule[]).map(
                    (rule) => (
                      <option key={rule} value={rule}>
                        {FEARLESS_RULE_META[rule].label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {draftMode === 'SOLO_AI' && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">AI 성향</label>
                <select
                  value={aiStyle}
                  onChange={(e) => setAiStyle(e.target.value as AiStyle)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-200"
                >
                  {(Object.keys(AI_STYLE_META) as AiStyle[]).map((style) => (
                    <option key={style} value={style}>
                      {AI_STYLE_META[style].label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-sky-400">블루 팀명</label>
                <input
                  type="text"
                  value={blueTeamName}
                  onChange={(e) => setTeamName('BLUE', e.target.value)}
                  maxLength={18}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-rose-400">레드 팀명</label>
                <input
                  type="text"
                  value={redTeamName}
                  onChange={(e) => setTeamName('RED', e.target.value)}
                  maxLength={18}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  resetSeries();
                  setSettingsOpen(false);
                }}
                className="rounded-md border border-rose-800/70 bg-rose-950/40 px-2.5 py-1.5 font-semibold text-rose-300 hover:bg-rose-900/50"
              >
                시리즈 전체 리셋
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md bg-slate-800 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
