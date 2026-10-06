# 업무 진행판 DESIGN (PDCA 1사이클)

> **요약**: PLAN.md의 29개 작업을 구현하기 위한 화면 구성·데이터 흐름·기술 선택·파일 구조 설계
>
> **프로젝트**: 업무 진행판 (myapp) · **버전**: 0.1.0 · **작성자**: 박건후 · **작성일**: 2026-10-06 · **상태**: Draft
> **기준 문서**: [PRD.md](PRD.md) → [PLAN.md](PLAN.md) → 이 문서 · 작업 규칙: [CLAUDE.md](CLAUDE.md)
> **선택한 설계안**: C. 실용 균형 · **추가 기술**: 없음 (Next.js + Node.js 기본 기능만 사용)

---

## Context Anchor

| 키 | 값 |
|---|---|
| **WHY** | 흩어진 업무 정보 때문에 진행 상황 파악·마감 관리·보고 정리에 시간이 든다. |
| **WHO** | 여러 행정 업무를 동시에 맡은 담당자(개인 사용), 요약을 받아보는 상급자(간접). |
| **RISK** | AI가 숫자·사실을 틀리게 쓰거나, 늦은 응답이 사용자 수정을 덮어쓰거나, 공개 배포 후 API가 남용되는 것. |
| **SUCCESS** | must 2개가 PRD 흐름대로 동작 + 서버 검증·사실 검사·오류 대비·남용 방지 완비 + lint·build 통과 + 갭 분석 90% 이상. |
| **SCOPE** | 기초 로직 → AI 없는 앱 → AI 공통 → must 1 → must 2 → 오류·안전 → 점검 (nice·비범위 제외). |

---

## 1. 개요

### 1.1 설계 목표
- 진행률·상태·요약 규칙을 **한 곳(`lib/`)** 에 두고 화면·서버·기본 요약이 모두 같은 함수를 쓴다.
- AI는 **서버에서만** 호출하고, 서버는 **AI가 쓴 숫자를 믿지 않고 직접 다시 계산해 대조**한다.
- AI가 실패하거나 늦어도 **사용자의 데이터와 작업 흐름은 멈추지 않는다.**

### 1.2 설계 원칙
1. **계산은 앱, 문장은 AI** — 진행률·상태·건수는 항상 `lib/` 함수가 계산한다.
2. **서버는 아무것도 믿지 않는다** — 화면이 보낸 값·AI가 보낸 값 모두 서버에서 다시 검사한다.
3. **최소 전송** — AI 요약에는 메모·할 일 제목을 보내지 않고 업무명·마감일·할 일 개수만 보낸다.
4. **덮어쓰지 않기** — AI 결과는 항상 "제안"이며, 버전이 같고 사용자가 [저장]을 눌러야만 반영된다.

---

## 2. 기술 선택과 구조

### 2.0 설계안 비교 (선택: C)

| 기준 | A. 최소 변경 | B. 클린 아키텍처 | **C. 실용 균형 ✅** |
|---|---|---|---|
| 파일 수 | 약 6개 | 40개 이상 | 약 25개 |
| 구조 | 화면 전부 `page.tsx` 한 파일 | 도메인/응용/인프라/화면 4층 | 규칙(`lib`) · 서버 전용(`lib/server`) · 화면 조각(`components`) |
| 고치기 쉬움 | 낮음 (1,000줄 이상) | 높음 | 높음 |
| 초보자 이해 | 처음엔 쉬움 | 어려움 | 보통 |
| 선택 이유 | — | — | 규칙을 한 곳에서 점검할 수 있고, 이 규모에 과하지 않음 |

### 2.1 기술 선택

| 기술 | 쉬운 설명 | 쓰는 곳 |
|---|---|---|
| **Next.js 16 (App Router)** | 화면과 서버 기능을 한 프로젝트에 담는 웹 프레임워크. Vercel에 그대로 올라간다. | 전체 |
| React 19 | 버튼·목록 같은 화면 조각을 만드는 도구 (Next.js에 포함) | 화면 |
| TypeScript | 데이터 모양을 미리 정해 실수를 줄이는 문법 (설치됨) | 전체 |
| Tailwind CSS v4 | 클래스 이름만으로 색·간격을 꾸미는 도구 (설치됨) | 화면 |
| Route Handler (`app/api/**/route.ts`) | Next.js 안에 만드는 "서버 창구". API 키를 숨긴 채 AI를 부른다. | AI 호출 |
| 브라우저 `localStorage` | 사용자 컴퓨터의 브라우저 안에 작은 데이터를 저장하는 칸. 서버·DB가 필요 없다. | 업무 저장 |
| `fetch` (기본 기능) | 다른 서버에 요청을 보내는 기본 함수. OpenAI 전용 패키지 없이 AI를 부른다. | AI 호출 |
| `import 'server-only'` | 이 파일이 실수로 화면 코드에 섞이면 빌드를 막아주는 표시 (Next.js 내장, 설치 불필요) | `lib/server/` |
| Node.js 내장 테스트 (`node --test`) | 계산 함수가 맞는지 자동으로 확인하는 도구. Node 24에 들어 있어 설치 불필요. | `tests/` |
| `node:crypto` | 접근 코드를 안전하게 비교하는 기본 기능 (설치 불필요) | 접근 코드 |

**추가 기술 제안: 없음.** 아래는 검토했지만 넣지 않은 것이다.
- *OpenAI 공식 패키지* — `fetch`로 충분해서 넣지 않음.
- *Zod(입력 검사 도구)* — 검사할 항목이 적어 직접 만든 함수로 충분함.
- *Upstash Redis(공용 카운터 저장소)* — 호출 제한을 정확히 셀 수 있지만 외부 가입·키가 더 필요해 이번엔 제외 (위험과 대응은 7장).

### 2.2 구성도

```
┌──────────────────────── 브라우저 (사용자 컴퓨터) ────────────────────────┐
│  app/page.tsx ─▶ components/Board (진행판 전체, 클라이언트)              │
│     ├ TaskForm   ├ TaskCard(+StepList, StepProposal)   ├ SummaryPanel    │
│     └ hooks/useBoard ──▶ lib/storage ──▶ localStorage ("task-board:v1")   │
│                     └──▶ lib/progress·status·summary (계산은 여기서만)    │
└───────────────┬──────────────────────────────────────────┬──────────────┘
                │ POST /api/steps                          │ POST /api/summary
┌───────────────▼──────────────── 서버 (Vercel) ───────────▼──────────────┐
│ app/api/steps/route.ts            app/api/summary/route.ts               │
│   └ lib/server/guard (접근 코드 → 호출 제한 → 입력 검사)                  │
│   └ lib/server/ai (fetch, 15초 제한, 재시도 1회)                         │
│   └ lib/validate-steps / lib/check-summary (형식·사실 검사)              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS (OPENAI_API_KEY)
                         ┌──────▼──────┐
                         │  OpenAI API │
                         └─────────────┘
```

### 2.3 데이터 흐름 (입력 → 처리 → 출력)

**① 업무 등록·체크 (AI 없음, 브라우저 안에서 끝남)**
```
입력: 업무명·마감일·메모 / 할 일 체크
 → 처리: 길이 검사 → 업무 revision +1, 보드 revision +1 → lib 계산(진행률·상태) → localStorage 저장
 → 출력: 진행판 카드의 진행률·상태 색이 즉시 바뀜
```

**② AI 단계 쪼개기 (must 1)**
```
입력: [AI로 단계 나누기] 클릭 (업무명·마감일·메모 + 오늘 날짜)
 → 브라우저: 요청 번호 발급, 요청 당시 업무 revision 기록 → POST /api/steps
 → 서버: 접근 코드 → 호출 제한 → 입력 검사 → 프롬프트(PRD 규칙 1~5) → AI(JSON 모드, 15초)
        → JSON 검증 실패/시간 초과면 1회 재시도 → 그래도 실패면 오류 응답
 → 브라우저: 응답이 "마지막 요청"이고 revision이 같을 때만 제안 패널 표시
            (다르면 "제안을 적용하지 않았습니다" + [제안 보기]/[다시 요청], 업무가 지워졌으면 버림)
 → 출력: 제안 목록 → 사용자가 수정 → [저장]을 눌러야 할 일로 반영 (revision +1)
```

**③ AI 진행 요약 (must 2)**
```
입력: [요약 만들기] 클릭
 → 브라우저: 업무마다 {업무명, 마감일, 전체 할 일 수, 완료 수}만 추려서 + 오늘 날짜 + 요청 당시 보드 revision 기록
            → POST /api/summary (메모·할 일 제목은 보내지 않음)
 → 서버: 접근 코드 → 호출 제한 → 입력 검사
        → lib로 진행률·상태·순서를 직접 다시 계산 → "정답 사실표"와 기본 요약 생성
        → 프롬프트(PRD 규칙 1~7 + 정답 사실표) → AI(15초)
        → 형식 검사(5줄·60자) + 사실 검사(정답 사실표와 줄마다 대조) → 실패면 1회 재시도
        → 그래도 실패면 { fallback: 기본 요약 } 응답
 → 브라우저: 마지막 요청의 응답만 표시. 그사이 보드 revision이 바뀌었으면 "바뀌었음" 표시 + [다시 요약], 복사 비활성
 → 출력: 5줄 요약 + [복사]
```

### 2.4 의존 관계

| 모듈 | 의존하는 것 | 목적 |
|---|---|---|
| `components/*` | `hooks/useBoard`, `lib/*` (서버 전용 제외) | 화면 표시 |
| `hooks/useBoard` | `lib/storage`, `lib/types` | 저장·버전 관리 |
| `app/api/*/route.ts` | `lib/server/*`, `lib/*` | 서버 창구 |
| `lib/server/*` | `lib/*` | AI 호출·보호 장치 (화면에서 import 금지) |
| `lib/*` (순수 함수) | 없음 (서로만 참조) | 규칙 계산 — 화면·서버·테스트 공용 |

---

## 3. 데이터 모델

### 3.1 데이터 형태 (`lib/types.ts`)

```ts
// 할 일 하나
type Step = {
  id: string;          // crypto.randomUUID()
  title: string;       // 30자 이내 권장 (직접 입력은 50자까지 허용)
  dueDate?: string;    // 권장 완료일 "YYYY-MM-DD" (AI 제안 시)
  done: boolean;       // 체크 여부
};

// 업무 하나
type Task = {
  id: string;
  title: string;       // 1~50자
  dueDate: string;     // 마감일 "YYYY-MM-DD" (필수)
  memo: string;        // 0~1,000자
  steps: Step[];
  revision: number;    // 수정 버전 번호 — 업무명·마감일·메모·할 일이 바뀔 때마다 +1
  createdAt: string;   // ISO 시각
  updatedAt: string;
};

// 저장 단위 (localStorage "task-board:v1")
type BoardData = {
  schemaVersion: 1;
  revision: number;    // 보드 전체 버전 — 어떤 업무든 바뀌면 +1 (요약 최신 여부 판단용)
  tasks: Task[];
};

// 계산 결과 (저장하지 않고 매번 계산)
type TaskStatus = "done" | "overdue" | "dueSoon" | "normal"; // 완료·지연·임박·정상
type TaskView = {
  task: Task;
  total: number; doneCount: number; remaining: number;
  progress: number;    // 0~100 정수 (미완료 있으면 최대 99)
  status: TaskStatus;
  dDay: number;        // 마감일 - 오늘 (음수면 지남)
};
```

### 3.2 핵심 규칙 함수 (`lib/`, 순수 함수)

| 함수 | 규칙 (PRD 5장) |
|---|---|
| `calcProgress(total, doneCount)` | 0개면 0 · `Math.round(done/total*100)` · 미완료가 있으면 `min(결과, 99)` |
| `isComplete(total, doneCount)` | `total ≥ 1 && doneCount === total` (퍼센트로 판정하지 않음) |
| `calcStatus(total, doneCount, dueDate, today)` | 완료 → 지연(dDay < 0) → 임박(0 ≤ dDay ≤ 3) → 정상 |
| `diffDays(dueDate, today)` | 두 "YYYY-MM-DD"를 날짜만으로 비교 (시각·시간대 무시) |
| `pickSummaryOrder(views)` | 미완료를 지연 → 임박 → 정상, 같은 상태는 마감일 빠른 순 |
| `buildBasicSummary(views)` | PRD 형식 1~5줄 문자열 + 줄별 "정답 사실" 반환 |

### 3.3 "오늘" 날짜 정하기
- 기준은 **사용자 브라우저의 현지 날짜**(예: 한국 시간). 서버(Vercel)는 UTC라 날짜가 다를 수 있다.
- 브라우저가 요청에 `today`를 함께 보내고, 서버는 `today`가 서버 날짜 ±1일 안인지만 확인한 뒤 그 값을 기준으로 계산한다.

---

## 4. API 명세

### 4.1 목록

| 메서드 | 주소 | 하는 일 | 보호 |
|---|---|---|---|
| POST | `/api/steps` | 업무를 할 일로 쪼갠 제안 받기 | 접근 코드 + 호출 제한 |
| POST | `/api/summary` | 진행판 전체 요약 받기 | 접근 코드 + 호출 제한 |

공통 요청 헤더: `x-access-code: <사용자가 입력한 접근 코드>`
두 API는 **같은 호출 제한 계수기**를 함께 쓴다 (접속자 IP당 1분 5회·하루 50회).

### 4.2 `POST /api/steps`

**요청**
```json
{ "title": "가을 체육행사 준비", "dueDate": "2026-10-20", "memo": "참가 인원 약 80명", "today": "2026-10-06" }
```
- 검사: `title` 1~50자, `memo` 0~1,000자, 날짜 형식, `dueDate ≥ today`, `today`는 서버 날짜 ±1일.

**성공 응답 (200)**
```json
{ "status": "ok", "steps": [ { "title": "행사 장소 예약하기", "dueDate": "2026-10-09" } ] }
```
```json
{ "status": "need_more_info", "question": "어떤 행사를 준비하는지 조금 더 구체적으로 적어주세요." }
```
- AI 응답 검증(PRD 5장): `steps` 3~7개, `title` 30자 이내·"하기"로 끝남·중복 없음, `dueDate`는 `today` 이상 업무 마감일 이하.

### 4.3 `POST /api/summary`

**요청** (메모·할 일 제목은 보내지 않음)
```json
{ "today": "2026-10-06",
  "tasks": [ { "title": "가을 체육행사 준비", "dueDate": "2026-10-08", "total": 5, "done": 2 } ] }
```
- 검사: 업무 0~100건, 각 `title` 1~50자, `0 ≤ done ≤ total ≤ 50`.

**성공 응답 (200)**
```json
{ "source": "ai", "lines": ["전체 3건 | 완료 1 · 지연 0 · 임박 1 · 정상 1", "⚠ [임박] 가을 체육행사 준비 – 진행률 40% – 남은 할 일 3개 – 마감 10/08"] }
```
- AI가 재시도 후에도 실패하면: `{ "source": "fallback", "lines": [...기본 요약...], "reason": "AI_INVALID" }` (200)
- 업무가 0건이면 AI를 부르지 않고 `{ "source": "basic", "lines": ["전체 0건 | 완료 0 · 지연 0 · 임박 0 · 정상 0"] }`

**사실 검사 방법**: 서버가 같은 입력으로 `buildBasicSummary`를 실행해 "정답 사실표"를 만들고, AI가 쓴 각 줄에서 업무명·상태·진행률·남은 할 일·마감일·건수를 읽어내 정답과 한 글자도 다르지 않은지 비교한다. 줄 순서도 정답 순서와 같아야 한다.

---

## 5. 화면 설계

### 5.1 화면 구성 (한 페이지, `/`)

```
┌──────────────────────────────────────────────────────────────┐
│ 업무 진행판                                   [접근 코드 ●설정됨] │ ← 헤더
│ ⓘ 이름·주민등록번호·연락처·민원인 정보는 입력하지 마세요.         │ ← 안내 문구 (항상 보임)
│   입력한 내용은 AI 요청 시 외부 AI 제공자에게 전송됩니다.          │
├──────────────────────────────────────────────────────────────┤
│ [ 새 업무 ]  업무명 [__________] 마감일 [____-__-__]             │ ← 업무 등록 폼
│             메모(선택) [__________________________]  [등록]      │
├──────────────────────────────────────────────────────────────┤
│ 전체 5건 | 완료 1 · 지연 1 · 임박 1 · 정상 2                     │ ← 현황 막대
├──────────────────────────────────────────────────────────────┤
│ ┌ 업무 카드 (지연 → 임박 → 정상 → 완료, 같은 상태는 마감 빠른 순) ┐│
│ │ ● 지연  3분기 예산 집행 점검          마감 10/03 (D+3)       ││ ← 상태 배지·색
│ │ ████████░░░░░░  60%   (3/5)                                  ││ ← 진행률 막대
│ │ ☑ 집행 내역 내려받기하기   ☐ 차이 금액 확인하기 ...           ││ ← 할 일 체크
│ │ [+ 할 일 추가] [AI로 단계 나누기] [수정] [삭제]               ││
│ │ ┌ AI 제안 패널 (요청 시 펼쳐짐) ─────────────────────┐        ││
│ │ │ 1. 행사 장소 예약하기  10/09  [수정][빼기]          │        ││
│ │ │ [저장] [취소]                                      │        ││
│ │ └───────────────────────────────────────────────────┘        ││
│ └──────────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│ 보고용 요약                               [요약 만들기]          │ ← 요약 패널
│ ⚠ 요약을 요청한 뒤 진행판이 바뀌었습니다  [다시 요약]  (필요 시)  │
│ 1 전체 5건 | 완료 1 · 지연 1 · 임박 1 · 정상 2                   │
│ 2 ⚠ [지연] 3분기 예산 집행 점검 – 진행률 60% – ...               │
│ (AI 요약 / 기본 요약 표시)                         [복사]        │
└──────────────────────────────────────────────────────────────┘
```
- 화면 폭이 좁으면(휴대폰) 모든 구역을 한 줄로 세로 배치한다.
- 상태 색: 완료 = 회색, 지연 = 진한 빨강, 임박 = 빨강, 정상 = 기본색. 색만으로 구분하지 않도록 배지 글자(완료·지연·임박·정상)를 함께 쓴다.

### 5.2 사용 흐름
업무 등록 → [AI로 단계 나누기] → 제안 확인·수정 → [저장] → 할 일 체크 → 진행률·상태 갱신 → [요약 만들기] → [복사] → 상급자에게 전달

### 5.3 화면 조각 목록

| 조각 | 위치 | 하는 일 |
|---|---|---|
| `Board` | `components/Board.tsx` | 진행판 전체 (클라이언트 컴포넌트, `useBoard` 사용) |
| `NoticeBanner` | `components/NoticeBanner.tsx` | 개인정보·외부 전송 안내 문구 |
| `AccessCodeInput` | `components/AccessCodeInput.tsx` | 접근 코드 입력·상태 표시 (브라우저 sessionStorage에 보관) |
| `TaskForm` | `components/TaskForm.tsx` | 업무 등록·수정 폼 (글자 수 표시) |
| `StatusBar` | `components/StatusBar.tsx` | 전체·상태별 건수 |
| `TaskCard` | `components/TaskCard.tsx` | 업무 1건: 배지, D-day, 진행률 막대, 버튼 |
| `StepList` | `components/StepList.tsx` | 할 일 체크·추가·수정·삭제 |
| `StepProposal` | `components/StepProposal.tsx` | AI 제안 확인·수정·[저장], 추가 입력 요청, 늦은 응답 안내 |
| `SummaryPanel` | `components/SummaryPanel.tsx` | 요약 만들기·표시·바뀌었음 표시·복사 |
| `AiErrorNotice` | `components/AiErrorNotice.tsx` | AI 오류 안내 + [다시 시도] + 대체 수단 |

### 5.4 화면 체크리스트 (Check 단계에서 대조)
- [ ] 안내 문구가 항상 보인다.
- [ ] 업무명 51자·메모 1,001자는 입력되지 않고 남은 글자 수가 보인다.
- [ ] 업무 카드에 상태 배지·D-day·진행률 막대·`완료/전체` 개수가 보인다.
- [ ] 199개 중 198개 완료 업무는 99%·지연/임박/정상 중 하나로 보인다(완료 아님).
- [ ] AI 제안은 [저장] 전까지 할 일 목록에 들어가지 않는다.
- [ ] 제안 요청 후 업무를 고치면 "제안을 적용하지 않았습니다"와 [제안 보기]/[다시 요청]이 보인다.
- [ ] 요약 요청 후 체크를 바꾸면 "바뀌었음"과 [다시 요약]이 보이고 [복사]가 비활성화된다.
- [ ] AI 오류 시 [다시 시도]와 직접 입력칸 3개(단계) / 기본 요약(요약)이 보인다.
- [ ] 저장소를 쓸 수 없으면 "이 브라우저에서는 저장되지 않습니다" 안내가 보이고 앱은 동작한다.

---

## 6. 오류 처리

### 6.1 오류 코드

| 코드 | HTTP | 언제 | 화면 안내 |
|---|---|---|---|
| `INVALID_INPUT` | 400 | 길이·형식·날짜 검사 실패 | 어떤 칸이 잘못됐는지 표시 |
| `UNAUTHORIZED` | 401 | 접근 코드 없음·틀림 | "접근 코드를 확인해주세요" |
| `RATE_LIMITED` | 429 | 1분 5회·하루 50회 초과 | "잠시 후 다시 시도해주세요" (남은 시간 표시) |
| `AI_TIMEOUT` | 504 | 15초 초과가 2번 | "AI 응답을 받지 못했습니다" + [다시 시도] + 대체 수단 |
| `AI_FAILED` | 502 | 네트워크·AI 서버 오류가 2번 | 위와 같음 |
| `AI_INVALID` | 502 | 검증·사실 검사 실패가 2번 | 위와 같음 (요약은 200 + 기본 요약으로 대체) |
| `SERVER_CONFIG` | 500 | 서버에 키·접근 코드 설정이 없음 | "서버 설정 오류" (값은 절대 표시하지 않음) |

### 6.2 오류 응답 형식
```json
{ "error": { "code": "RATE_LIMITED", "message": "잠시 후 다시 시도해주세요.", "retryAfterSec": 42 } }
```

### 6.3 재시도 규칙 (`lib/server/ai.ts`)
- 1회차 실패(시간 초과·네트워크·5xx·검증 실패) → **즉시 1회만** 재시도 → 실패하면 위 코드로 응답.
- 4xx(키 오류 등)는 재시도하지 않는다.
- 두 번 시도하므로 라우트 최대 실행 시간을 40초로 둔다(`export const maxDuration = 40`).

---

## 7. 보안

| 항목 | 설계 |
|---|---|
| API 키 | `process.env.OPENAI_API_KEY`는 `lib/server/ai.ts`에서만 읽는다. 파일 맨 위 `import 'server-only'`. `NEXT_PUBLIC_` 금지. |
| 접근 코드 | 서버 환경변수 `APP_ACCESS_CODE`. 요청 헤더 `x-access-code`와 `node:crypto`의 `timingSafeEqual`로 비교. 개발 환경에서 값이 없으면 검사를 건너뛰고, 배포 환경에서 값이 없으면 모든 AI 요청을 막는다(`SERVER_CONFIG`). |
| 호출 제한 | `lib/server/rate-limit.ts` — 접속자 IP(`x-forwarded-for` 첫 값)별 메모리 계수기, 1분 5회·하루 50회. 서버 인스턴스마다 따로 세어질 수 있음 → 접근 코드 + OpenAI 월 사용 한도로 보완. |
| 입력 길이 | 업무명 50자·메모 1,000자·요약 업무 100건 — 화면과 서버 양쪽에서 검사. |
| 로그 | 서버 로그에는 오류 코드·소요 시간만 남기고 업무명·메모 본문은 남기지 않는다. |
| 저장 위치 | 업무 데이터는 브라우저 `localStorage`에만. 서버·DB 저장 없음. |
| 전송 최소화 | 요약 요청엔 메모·할 일 제목을 보내지 않는다. |
| 프롬프트 주입 | 사용자 입력은 프롬프트 안에서 "데이터" 구역으로 분리하고, 결과는 형식·사실 검사로 걸러낸다. |

---

## 8. 테스트 계획 (추가 설치 없음)

### 8.1 범위

| 종류 | 대상 | 도구 |
|---|---|---|
| 단위 점검 | `lib/` 계산·검증 함수 | `node --test` (Node 24 내장) — `npm test`로 실행 |
| L1 API 점검 | `/api/steps`, `/api/summary` | 개발 서버 + `curl` |
| L2 화면 점검 | 5.4 체크리스트 | 개발 서버를 띄워 브라우저로 직접 확인 |
| L3 전체 흐름 | PRD 4장 흐름, 가상 업무 5건 | 브라우저로 처음부터 끝까지 |

### 8.2 단위 점검 핵심 사례
- 진행률: (0,0)→0 · (5,2)→40 · (199,198)→99 · (3,3)→100 · (200,199)→99
- 완료 판정: (0,0)→아님 · (199,198)→아님 · (1,1)→완료
- 상태 경계: D-4 정상 · D-3 임박 · D-day 임박 · D+1 지연 · 지난 마감이지만 전부 완료 → 완료
- 단계 검증: 2개·8개 → 실패 · 31자 → 실패 · "하기"로 안 끝남 → 실패 · 중복 → 실패 · 마감일 넘는 날짜 → 실패
- 사실 검사: 진행률 1% 다름 → 실패 · 없는 업무명 → 실패 · 순서 바뀜 → 실패 · 6줄 → 실패 · 정답과 같음 → 통과

### 8.3 L1 API 점검
| # | 요청 | 기대 결과 |
|---|---|---|
| 1 | 접근 코드 없이 POST /api/steps (배포 설정) | 401 `UNAUTHORIZED` |
| 2 | 업무명 51자 | 400 `INVALID_INPUT` |
| 3 | 1분 안에 6번째 요청 | 429 `RATE_LIMITED` |
| 4 | 정상 요청 | 200, `steps` 3~7개 또는 `need_more_info` |
| 5 | 요약 정상 요청 | 200, `source`가 `ai` 또는 `fallback`, 5줄 이내 |

### 8.4 가상 데이터
"가을 체육행사 준비", "3분기 예산 집행 점검", "강사 워크숍 운영", "교육 결과 보고서 작성", "상반기 성과 실적서 제출" — 실제 이름·연락처 없음.

---

## 9. 구조 규칙 (설계안 C)

| 층 | 위치 | 규칙 |
|---|---|---|
| 화면 | `app/page.tsx`, `components/`, `hooks/` | `lib/server/`를 import하지 않는다 |
| 규칙(공용) | `lib/*.ts` | 순수 함수만. 화면·서버·브라우저 API(localStorage 제외 파일)에 의존하지 않는다 |
| 서버 전용 | `lib/server/*.ts`, `app/api/**` | 맨 위 `import 'server-only'`. 환경변수는 여기서만 읽는다 |

`lib/` 파일끼리는 `./progress.ts`처럼 **확장자를 붙여** import한다(`node --test`가 바로 읽을 수 있도록). 이를 위해 `tsconfig.json`에 `"allowImportingTsExtensions": true`를 추가한다 — Do 단계 첫 작업에서 빌드가 되는지 확인하고, 안 되면 대안을 보고한다.

---

## 10. 코드 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트 | 파스칼 표기, 파일 하나에 하나 | `TaskCard.tsx` |
| 함수·변수 | 카멜 표기, 영어 | `calcProgress` |
| 상수 | 대문자 스네이크 | `MAX_MEMO_LENGTH = 1000` |
| 주석·안내 문구 | 한국어 | `// 미완료가 남으면 최대 99%` |
| 규칙 숫자 | `lib/limits.ts` 한 곳에 상수로 | 50, 1000, 3, 7, 30, 5, 60, 15000 |

### 10.1 환경변수

| 이름 | 어디서 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | 서버 (`.env`, Vercel) | AI 호출 키 — 이미 있음 |
| `OPENAI_MODEL` | 서버 | 사용할 AI 모델 이름 (없으면 코드의 기본값 사용, Do 단계에서 계정에서 쓸 수 있는 모델로 정함) |
| `APP_ACCESS_CODE` | 서버 | 접근 코드 — **사용자가 직접 `.env`와 Vercel에 입력** (작업 26 전에 안내) |

---

## 11. 구현 안내

### 11.1 파일 구조

```
app/
  layout.tsx              (수정) lang="ko", 제목·설명
  page.tsx                (수정) <Board /> 하나만 표시
  api/steps/route.ts      (새로) 단계 쪼개기 API
  api/summary/route.ts    (새로) 진행 요약 API
components/               (새로) 5.3의 화면 조각 10개
hooks/useBoard.ts         (새로) 저장·불러오기·revision·요청 추적
lib/
  limits.ts               규칙 숫자 상수
  types.ts                데이터 형태
  dates.ts                오늘·D-day 계산
  progress.ts             진행률·완료 판정
  status.ts               상태 판정·정렬
  summary.ts              기본 요약 + 정답 사실표
  validate-input.ts       입력 검사 (화면·서버 공용)
  validate-steps.ts       AI 단계 응답 검증
  check-summary.ts        AI 요약 형식·사실 검사
  storage.ts              localStorage 읽기·쓰기 (브라우저 전용)
  server/ai.ts            OpenAI 호출 (15초, 재시도 1회)
  server/prompts.ts       단계·요약 프롬프트
  server/guard.ts         접근 코드 + 호출 제한 + 오류 응답
  server/rate-limit.ts    IP별 계수기
tests/                    (새로) lib 단위 점검
package.json              (수정) "test": "node --test tests/"
tsconfig.json             (수정) allowImportingTsExtensions
```

### 11.2 구현 순서 (PLAN 작업 번호와 연결)

| 묶음 | PLAN 작업 | 만드는 파일 |
|---|---|---|
| A. 준비 | 1 | `layout.tsx`, `page.tsx`, `NoticeBanner` |
| B. 기초 로직 | 2~7 | `lib/limits·types·dates·progress·status·storage`, `tests/`, `package.json`, `tsconfig.json` |
| C. AI 없는 앱 | 8~13 | `useBoard`, `Board`, `TaskForm`, `TaskCard`, `StepList`, `StatusBar`, `lib/summary`, `SummaryPanel`(기본 요약) |
| D. AI 공통 | 14~15 | `lib/server/ai`, `lib/validate-input` |
| E. must 1 | 16~20 | `lib/server/prompts`, `lib/validate-steps`, `api/steps`, `StepProposal`, `useBoard` 요청 추적 |
| F. must 2 | 21~24 | `lib/check-summary`, `api/summary`, `SummaryPanel`(AI·바뀌었음) |
| G. 안전 | 25~27 | `AiErrorNotice`, `lib/server/guard·rate-limit`, `AccessCodeInput` |
| H. 점검 | 28~29 | (코드 수정 없음) 보안 점검·전체 흐름 측정 |

### 11.3 세션 안내

| 모듈 | 범위 | 브랜치 | 권장 세션 |
|---|---|---|---|
| module-1 | A + B | `feature/app-shell`, `feature/core-logic` | 1회차 |
| module-2 | C | `feature/board-basic` | 2회차 |
| module-3 | D + E | `feature/ai-core`, `feature/ai-steps` | 3회차 |
| module-4 | F | `feature/ai-summary` | 4회차 |
| module-5 | G + H | `feature/safety`, `feature/final-check` | 5회차 |

사용 예: `/pdca do 업무진행판 --scope module-1`

---

## 변경 이력

| 버전 | 날짜 | 내용 | 작성자 |
|---|---|---|---|
| 0.1 | 2026-10-06 | 첫 작성 (설계안 C, 추가 기술 없음) | 박건후 |
