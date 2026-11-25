import { useState } from 'react';
import { ALL_ROLES, ROLE_LABELS } from '@/constants/draftOrder';
import { getChampionIconUrl } from '@/services/ddragon';
import { useDraftStore } from '@/store/useDraftStore';
import type { Role } from '@/types/draft';
import { matchesChampionQuery } from '@/utils/hangul';
import { RotateCcw, Search, Sliders, X } from 'lucide-react';

interface TierEditorModalProps {
  onClose: () => void;
}

const TIER_PRESETS: { label: string; value: number; activeClass: string }[] = [
  { label: '1T', value: 1.2, activeClass: 'bg-amber-400 text-slate-950 border-amber-400' },
  { label: '2T', value: 1.9, activeClass: 'bg-emerald-400 text-slate-950 border-emerald-400' },
  { label: '3T', value: 2.7, activeClass: 'bg-sky-400 text-slate-950 border-sky-400' },
  { label: '4T', value: 3.5, activeClass: 'bg-slate-500 text-slate-950 border-slate-500' },
];

function getTierBucket(tier: number): string {
  if (tier <= 1.5) return '1T';
  if (tier <= 2.2) return '2T';
  if (tier <= 3.0) return '3T';
  return '4T';
}

export function TierEditorModal({ onClose }: TierEditorModalProps) {
  const {
    baseChampions,
    champions,
    customTiers,
    ddragonVersion,
    setCustomTier,
    clearCustomTier,
    resetAllCustomTiers,
  } = useDraftStore();

  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [onlyCustomized, setOnlyCustomized] = useState(false);

  const baseTierMap = new Map(baseChampions.map((c) => [c.id, c.tier]));
  const customCount = Object.keys(customTiers).length;

  const filtered = champions.filter((champ) => {
    if (onlyCustomized && !(champ.id in customTiers)) return false;
    if (roleFilter !== 'ALL' && !champ.roles.includes(roleFilter)) return false;
    return matchesChampionQuery(champ.nameKo, champ.name, query);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100">
              챔피언 티어 커스텀 설정
            </h2>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              커스텀 {customCount}명 적용 중
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {customCount > 0 && (
              <button
                type="button"
                onClick={resetAllCustomTiers}
                className="inline-flex items-center gap-1 rounded-md border border-rose-800/70 bg-rose-950/40 px-2.5 py-1.5 font-semibold text-rose-300 hover:bg-rose-900/50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                전체 기본값 복원
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 필터 & 검색 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                roleFilter === 'ALL'
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
                onClick={() => setRoleFilter(role)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  roleFilter === role
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setOnlyCustomized((prev) => !prev)}
              className={`ml-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                onlyCustomized
                  ? 'border-amber-400/70 bg-amber-400/15 text-amber-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              수정된 챔피언만
            </button>
          </div>

          <div className="relative min-w-[180px] flex-1 sm:max-w-[230px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="챔피언 검색 (초성 지원)"
              className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 챔피언 티어 리스트 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-500">
              조건에 맞는 챔피언이 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((champ) => {
                const isCustom = champ.id in customTiers;
                const defaultTier = baseTierMap.get(champ.id) ?? champ.tier;
                const bucket = getTierBucket(champ.tier);

                return (
                  <div
                    key={champ.id}
                    className={`flex items-center justify-between gap-2.5 rounded-lg border p-2 ${
                      isCustom
                        ? 'border-amber-500/50 bg-amber-950/15'
                        : 'border-slate-800 bg-slate-950/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <img
                        src={getChampionIconUrl(champ.id, ddragonVersion)}
                        alt={champ.nameKo}
                        loading="lazy"
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-slate-100">
                            {champ.nameKo}
                          </span>
                          {isCustom && (
                            <span className="rounded bg-amber-400/20 px-1 text-[9px] font-bold text-amber-300">
                              수정됨
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {champ.roles.join('/')} · 기본 {defaultTier.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {TIER_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setCustomTier(champ.id, preset.value)}
                          className={`rounded border px-1.5 py-1 text-[10px] font-extrabold transition ${
                            bucket === preset.label
                              ? preset.activeClass
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}

                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        value={champ.tier}
                        onChange={(e) => {
                          const parsed = Number.parseFloat(e.target.value);
                          if (!Number.isNaN(parsed)) {
                            setCustomTier(champ.id, parsed);
                          }
                        }}
                        aria-label={`${champ.nameKo} 세부 티어`}
                        className="w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-center text-[11px] font-semibold text-slate-100 focus:border-sky-500 focus:outline-none"
                      />

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => clearCustomTier(champ.id)}
                          title="기본 티어로 복원"
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-5 py-3 text-[11px] text-slate-400">
          <span>
            설정한 티어는 브라우저에 자동 저장되며 AI 밴픽 및 조합 분석에 즉시
            반영됩니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
