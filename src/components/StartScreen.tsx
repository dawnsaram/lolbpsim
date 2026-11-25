import { useState } from 'react';
import { SidePickSelector } from '@/components/SidePickSelector';
import { TierEditorModal } from '@/components/TierEditorModal';
import {
  AI_STYLE_META,
  FEARLESS_RULE_META,
} from '@/constants/draftOrder';
import { useDraftStore } from '@/store/useDraftStore';
import type {
  AiStyle,
  DraftMode,
  FearlessRule,
  SeriesFormat,
} from '@/types/draft';
import {
  Bot,
  DoorOpen,
  KeyRound,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Swords,
  Timer,
  Users,
} from 'lucide-react';

interface StartScreenProps {
  onStartNew: () => void;
  onResume: () => void;
  onEnterRoom: () => void;
}

const MODE_CARDS: {
  mode: DraftMode;
  title: string;
  desc: string;
  icon: typeof Swords;
}[] = [
    {
      mode: 'VS_1V1',
      title: '1:1 대전 (방 코드)',
      desc: '방을 만들고 6자리 코드를 공유해 두 명이 실시간으로 1:1 밴픽',
      icon: Swords,
    },
    {
      mode: 'SOLO_AI',
      title: '솔로 연습 (vs AI)',
      desc: '피어리스 포지션 말리기 & 조합 보완 AI 감코진과 1인 연습',
      icon: Bot,
    },
    {
      mode: 'MANUAL',
      title: '양팀 수동 조작',
      desc: '한 화면에서 블루·레드 양쪽을 직접 조작하며 조합 연구',
      icon: Users,
    },
  ];

export function StartScreen({
  onStartNew,
  onResume,
  onEnterRoom,
}: StartScreenProps) {
  const [joinCode, setJoinCode] = useState('');
  const [tierEditorOpen, setTierEditorOpen] = useState(false);

  const {
    seriesFormat,
    fearlessRule,
    draftMode,
    userSide,
    aiStyle,
    blueTeamName,
    redTeamName,
    timerEnabled,
    gameNumber,
    currentStepIndex,
    history,
    customTiers,
    roomStatus,
    roomError,
    setSeriesFormat,
    setFearlessRule,
    setDraftMode,
    setAiStyle,
    setTeamName,
    setTimerEnabled,
    createOnlineRoom,
    joinOnlineRoom,
    clearRoomError,
  } = useDraftStore();

  const hasSavedProgress = currentStepIndex > 0 || history.length > 0;
  const isConnecting = roomStatus === 'CONNECTING';
  const customTierCount = Object.keys(customTiers).length;

  const handleCreateRoom = async () => {
    const ok = await createOnlineRoom(userSide);
    if (ok) onEnterRoom();
  };

  const handleJoinRoom = async () => {
    const ok = await joinOnlineRoom(joinCode);
    if (ok) onEnterRoom();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-3xl space-y-6">
        {/* 타이틀 영역 */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <Shield className="h-3.5 w-3.5" />
            LoL Ban/Pick Simulator
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
            LoL 밴픽 시뮬레이터
          </h1>
          <p className="text-sm text-slate-400">
            방 코드 기반 실시간 1:1 대전, AI 솔로 연습, 실시간 조합 분석
          </p>
        </div>

        {/* 설정 카드 */}
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-2xl sm:p-6">
          {/* 1. 대전 모드 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              모드 선택
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {MODE_CARDS.map(({ mode, title, desc, icon: Icon }) => {
                const selected = draftMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      clearRoomError();
                      setDraftMode(mode);
                    }}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${selected
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${selected ? 'text-sky-400' : 'text-slate-400'
                          }`}
                      />
                      <span className="text-sm font-bold text-slate-100">
                        {title}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1:1 온라인 방 참가 섹션 (VS_1V1 선택 시 상단에 바로 표시) */}
          {draftMode === 'VS_1V1' && (
            <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <KeyRound className="h-4 w-4" />
                  이미 받은 방 코드가 있나요?
                </div>
                <span className="text-[11px] text-slate-400">
                  방장이 설정한 룰과 진영에 자동으로 입장합니다
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    clearRoomError();
                    setJoinCode(e.target.value.toUpperCase());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleJoinRoom();
                  }}
                  maxLength={8}
                  placeholder="6자리 방 코드 입력 (예: K7M2P9)"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold tracking-widest text-slate-100 uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isConnecting || !joinCode.trim()}
                  onClick={() => void handleJoinRoom()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
                >
                  <DoorOpen className="h-4 w-4" />
                  {isConnecting ? '접속 중...' : '방 코드로 참가'}
                </button>
              </div>

              {roomError && (
                <p className="rounded-md bg-rose-950/70 px-3 py-1.5 text-xs font-medium text-rose-300">
                  {roomError}
                </p>
              )}
            </div>
          )}

          {/* 2. 시리즈 포맷 & 피어리스 룰 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                시리즈 포맷
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['BO1', 'BO3', 'BO5'] as SeriesFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setSeriesFormat(format)}
                    className={`rounded-lg border py-2 text-xs font-bold transition ${seriesFormat === format
                      ? 'border-sky-500 bg-sky-500 text-slate-950'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                  >
                    {format === 'BO1' ? '단판 (Bo1)' : format}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                피어리스 룰
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['HARD', 'SOFT', 'NONE'] as FearlessRule[]).map((rule) => (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => setFearlessRule(rule)}
                    title={FEARLESS_RULE_META[rule].description}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${fearlessRule === rule
                      ? 'border-sky-500 bg-sky-500 text-slate-950'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                      }`}
                  >
                    {rule === 'HARD'
                      ? '하드 피어리스'
                      : rule === 'SOFT'
                        ? '소프트'
                        : '일반 밴픽'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 진영 및 픽순 선택 (수동 / 코인 토스 / RoFS) */}
          <SidePickSelector />

          {/* AI 성향 프리셋 (SOLO_AI 전용) */}
          {draftMode === 'SOLO_AI' && (
            <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
              <label className="text-xs font-semibold text-slate-400">
                AI 성향 프리셋
              </label>
              <select
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value as AiStyle)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100"
              >
                {(Object.keys(AI_STYLE_META) as AiStyle[]).map((style) => (
                  <option key={style} value={style}>
                    {AI_STYLE_META[style].label} —{' '}
                    {AI_STYLE_META[style].description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. 팀명 & 타이머 */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-sky-400">
                블루 팀 이름
              </label>
              <input
                type="text"
                value={blueTeamName}
                onChange={(e) => setTeamName('BLUE', e.target.value)}
                maxLength={18}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-rose-400">
                레드 팀 이름
              </label>
              <input
                type="text"
                value={redTeamName}
                onChange={(e) => setTeamName('RED', e.target.value)}
                maxLength={18}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setTimerEnabled(!timerEnabled)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${timerEnabled
                ? 'border-amber-600/70 bg-amber-950/40 text-amber-300'
                : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
            >
              <Timer className="h-3.5 w-3.5" />
              30초 타이머 {timerEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 5. 시작 버튼 */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {draftMode === 'VS_1V1' ? (
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => void handleCreateRoom()}
                className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:opacity-40"
              >
                <Swords className="h-4 w-4" />
                {isConnecting ? '방 생성 중...' : '1:1 대전 방 만들기'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStartNew}
                  className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                >
                  <Play className="h-4 w-4 fill-current" />
                  새 드래프트 시작
                </button>

                {hasSavedProgress && (
                  <button
                    type="button"
                    onClick={onResume}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    진행 중이던 Game {gameNumber} 이어하기
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 하단 유틸리티 링크: 챔피언 티어 커스텀 설정 */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setTierEditorOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-sky-300 hover:underline"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>챔피언 티어 커스텀 설정</span>
            {customTierCount > 0 && (
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 no-underline">
                {customTierCount}개 적용 중
              </span>
            )}
          </button>
        </div>
      </div>

      {tierEditorOpen && (
        <TierEditorModal onClose={() => setTierEditorOpen(false)} />
      )}
    </div>
  );
}
