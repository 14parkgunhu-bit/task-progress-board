import Board from "@/components/Board";
import NoticeBanner from "@/components/NoticeBanner";

// Design Ref: §5.1 — 한 페이지 앱의 틀(헤더 → 안내 문구 → 진행판)
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">업무 진행판</h1>
        <NoticeBanner />
      </header>

      <main className="flex flex-1 flex-col">
        <Board />
      </main>
    </div>
  );
}
