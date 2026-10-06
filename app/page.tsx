import NoticeBanner from "@/components/NoticeBanner";

// Design Ref: §5.1 — 한 페이지 앱의 틀(헤더 → 안내 문구 → 진행판 영역)
// 진행판(Board)은 PLAN 작업 C 묶음에서 이 자리에 들어온다.
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          업무 진행판
        </h1>
        <NoticeBanner />
      </header>

      <main className="flex flex-1 flex-col">
        {/* 진행판 영역: 업무 등록 폼·현황 막대·업무 카드·요약 패널이 들어올 자리 */}
        <section
          aria-label="진행판"
          className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          <p>진행판을 준비하고 있습니다.</p>
        </section>
      </main>
    </div>
  );
}
