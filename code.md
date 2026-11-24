# LoL 피어리스 드래프트 시뮬레이터 기획서 (Solo & Comp Analyzer)

## 1. 프로젝트 개요

기존의 단순 1:1 밴픽 툴을 넘어, **피어리스 드래프트(Fearless Draft) 다전제 환경**에서 혼자서도 감코진(감독·코치) 전략을 연습하고 팀 조합의 완성도를 실시간으로 분석할 수 있는 웹 기반 시뮬레이터입니다.

* **핵심 콘셉트:** 피어리스 드래프트 특화 + 솔로 연습용 AI 상대 + 실시간 조합 분석기
* **MVP 개발 전략:** 멀티플레이어 실시간 서버(WebSocket) 없이 **100% 프론트엔드(클라이언트) 기반**으로 구축하여 빠른 프로토타이핑과 높은 몰입감을 확보합니다.

---

## 2. 핵심 기능 명세

### 2.1. 피어리스 드래프트 특화 기능
단순히 이전 세트 픽을 비활성화하는 것을 넘어, Bo3/Bo5 다전제 전체의 자원을 설계하는 경험에 초점을 맞춥니다.

* **룰 프리셋 지원:**
  * **하드 피어리스(기본):** 양 팀이 이전 세트에서 픽한 모든 챔피언 잠금 (글로벌 프로 리그 표준).
  * **소프트 피어리스:** 우리 팀이 이전 세트에서 픽한 챔피언만 잠금.
* **포지션별 가용 풀(Pool) 경고:** 3~4세트 이후 특정 라인의 핵심 챔피언 풀이 얇아질 때 시각적 경고 제공 (예: *"남은 1티어 이니시 서포터: 2명"*).
* **세트별 히스토리 & 분기(What-if) 테스트:** 상단 타임라인에 이전 세트 밴픽 결과를 요약 표시하고, 특정 세트로 되돌아가 다른 선택을 했을 때의 시나리오를 테스트할 수 있는 기능.

### 2.2. 솔로 연습용 AI 상대
딥러닝 모델 대신 **규칙 기반 가중치(Rule-based Scoring) 엔진**을 사용하여 전략적인 AI 상대를 구현합니다.

* **AI 의사결정 기준:** 필수 포지션 필터링, 팀 조합 결핍 보완, 상성 및 시너지 반영, 피어리스 포지션 말리기(Pinch) 전략.
* **AI 성향 프리셋:**
  * **정석 메타형 (`META`):** 티어표 중심의 안정적인 밸런스 픽.
  * **라인전 압박형 (`EARLY`):** 초반 주도권 및 포킹/스노우볼 위주 픽.
  * **한타 밸류형 (`LATE`):** 후반 캐리력 및 광역 CC 위주 픽.

### 2.3. 실시간 조합 분석기
픽이 1개씩 진행될 때마다 블루/레드 양 팀의 조합 상태를 실시간으로 계산해 시각화하고 피드백을 제공합니다.

| 분석 지표 | 계산 방식 (챔피언별 태그 기반) | 유저 피드백 예시 |
| :--- | :--- | :--- |
| **딜 비중 (AD/AP)** | 각 챔피언의 물리/마법 피해 비율 합산 | *"올 AD 조합 위험 — 상대 탱커 방어력 효율 급증"* |
| **조합 균형도** | 앞라인(탱킹), 이니시, 사거리, 라인 클리어 점수화 | *"확정 이니시 수단 부족 — 받아치는 구도 강제됨"* |
| **시간대별 파워커브** | 초·중·후반(0~15 / 15~25 / 25분+) 밸류 그래프 | *"후반 밸류 열세 — 2용 타이밍 전 스노우볼 필수"* |
| **피어리스 자원 소모도** | 현재 세트에 투입한 1티어·핵심 역할군 비율 | *"이번 세트에 탱커 2명 소모 — 4세트 앞라인 부족 예상"* |

### 2.4. 기본 편의 기능
* 포지션별 필터 및 한글 초성 검색 (예: `ㄹㅅ` → 리신)
* 드래프트 완료 후 결과 요약 이미지(PNG) 저장
* 로컬 스토리지 기반 다전제 기록 저장

---

## 3. 기술 스택 및 개발 로드맵

### 3.1. 추천 기술 스택 (초경량 클라이언트 구조)
* **프론트엔드:** React (Next.js 또는 Vite) + TypeScript
* **상태 관리:** Zustand (현재 세트, 잠긴 챔피언 목록, 현재 턴, 양 팀 조합 점수 관리)
* **챔피언 기본 데이터:** Riot 공식 **Data Dragon (DDragon)** API 연동 (최신 패치 챔피언 목록 및 초상화 자동 업데이트)
* **조합 분석용 메타데이터:** 챔피언별 포지션, 티어, 딜 타입, 세부 스탯(1~5점)을 담은 정적 JSON 파일 (초기 MVP는 주요 대회 픽 50~60개 위주로 정교화)

### 3.2. 단계별 로드맵
1. **1단계 (로컬 프로토타입):** 1인 양쪽 조작 버전으로 토너먼트 5밴 룰, 초성 검색, 포지션 필터, 피어리스 잠금 로직 구현.
2. **2단계 (조합 분석기 탑재):** 메타데이터 JSON 구축 및 픽 진행에 따른 실시간 AD/AP 비율·조합 밸런스 시각화 연동.
3. **3단계 (AI 감코진 엔진 탑재):** 규칙 기반 가중치 알고리즘 및 AI 성향 프리셋 적용.
4. **4단계 (고도화 - 선택):** 세트 분기(What-if) 테스트, 결과 이미지 내보내기, 추후 필요 시 WebSocket(Supabase Realtime 등) 기반 멀티플레이어 확장.

---

## 4. 규칙 기반 AI 밴픽 알고리즘 설계 (Pseudocode)

현재 세트의 **조합 균형 보완**과 피어리스 특유의 **남은 챔피언 풀 희소성(포지션 말리기)**을 하나의 점수 체계로 통합한 의사코드입니다.

### 4.1. 기본 데이터 구조

```python
Champion = {
    id: string,
    roles: list[Role],          # 예: ["TOP", "JGL"]
    tier: float,                # 1.0(OP) ~ 5.0(비주류) -> 점수로 변환 시 (6 - tier) * 10
    damageType: "AD" | "AP" | "MIXED",
    stats: {
        frontline: int,         # 앞라인/탱킹 (0~5)
        engage: int,            # 이니시에이팅 (0~5)
        waveClear: int,         # 라인 클리어 (0~5)
        earlyGame: int,         # 초반 주도권 (0~5)
        lateGame: int           # 후반 밸류 (0~5)
    },
    counters: list[string],     # 카운터 치는 챔피언 ID 목록
    synergies: list[string]     # 시너지가 좋은 챔피언 ID 목록
}

DraftState = {
    gameNumber: int,            # 현재 세트 (1 ~ 5)
    phase: "BAN_1" | "PICK_1" | "BAN_2" | "PICK_2",
    aiPicks: list[Champion],
    enemyPicks: list[Champion],
    bannedIds: set[string],
    fearlessLockedIds: set[string], # 이전 세트에서 사용되어 잠긴 챔피언
    aiStyle: "META" | "EARLY" | "LATE" # AI 성향 프리셋
}
```

### 4.2. 포지션 풀 희소성 계산 유틸리티

```python
function getAvailablePool(state: DraftState):
    return [c for c in ALL_CHAMPIONS 
            if c.id not in state.bannedIds 
            and c.id not in state.fearlessLockedIds
            and c.id not in (state.aiPicks + state.enemyPicks)]

function getHighTierCountByRole(availablePool, role):
    # 해당 포지션에서 1~2티어(대회 주류급)로 분류되는 남은 챔피언 수
    return count(c for c in availablePool if role in c.roles and c.tier <= 2.5)
```

### 4.3. 밴(Ban) 의사결정 알고리즘 (포지션 말리기 중심)

1페이즈 밴에서는 OP 챔피언을 견제하고, 2페이즈 밴 및 3세트 이후에는 상대가 아직 뽑지 않은 포지션 중 풀이 얇아진 곳을 집중 공략합니다.

```python
function decideBan(state: DraftState):
    pool = getAvailablePool(state)
    enemyOpenRoles = getUnfilledRoles(state.enemyPicks) # 상대가 아직 안 뽑은 라인
    aiOpenRoles = getUnfilledRoles(state.aiPicks)       # AI가 아직 안 뽑은 라인
    
    candidates = []

    for champ in pool:
        score = 0
        
        # 1. 기본 티어 점수 (OP 챔피언 견제)
        score += (6.0 - champ.tier) * 10

        # 2. [핵심] 피어리스 포지션 말리기 (Pinch) 가산점
        for role in champ.roles:
            if role in enemyOpenRoles:
                remainingHighTier = getHighTierCountByRole(pool, role)
                
                # 남은 1~2티어가 4개 이하로 줄어들기 시작하면 말리기 각 성립
                if remainingHighTier <= 4 and champ.tier <= 2.5:
                    pinchBonus = (5 - remainingHighTier) * 15
                    
                    # AI는 이미 그 라인을 뽑았을 때 말리기 효율 극대화 (자충수 방지)
                    if role not in aiOpenRoles:
                        pinchBonus *= 1.5
                    
                    # 2페이즈 밴이나 3세트 이상일수록 가중치 강화
                    if state.phase == "BAN_2" or state.gameNumber >= 3:
                        pinchBonus *= 1.3
                        
                    score += pinchBonus

        # 3. 상대 조합 시너지 및 우리 팀 카운터 차단
        score += count(e for e in state.enemyPicks if e.id in champ.synergies) * 12
        score += count(a for a in state.aiPicks if a.id in champ.counters) * 15

        candidates.append((champ, score))

    return selectFromTopK(candidates, k=2) # 상위 2개 중 확률적 선택
```

### 4.4. 픽(Pick) 의사결정 알고리즘 (조합 보완 + 자원 선점)

비어 있는 포지션의 챔피언만 후보로 삼고, 현재 팀의 결핍 요소를 해소하며 희소 포지션을 선점하는 데 높은 점수를 부여합니다.

```python
function decidePick(state: DraftState):
    pool = getAvailablePool(state)
    aiOpenRoles = getUnfilledRoles(state.aiPicks)
    enemyOpenRoles = getUnfilledRoles(state.enemyPicks)
    
    # 현재 AI 팀의 조합 상태 요약
    comp = analyzeTeamComp(state.aiPicks)
    # comp = { adCount, apCount, totalFrontline, totalEngage, totalWaveClear }

    candidates = []

    for champ in pool:
        # AI에게 필요한 포지션이 아니면 제외
        validRoles = intersection(champ.roles, aiOpenRoles)
        if isEmpty(validRoles):
            continue

        score = 0

        # 1. 기본 티어 점수
        score += (6.0 - champ.tier) * 10

        # 2. [핵심] 조합 보완 점수 (결핍 해소)
        score += evaluateCompNeed(champ, comp, len(state.aiPicks))

        # 3. [피어리스] 희소 포지션 선점 점수
        # 우리도 필요하고 상대도 필요한데 풀이 마르고 있다면 우선 픽
        for role in validRoles:
            remaining = getHighTierCountByRole(pool, role)
            if role in enemyOpenRoles and remaining <= 3 and champ.tier <= 2.5:
                score += (4 - remaining) * 14

        # 4. 상성(카운터) 및 아군 시너지
        score += count(e for e in state.enemyPicks if e.id in champ.counters) * 14
        score += count(a for a in state.aiPicks if a.id in champ.synergies) * 10

        # 5. AI 성향 프리셋 반영
        if state.aiStyle == "EARLY":
            score += champ.stats.earlyGame * 4
        elif state.aiStyle == "LATE":
            score += champ.stats.lateGame * 4

        candidates.append((champ, score))

    return selectFromTopK(candidates, k=3)
```

### 4.5. 조합 보완 세부 함수 (`evaluateCompNeed`)

후반 픽(3~5픽)으로 갈수록 부족한 역할군에 대한 가중치(`urgency`)를 높여 조합이 무너지는 것을 방지합니다.

```python
function evaluateCompNeed(champ, comp, currentPickCount):
    bonus = 0
    urgency = 1.0 + (currentPickCount * 0.4) # 후반 픽일수록 결핍 해소가 시급함

    # 1. AD / AP 딜 밸런스 보정
    if comp.adCount >= 2 and comp.apCount == 0 and champ.damageType == "AP":
        bonus += 25 * urgency
    if comp.apCount >= 2 and comp.adCount == 0 and champ.damageType == "AD":
        bonus += 25 * urgency
    
    # 올 AD / 올 AP 방지 페널티
    if comp.adCount >= 3 and champ.damageType == "AD":
        bonus -= 30
    if comp.apCount >= 3 and champ.damageType == "AP":
        bonus -= 30

    # 2. 앞라인(탱커) 보강
    if comp.totalFrontline < 4 and champ.stats.frontline >= 3:
        bonus += (champ.stats.frontline * 5) * urgency

    # 3. 이니시 수단 보강
    if comp.totalEngage < 3 and champ.stats.engage >= 3:
        bonus += (champ.stats.engage * 5) * urgency

    # 4. 라인 클리어 보강
    if comp.totalWaveClear < 4 and champ.stats.waveClear >= 4:
        bonus += 10 * urgency

    return bonus
```

### 4.6. 자연스러운 밴픽을 위한 확률적 선택 (`selectFromTopK`)

항상 최고 점수 1등 챔피언만 고르면 매 판 동일한 밴픽이 반복됩니다. 상위 `K`개(보통 2~3개) 후보를 추린 뒤 **점수 비례 확률(Softmax 또는 가중 랜덤)**로 선택하여, AI가 메타와 조합 밸런스를 유지하면서도 매번 유연한 전략을 구사하도록 설계합니다.