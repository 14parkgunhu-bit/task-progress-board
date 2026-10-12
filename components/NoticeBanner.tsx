// Design Ref: §5.1 — 개인정보 입력 금지·외부 AI 전송 안내 문구 (항상 보임)
// Plan SC: PRD 7장 ② 안내 문구를 화면에 유지한다
export default function NoticeBanner() {
  return (
    <aside
      role="note"
      aria-label="개인정보 안내"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p>
        <span aria-hidden="true">ⓘ </span>
        이름·주민등록번호·연락처·민원인 정보와 비공개·대외비 문서 내용은 입력하지 마세요.
      </p>
      <p>입력한 내용은 AI 요청 시 해외 AI 제공자(OpenAI)로 전송됩니다.</p>
    </aside>
  );
}
