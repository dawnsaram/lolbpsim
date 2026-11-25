import { getChampionsByIds } from '@/data';
import { analyzeTeamComp } from '@/engine/compAnalyzer';
import { getFearlessLockedIds, useDraftStore } from '@/store/useDraftStore';
import type { TeamCompAnalysis } from '@/types/draft';
import { getAvailablePool, getPoolWarnings } from '@/utils/pool';
import { AlertTriangle, BarChart3 } from 'lucide-react';

function TeamAnalysisCard({
  title,
  accentClass,
  analysis,
}: {
  title: string;
  accentClass: string;
  analysis: TeamCompAnalysis;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`text-xs font-bold ${accentClass}`}>{title}</h3>
          {analysis.pickCount > 0 && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
              {analysis.overallScore}점 ({analysis.grade})
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">
          AD {analysis.adRatio}% / AP {analysis.apRatio}%
        </span>
      </div>

      {/* AD / AP 비율 바 */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="bg-orange-400 transition-all"
          style={{ width: `${analysis.adRatio}%` }}
        />
        <div
          className="bg-indigo-400 transition-all"
          style={{ width: `${analysis.apRatio}%` }}
        />
      </div>

      {/* 조합 핵심 지표 (DPS 포함 5개) */}
      <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
        <div className="rounded bg-slate-900 p-1.5">
          <div className="text-slate-400">DPS</div>
          <div className="font-semibold text-amber-300">
            {analysis.totalDps}
          </div>
        </div>
        <div className="rounded bg-slate-900 p-1.5">
          <div className="text-slate-400">앞라인</div>
          <div className="font-semibold text-slate-100">
            {analysis.totalFrontline}
          </div>
        </div>
        <div className="rounded bg-slate-900 p-1.5">
          <div className="text-slate-400">이니시</div>
          <div className="font-semibold text-slate-100">
            {analysis.totalEngage}
          </div>
        </div>
        <div className="rounded bg-slate-900 p-1.5">
          <div className="text-slate-400">라클</div>
          <div className="font-semibold text-slate-100">
            {analysis.totalWaveClear}
          </div>
        </div>
        <div className="rounded bg-slate-900 p-1.5">
          <div className="text-slate-400">사거리</div>
          <div className="font-semibold text-slate-100">
            {analysis.totalRange}
          </div>
        </div>
      </div>

      {/* 시간대별 파워커브 */}
      <div className="flex items-center justify-between rounded bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-300">
        <span>초반 {analysis.powerCurve.early}</span>
        <span>중반 {analysis.powerCurve.mid}</span>
        <span>후반 {analysis.powerCurve.late}</span>
      </div>

      {/* 실시간 피드백 */}
      <div className="flex flex-col gap-1.5">
        {analysis.feedbacks.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            픽이 진행되면 실시간 조합 피드백이 표시됩니다.
          </p>
        ) : (
          analysis.feedbacks.map((fb, idx) => (
            <div
              key={idx}
              className={`rounded px-2 py-1 text-[11px] ${
                fb.level === 'danger'
                  ? 'bg-rose-950/70 text-rose-300'
                  : fb.level === 'warning'
                    ? 'bg-amber-950/60 text-amber-300'
                    : 'bg-sky-950/50 text-sky-300'
              }`}
            >
              {fb.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CompAnalyzerPanel() {
  const {
    champions,
    championMap,
    gameNumber,
    blueTeamName,
    redTeamName,
    blueBans,
    redBans,
    bluePicks,
    redPicks,
    history,
    fearlessRule,
    userSide,
  } = useDraftStore();

  const blueAnalysis = analyzeTeamComp(
    getChampionsByIds(bluePicks, championMap),
    gameNumber,
  );
  const redAnalysis = analyzeTeamComp(
    getChampionsByIds(redPicks, championMap),
    gameNumber,
  );

  const availablePool = getAvailablePool(
    champions,
    new Set([...blueBans, ...redBans]),
    getFearlessLockedIds(history, fearlessRule, userSide),
    new Set([...bluePicks, ...redPicks]),
  );
  const poolWarnings = getPoolWarnings(availablePool);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-sky-400" />
        <h2 className="text-sm font-bold text-slate-100">실시간 조합 분석기</h2>
      </div>

      {/* 피어리스 포지션 풀 경고 */}
      {poolWarnings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-900/60 bg-amber-950/30 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            피어리스 포지션 가용 풀 경고
          </div>
          {poolWarnings.map((warning) => (
            <p key={warning.role} className="text-[11px] text-amber-200/90">
              • {warning.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TeamAnalysisCard
          title={`${blueTeamName} 조합 분석`}
          accentClass="text-sky-400"
          analysis={blueAnalysis}
        />
        <TeamAnalysisCard
          title={`${redTeamName} 조합 분석`}
          accentClass="text-rose-400"
          analysis={redAnalysis}
        />
      </div>
    </section>
  );
}
