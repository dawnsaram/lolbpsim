import { useEffect, useState } from 'react';
import { ChampionGrid } from '@/components/ChampionGrid';
import { CompAnalyzerPanel } from '@/components/CompAnalyzerPanel';
import { MatchCompleteBanner, SidePanel } from '@/components/DraftBoard';
import { Header } from '@/components/Header';
import { StartScreen } from '@/components/StartScreen';
import { TOURNAMENT_DRAFT_ORDER } from '@/constants/draftOrder';
import { useDraftStore } from '@/store/useDraftStore';

export function App() {
  const [view, setView] = useState<'HOME' | 'DRAFT'>('HOME');

  const {
    currentStepIndex,
    draftMode,
    userSide,
    timerEnabled,
    roomCode,
    roomPeers,
    loadAllChampions,
    leaveOnlineRoom,
    resetSeries,
    runAiTurn,
    tickTimer,
  } = useDraftStore();

  useEffect(() => {
    void loadAllChampions();
  }, [loadAllChampions]);

  // 솔로 연습 (vs AI) 모드에서 AI 턴 자동 진행 (드래프트 화면일 때만)
  useEffect(() => {
    if (view !== 'DRAFT') return;
    if (draftMode !== 'SOLO_AI') return;
    const step = TOURNAMENT_DRAFT_ORDER[currentStepIndex];
    if (!step || step.side === userSide) return;

    const timer = window.setTimeout(() => {
      runAiTurn();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [view, currentStepIndex, draftMode, userSide, runAiTurn]);

  // 1:1 / 솔로 모드 턴 타이머 (드래프트 화면일 때만, 온라인 방은 양쪽 모두 접속 시 시작)
  useEffect(() => {
    if (view !== 'DRAFT') return;
    if (!timerEnabled) return;
    const step = TOURNAMENT_DRAFT_ORDER[currentStepIndex];
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        onGoHome={() => {
          leaveOnlineRoom();
          setView('HOME');
        }}
      />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 p-4">
        {/* 롤 클라이언트 스타일 3단 드래프트 아레나: 블루(좌) | 챔피언 선택(중앙) | 레드(우) */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px] xl:grid-cols-[290px_minmax(0,1fr)_290px]">
          <SidePanel side="BLUE" />
          <ChampionGrid />
          <SidePanel side="RED" />
        </div>

        <MatchCompleteBanner />
        <CompAnalyzerPanel />
      </main>
    </div>
  );
}

export default App;
