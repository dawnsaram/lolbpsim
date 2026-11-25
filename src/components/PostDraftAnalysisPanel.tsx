import { getChampionsByIds } from '@/data';
import { analyzeTeamComp } from '@/engine/compAnalyzer';
import { useDraftStore } from '@/store/useDraftStore';
import type { CompGrade } from '@/types/draft';
import { Award, BarChart3 } from 'lucide-react';

interface RadarMetric {
  label: string;
  blue: number;
  red: number;
  max: number;
}

function getGradeBadgeClass(grade: CompGrade): string {
  switch (grade) {
    case 'S':
      return 'border-amber-400/70 bg-amber-400/20 text-amber-300';
    case 'A':
      return 'border-emerald-400/70 bg-emerald-400/20 text-emerald-300';
    case 'B':
      return 'border-sky-400/70 bg-sky-400/20 text-sky-300';
    case 'C':
      return 'border-slate-500/70 bg-slate-700/40 text-slate-300';
    default:
      return 'border-rose-500/70 bg-rose-500/20 text-rose-300';
  }
}

function CompRadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const size = 210;
  const center = size / 2;
  const radius = 72;
  const levels = [0.25, 0.5, 0.75, 1];

  const getPoint = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const clamped = Math.max(0.08, Math.min(1, ratio));
    return {
      x: center + Math.cos(angle) * radius * clamped,
      y: center + Math.sin(angle) * radius * clamped,
    };
  };

  const toPolygonPoints = (values: number[]) =>
    values
      .map((value, idx) => {
        const pt = getPoint(idx, value / metrics[idx].max);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-[200px] w-[200px] shrink-0"
      aria-label="양팀 5대 지표 레이더 차트"
    >
      {/* 배경 다각형 그리드 */}
      {levels.map((level) => (
        <polygon
          key={level}
          points={metrics
            .map((_, idx) => {
              const pt = getPoint(idx, level);
              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            })
            .join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
        />
      ))}

      {/* 축선 */}
      {metrics.map((metric, idx) => {
        const outer = getPoint(idx, 1);
        const labelPt = getPoint(idx, 1.24);
        return (
          <g key={metric.label}>
            <line
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="#334155"
              strokeWidth="1"
            />
            <text
              x={labelPt.x}
              y={labelPt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-300 text-[10px] font-semibold"
            >
              {metric.label}
            </text>
          </g>
        );
      })}

      {/* BLUE 폴리곤 */}
      <polygon
        points={toPolygonPoints(metrics.map((m) => m.blue))}
        fill="rgba(56, 189, 248, 0.25)"
        stroke="#38bdf8"
        strokeWidth="2"
      />

      {/* RED 폴리곤 */}
      <polygon
        points={toPolygonPoints(metrics.map((m) => m.red))}
        fill="rgba(251, 113, 133, 0.25)"
        stroke="#fb7185"
        strokeWidth="2"
      />
    </svg>
  );
}

export function PostDraftAnalysisPanel() {
  const {
    championMap,
    gameNumber,
    blueTeamName,
    redTeamName,
    bluePicks,
    redPicks,
  } = useDraftStore();

  const blue = analyzeTeamComp(getChampionsByIds(bluePicks, championMap), gameNumber);
  const red = analyzeTeamComp(getChampionsByIds(redPicks, championMap), gameNumber);

  const scoreDiff = blue.overallScore - red.overallScore;
  const totalScoreSum = Math.max(1, blue.overallScore + red.overallScore);
  const blueBarWidth = Math.round((blue.overallScore / totalScoreSum) * 100);

  const metrics: RadarMetric[] = [
    { label: 'DPS', blue: blue.totalDps, red: red.totalDps, max: 22 },
    { label: '앞라인', blue: blue.totalFrontline, red: red.totalFrontline, max: 20 },
    { label: '이니시', blue: blue.totalEngage, red: red.totalEngage, max: 20 },
    { label: '라클', blue: blue.totalWaveClear, red: red.totalWaveClear, max: 22 },
    { label: '사거리', blue: blue.totalRange, red: red.totalRange, max: 22 },
  ];

  const powerStages = [
    { label: '초반 (0~15분)', blue: blue.powerCurve.early, red: red.powerCurve.early },
    { label: '중반 (15~25분)', blue: blue.powerCurve.mid, red: red.powerCurve.mid },
    { label: '후반 (25분+)', blue: blue.powerCurve.late, red: red.powerCurve.late },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/75 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-bold text-slate-100">
            Game {gameNumber} 양팀 조합 최종 분석
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-[11px] font-bold">
          <Award className="h-3.5 w-3.5 text-amber-400" />
          {Math.abs(scoreDiff) <= 2 ? (
            <span className="text-slate-200">박빙 조합 (균형)</span>
          ) : scoreDiff > 0 ? (
            <span className="text-sky-400">
              {blueTeamName} +{scoreDiff}점 우세
            </span>
          ) : (
            <span className="text-rose-400">
              {redTeamName} +{Math.abs(scoreDiff)}점 우세
            </span>
          )}
        </span>
      </div>

      {/* 종합 점수 스코어카드 */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* BLUE 종합 점수 */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-sky-400">
                {blueTeamName}
              </p>
              <p className="text-[11px] text-slate-400">
                AD {blue.adRatio}% · AP {blue.apRatio}%
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-sky-300">
                {blue.overallScore}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-xs font-extrabold ${getGradeBadgeClass(blue.grade)}`}
              >
                {blue.grade}
              </span>
            </div>
          </div>

          <span className="text-xs font-extrabold text-slate-600">VS</span>

          {/* RED 종합 점수 */}
          <div className="flex flex-row-reverse items-center justify-between gap-2 text-right">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-rose-400">
                {redTeamName}
              </p>
              <p className="text-[11px] text-slate-400">
                AD {red.adRatio}% · AP {red.apRatio}%
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded border px-1.5 py-0.5 text-xs font-extrabold ${getGradeBadgeClass(red.grade)}`}
              >
                {red.grade}
              </span>
              <span className="text-2xl font-black text-rose-300">
                {red.overallScore}
              </span>
            </div>
          </div>
        </div>

        {/* 점수 비중 게이지 */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="bg-sky-400 transition-all duration-500"
            style={{ width: `${blueBarWidth}%` }}
          />
          <div
            className="bg-rose-400 transition-all duration-500"
            style={{ width: `${100 - blueBarWidth}%` }}
          />
        </div>
      </div>

      {/* 5대 지표 레이더 차트 + 항목별 비교 바 */}
      <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:grid-cols-[200px_1fr]">
        <CompRadarChart metrics={metrics} />

        <div className="space-y-2.5">
          {metrics.map((m) => {
            const bluePct = Math.min(100, Math.round((m.blue / m.max) * 100));
            const redPct = Math.min(100, Math.round((m.red / m.max) * 100));
            return (
              <div key={m.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`font-bold ${
                      m.blue >= m.red ? 'text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    {m.blue}
                  </span>
                  <span className="font-semibold text-slate-300">{m.label}</span>
                  <span
                    className={`font-bold ${
                      m.red >= m.blue ? 'text-rose-300' : 'text-slate-400'
                    }`}
                  >
                    {m.red}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex h-2 justify-end overflow-hidden rounded-l-full bg-slate-800">
                    <div
                      className="h-full rounded-l-full bg-sky-400 transition-all"
                      style={{ width: `${bluePct}%` }}
                    />
                  </div>
                  <div className="flex h-2 justify-start overflow-hidden rounded-r-full bg-slate-800">
                    <div
                      className="h-full rounded-r-full bg-rose-400 transition-all"
                      style={{ width: `${redPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 시간대별 파워커브 비교 */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center text-[11px]">
        {powerStages.map((stage) => (
          <div key={stage.label} className="space-y-1 rounded-lg bg-slate-900/90 p-2">
            <div className="text-[10px] text-slate-400">{stage.label}</div>
            <div className="flex items-center justify-center gap-2 font-bold">
              <span
                className={
                  stage.blue >= stage.red ? 'text-sky-400' : 'text-slate-400'
                }
              >
                {stage.blue.toFixed(1)}
              </span>
              <span className="text-slate-600">:</span>
              <span
                className={
                  stage.red >= stage.blue ? 'text-rose-400' : 'text-slate-400'
                }
              >
                {stage.red.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 양팀 핵심 피드백 요약 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
          <p className="text-[11px] font-bold text-sky-400">
            {blueTeamName} 핵심 포인트
          </p>
          {blue.feedbacks.length === 0 ? (
            <p className="text-[11px] text-emerald-300">
              뚜렷한 결함 없이 균형 잡힌 조합입니다.
            </p>
          ) : (
            blue.feedbacks.map((fb, idx) => (
              <p key={idx} className="text-[11px] text-slate-300">
                • {fb.message}
              </p>
            ))
          )}
        </div>

        <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
          <p className="text-[11px] font-bold text-rose-400">
            {redTeamName} 핵심 포인트
          </p>
          {red.feedbacks.length === 0 ? (
            <p className="text-[11px] text-emerald-300">
              뚜렷한 결함 없이 균형 잡힌 조합입니다.
            </p>
          ) : (
            red.feedbacks.map((fb, idx) => (
              <p key={idx} className="text-[11px] text-slate-300">
                • {fb.message}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
