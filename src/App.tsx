import { useEffect, useState } from 'react';
import { ChampionGrid } from '@/components/ChampionGrid';
import { CompAnalyzerPanel } from '@/components/CompAnalyzerPanel';
import { MatchCompleteBanner, SidePanel } from '@/components/DraftBoard';
import { Header } from '@/components/Header';
import { PostDraftAnalysisPanel } from '@/components/PostDraftAnalysisPanel';
import { StartScreen } from '@/components/StartScreen';
import { getDraftOrder, TOURNAMENT_DRAFT_ORDER } from '@/constants/draftOrder';
import { useDraftStore } from '@/store/useDraftStore';

export function App() {
  const [view, setView] = useState<'HOME' | 'DRAFT'>('HOME');

  const {
    currentStepIndex,
    draftMode,
    firstPickSide,
    userSide,
    timerEnabled,
    roomCode,
    roomPeers,
    loadAllChampions,
    leaveOnlineRoom,
    resetSeries,
    getAiDecision,
    hoverChampion,
    selectChampion,
    tickTimer,
  } = useDraftStore();

  useEffect(() => {
    void loadAllChampions();
  }, [loadAllChampions]);

  // 솔로 연습 (vs AI) 모드에서 AI가 고민 후 임시 선택(호버) -> 확정(Lock-in)하는 자연스러운 딜레이 연출
  useEffect(() => {
    if (view !== 'DRAFT') return;
    if (draftMode !== 'SOLO_AI') return;
    const step = getDraftOrder(firstPickSide)[currentStepIndex];
    if (!step || step.side === userSide) return;

    const decisionId = getAiDecision();
    if (!decisionId) return;

    // 밴은 0.9~1.6초, 픽은 1.1~1.9초 고민 후 임시 선택(호버), 이후 0.7~1.1초 뒤 확정
    const thinkDelayMs =
      step.type === 'BAN'
        ? 900 + Math.floor(Math.random() * 700)
        : 1100 + Math.floor(Math.random() * 800);
    const hoverHoldMs = 700 + Math.floor(Math.random() * 400);

    const hoverTimer = window.setTimeout(() => {
      hoverChampion(decisionId);
    }, thinkDelayMs);

    const lockTimer = window.setTimeout(() => {
      selectChampion(decisionId);
    }, thinkDelayMs + hoverHoldMs);

    return () => {
      window.clearTimeout(hoverTimer);
      window.clearTimeout(lockTimer);
    };
  }, [
    view,
    currentStepIndex,
    draftMode,
    firstPickSide,
    userSide,
    getAiDecision,
    hoverChampion,
    selectChampion,
  ]);

  // 1:1 / 솔로 모드 턴 타이머 (드래프트 화면일 때만, 온라인 방은 양쪽 모두 접속 시 시작)
  useEffect(() => {
    if (view !== 'DRAFT') return;
    if (!timerEnabled) return;
    const step = getDraftOrder(firstPickSide)[currentStepIndex];
    if (!step) return;
    if (draftMode === 'SOLO_AI' && step.side !== userSide) return;
    if (
      draftMode === 'VS_1V1' &&
      roomCode &&
      (!roomPeers.blueConnected || !roomPeers.redConnected)
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      tickTimer();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    view,
    currentStepIndex,
    draftMode,
    firstPickSide,
    userSide,
    timerEnabled,
    roomCode,
    roomPeers.blueConnected,
    roomPeers.redConnected,
    tickTimer,
  ]);

  if (view === 'HOME') {
    return (
      <StartScreen
        onStartNew={() => {
          resetSeries();
          setView('DRAFT');
        }}
        onResume={() => setView('DRAFT')}
        onEnterRoom={() => setView('DRAFT')}
      />
    );
  }

  const isDraftComplete = currentStepIndex >= TOURNAMENT_DRAFT_ORDER.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        onGoHome={() => {
          leaveOnlineRoom();
          setView('HOME');
        }}
      />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 p-4">
        {/* 롤 클라이언트 스타일 3단 드래프트 아레나: 블루(좌) | 챔피언 선택 또는 최종 분석(중앙) | 레드(우) */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px] xl:grid-cols-[290px_minmax(0,1fr)_290px]">
          <SidePanel side="BLUE" />
          {isDraftComplete ? <PostDraftAnalysisPanel /> : <ChampionGrid />}
          <SidePanel side="RED" />
        </div>

        <MatchCompleteBanner />
        {!isDraftComplete && <CompAnalyzerPanel />}
      </main>
    </div>
  );
}

export default App;
