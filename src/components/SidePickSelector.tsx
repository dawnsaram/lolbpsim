import { useState } from 'react';
import { useDraftStore } from '@/store/useDraftStore';
import type {
  DraftSide,
  RofsCategory,
  SidePickSelectionMode,
} from '@/types/draft';
import { Coins, Scale, SlidersHorizontal } from 'lucide-react';

type PriorityOwner = 'SELF' | 'OPPONENT';
type PickOrderChoice = 'FIRST' | 'SECOND';

export function SidePickSelector() {
  const {
    draftMode,
    selectionMode,
    userSide,
    firstPickSide,
    blueTeamName,
    redTeamName,
    setSelectionMode,
    setUserSide,
    setFirstPickSide,
  } = useDraftStore();

  // 코인 토스 결과 표시
  const [coinResult, setCoinResult] = useState<string | null>(null);

  // RoFS 단계별 상태
  const [priorityOwner, setPriorityOwner] = useState<PriorityOwner>('SELF');
  const [rofsFirstCategory, setRofsFirstCategory] =
    useState<RofsCategory | null>(null);
  const [rofsFirstValue, setRofsFirstValue] = useState<string | null>(null);
  const [rofsSecondValue, setRofsSecondValue] = useState<string | null>(null);
  const [rofsLog, setRofsLog] = useState<string | null>(null);

  const selfLabel =
    draftMode === 'SOLO_AI'
      ? '나 (유저)'
      : draftMode === 'VS_1V1'
        ? '방장 (팀 A)'
        : '팀 A';
  const opponentLabel =
    draftMode === 'SOLO_AI'
      ? 'AI'
      : draftMode === 'VS_1V1'
        ? '참가자 (팀 B)'
        : '팀 B';

  const applyResolvedAssignment = (
    mySide: DraftSide,
    myPickOrder: PickOrderChoice,
  ) => {
    const resolvedFirstPick: DraftSide =
      myPickOrder === 'FIRST'
        ? mySide
        : mySide === 'BLUE'
          ? 'RED'
          : 'BLUE';
    setUserSide(mySide);
    setFirstPickSide(resolvedFirstPick);
  };

  // 1. 코인 토스 실행
  const handleCoinToss = () => {
    const mySide: DraftSide = Math.random() < 0.5 ? 'BLUE' : 'RED';
    const myPickOrder: PickOrderChoice = Math.random() < 0.5 ? 'FIRST' : 'SECOND';
    applyResolvedAssignment(mySide, myPickOrder);
    setCoinResult(
      `${selfLabel}: ${mySide === 'BLUE' ? '블루 진영' : '레드 진영'} · ${
        myPickOrder === 'FIRST' ? '선픽 (1픽)' : '후픽 (2픽)'
      }`,
    );
  };

  // 2. RoFS 선선택권 코인 토스
  const handleRofsPriorityToss = () => {
    const winner: PriorityOwner = Math.random() < 0.5 ? 'SELF' : 'OPPONENT';
    setPriorityOwner(winner);
    setRofsFirstCategory(null);
    setRofsFirstValue(null);
    setRofsSecondValue(null);
    setRofsLog(null);

    // 솔로 AI 모드에서 AI가 선선택권을 얻으면 AI가 1차 선택을 자동 수행
    if (draftMode === 'SOLO_AI' && winner === 'OPPONENT') {
      const aiPicksOrder = Math.random() < 0.5;
      if (aiPicksOrder) {
        setRofsFirstCategory('PICK_ORDER');
        setRofsFirstValue('FIRST');
        setRofsLog('AI가 선선택권으로 [픽순: 선픽]을 먼저 선택했습니다. 진영을 골라주세요.');
      } else {
        setRofsFirstCategory('SIDE');
        setRofsFirstValue('BLUE');
        setRofsLog('AI가 선선택권으로 [진영: BLUE]를 먼저 선택했습니다. 픽순을 골라주세요.');
      }
    }
  };

  const resetRofs = (owner: PriorityOwner) => {
    setPriorityOwner(owner);
    setRofsFirstCategory(null);
    setRofsFirstValue(null);
    setRofsSecondValue(null);
    setRofsLog(null);

    if (draftMode === 'SOLO_AI' && owner === 'OPPONENT') {
      setRofsFirstCategory('PICK_ORDER');
      setRofsFirstValue('FIRST');
      setRofsLog('AI가 선선택권으로 [픽순: 선픽]을 먼저 선택했습니다. 진영을 골라주세요.');
    }
  };

  // RoFS 1차 선택 처리 (선선택권 보유자가 진영 또는 픽순 중 하나 선택)
  const handleRofsFirstChoice = (category: RofsCategory, value: string) => {
    setRofsFirstCategory(category);
    setRofsFirstValue(value);
    setRofsSecondValue(null);

    // 솔로 AI 모드에서 내가 1차 선택을 했으면 AI가 남은 항목(2차 선택)을 자동 결정
    if (draftMode === 'SOLO_AI' && priorityOwner === 'SELF') {
      if (category === 'SIDE') {
        const mySide = value as DraftSide;
        // AI는 보통 선픽을 선호
        const aiPickOrder: PickOrderChoice = 'FIRST';
        const myPickOrder: PickOrderChoice =
          aiPickOrder === 'FIRST' ? 'SECOND' : 'FIRST';
        setRofsSecondValue(aiPickOrder);
        applyResolvedAssignment(mySide, myPickOrder);
        setRofsLog(
          `내가 [${mySide} 진영] 선택 → AI가 [선픽] 선택 (내 픽순: 후픽)`,
        );
      } else {
        const myPickOrder = value as PickOrderChoice;
        // AI는 보통 블루 진영을 선호
        const aiSide: DraftSide = 'BLUE';
        const mySide: DraftSide = aiSide === 'BLUE' ? 'RED' : 'BLUE';
        setRofsSecondValue(aiSide);
        applyResolvedAssignment(mySide, myPickOrder);
        setRofsLog(
          `내가 [${myPickOrder === 'FIRST' ? '선픽' : '후픽'}] 선택 → AI가 [BLUE 진영] 선택 (내 진영: RED)`,
        );
      }
      return;
    }

    setRofsLog(
      `${priorityOwner === 'SELF' ? selfLabel : opponentLabel}이(가) [${
        category === 'SIDE'
          ? `진영: ${value}`
          : `픽순: ${value === 'FIRST' ? '선픽' : '후픽'}`
      }] 선택 완료 — 이제 ${
        priorityOwner === 'SELF' ? opponentLabel : selfLabel
      }이(가) 남은 항목을 고릅니다.`,
    );
  };

  // RoFS 2차 선택 처리 (상대방이 남은 항목 선택)
  const handleRofsSecondChoice = (value: string) => {
    if (!rofsFirstCategory || !rofsFirstValue) return;
    setRofsSecondValue(value);

    let mySide: DraftSide;
    let myPickOrder: PickOrderChoice;

    if (rofsFirstCategory === 'SIDE') {
      // 1차가 진영, 2차가 픽순
      const firstSide = rofsFirstValue as DraftSide;
      const secondPickOrder = value as PickOrderChoice;
      if (priorityOwner === 'SELF') {
        mySide = firstSide;
        myPickOrder = secondPickOrder === 'FIRST' ? 'SECOND' : 'FIRST';
      } else {
        mySide = firstSide === 'BLUE' ? 'RED' : 'BLUE';
        myPickOrder = secondPickOrder;
      }
    } else {
      // 1차가 픽순, 2차가 진영
      const firstPickOrder = rofsFirstValue as PickOrderChoice;
      const secondSide = value as DraftSide;
      if (priorityOwner === 'SELF') {
        myPickOrder = firstPickOrder;
        mySide = secondSide === 'BLUE' ? 'RED' : 'BLUE';
      } else {
        myPickOrder = firstPickOrder === 'FIRST' ? 'SECOND' : 'FIRST';
        mySide = secondSide;
      }
    }

    applyResolvedAssignment(mySide, myPickOrder);
    setRofsLog(
      `확정 완료 — ${selfLabel}: ${mySide} · ${
        myPickOrder === 'FIRST' ? '선픽' : '후픽'
      }`,
    );
  };

  const modes: {
    id: SidePickSelectionMode;
    label: string;
    icon: typeof SlidersHorizontal;
  }[] = [
    { id: 'MANUAL', label: '수동 선택', icon: SlidersHorizontal },
    { id: 'COIN_TOSS', label: '코인 토스', icon: Coins },
    { id: 'ROFS', label: 'RoFS (선선택권)', icon: Scale },
  ];

  const secondChooserLabel =
    priorityOwner === 'SELF' ? opponentLabel : selfLabel;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          진영 및 픽순 선택 방식
        </label>
        <div className="flex items-center gap-1">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectionMode(id)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                selectionMode === id
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 1) 수동 선택 */}
      {selectionMode === 'MANUAL' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {draftMode !== 'MANUAL' && (
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400">
                {selfLabel} 진영
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['BLUE', 'RED'] as DraftSide[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setUserSide(side)}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                      userSide === side
                        ? side === 'BLUE'
                          ? 'border-sky-400 bg-sky-500 text-slate-950'
                          : 'border-rose-400 bg-rose-500 text-slate-950'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {side === 'BLUE' ? 'BLUE 진영' : 'RED 진영'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">선픽 (1픽) 진영</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['BLUE', 'RED'] as DraftSide[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setFirstPickSide(side)}
                  className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                    firstPickSide === side
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {side === 'BLUE' ? 'BLUE 선픽' : 'RED 선픽'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2) 코인 토스 */}
      {selectionMode === 'COIN_TOSS' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold text-slate-200">
              무작위 코인 토스로 진영과 선픽을 배정합니다.
            </p>
            <p className="text-[11px] text-amber-300">
              {coinResult ?? '버튼을 눌러 코인 토스를 실행하세요.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCoinToss}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 transition hover:bg-amber-300"
          >
            <Coins className="h-3.5 w-3.5" />
            코인 토스 실행
          </button>
        </div>
      )}

      {/* 3) RoFS (Right of First Selection) */}
      {selectionMode === 'ROFS' && (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          {/* Step 1: 선선택권 결정 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-300">
              1단계 · 선선택권 보유 팀:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => resetRofs('SELF')}
                className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                  priorityOwner === 'SELF'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {selfLabel}
              </button>
              <button
                type="button"
                onClick={() => resetRofs('OPPONENT')}
                className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                  priorityOwner === 'OPPONENT'
                    ? 'bg-rose-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {opponentLabel}
              </button>
              <button
                type="button"
                onClick={handleRofsPriorityToss}
                className="inline-flex items-center gap-1 rounded border border-amber-500/60 bg-amber-950/40 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-900/50"
              >
                <Coins className="h-3 w-3" />
                추첨
              </button>
            </div>
          </div>

          {/* Step 2: 1차 선택 (진영 OR 픽순 중 택 1) */}
          {!(draftMode === 'SOLO_AI' && priorityOwner === 'OPPONENT') && (
            <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
              <p className="text-[11px] font-semibold text-slate-400">
                2단계 ·{' '}
                <strong className="text-slate-200">
                  {priorityOwner === 'SELF' ? selfLabel : opponentLabel}
                </strong>
                이(가) 진영 또는 픽순 중 하나를 먼저 선택:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleRofsFirstChoice('SIDE', 'BLUE')}
                  className={`rounded-md border py-1.5 text-[11px] font-bold transition ${
                    rofsFirstCategory === 'SIDE' && rofsFirstValue === 'BLUE'
                      ? 'border-sky-400 bg-sky-500 text-slate-950'
                      : 'border-slate-700 bg-slate-950 text-sky-300 hover:bg-slate-800'
                  }`}
                >
                  진영: BLUE
                </button>
                <button
                  type="button"
                  onClick={() => handleRofsFirstChoice('SIDE', 'RED')}
                  className={`rounded-md border py-1.5 text-[11px] font-bold transition ${
                    rofsFirstCategory === 'SIDE' && rofsFirstValue === 'RED'
                      ? 'border-rose-400 bg-rose-500 text-slate-950'
                      : 'border-slate-700 bg-slate-950 text-rose-300 hover:bg-slate-800'
                  }`}
                >
                  진영: RED
                </button>
                <button
                  type="button"
                  onClick={() => handleRofsFirstChoice('PICK_ORDER', 'FIRST')}
                  className={`rounded-md border py-1.5 text-[11px] font-bold transition ${
                    rofsFirstCategory === 'PICK_ORDER' &&
                    rofsFirstValue === 'FIRST'
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-950 text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  픽순: 선픽
                </button>
                <button
                  type="button"
                  onClick={() => handleRofsFirstChoice('PICK_ORDER', 'SECOND')}
                  className={`rounded-md border py-1.5 text-[11px] font-bold transition ${
                    rofsFirstCategory === 'PICK_ORDER' &&
                    rofsFirstValue === 'SECOND'
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-950 text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  픽순: 후픽
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 2차 선택 (상대방이 남은 항목 선택) */}
          {rofsFirstCategory &&
            !(draftMode === 'SOLO_AI' && priorityOwner === 'SELF') && (
              <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                <p className="text-[11px] font-semibold text-slate-400">
                  3단계 ·{' '}
                  <strong className="text-slate-200">
                    {secondChooserLabel}
                  </strong>
                  이(가) 남은{' '}
                  {rofsFirstCategory === 'SIDE' ? '픽순' : '진영'} 선택:
                </p>
                {rofsFirstCategory === 'SIDE' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRofsSecondChoice('FIRST')}
                      className={`rounded-md border py-1.5 text-[11px] font-bold ${
                        rofsSecondValue === 'FIRST'
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-amber-300 hover:bg-slate-800'
                      }`}
                    >
                      선픽 (1픽) 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRofsSecondChoice('SECOND')}
                      className={`rounded-md border py-1.5 text-[11px] font-bold ${
                        rofsSecondValue === 'SECOND'
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-amber-300 hover:bg-slate-800'
                      }`}
                    >
                      후픽 (2픽) 선택
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRofsSecondChoice('BLUE')}
                      className={`rounded-md border py-1.5 text-[11px] font-bold ${
                        rofsSecondValue === 'BLUE'
                          ? 'border-sky-400 bg-sky-500 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-sky-300 hover:bg-slate-800'
                      }`}
                    >
                      BLUE 진영 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRofsSecondChoice('RED')}
                      className={`rounded-md border py-1.5 text-[11px] font-bold ${
                        rofsSecondValue === 'RED'
                          ? 'border-rose-400 bg-rose-500 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-rose-300 hover:bg-slate-800'
                      }`}
                    >
                      RED 진영 선택
                    </button>
                  </div>
                )}
              </div>
            )}

          {rofsLog && (
            <p className="rounded bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-emerald-300">
              {rofsLog}
            </p>
          )}
        </div>
      )}

      {/* 현재 적용된 진영 & 픽순 요약 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[11px]">
        <span className="text-sky-300">
          <strong>{blueTeamName}</strong> (BLUE ·{' '}
          {firstPickSide === 'BLUE' ? '선픽' : '후픽'})
          {draftMode !== 'MANUAL' && userSide === 'BLUE' ? ` ← ${selfLabel}` : ''}
        </span>
        <span className="text-slate-500">vs</span>
        <span className="text-rose-300">
          <strong>{redTeamName}</strong> (RED ·{' '}
          {firstPickSide === 'RED' ? '선픽' : '후픽'})
          {draftMode !== 'MANUAL' && userSide === 'RED' ? ` ← ${selfLabel}` : ''}
        </span>
      </div>
    </div>
  );
}
