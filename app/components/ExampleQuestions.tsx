export const EXAMPLE_QUESTIONS = [
  "정보주체의 권리는 무엇인가요?",
  "개인정보 유출 시 신고 절차는?",
  "가명정보는 동의 없이 처리할 수 있나요?",
  "영상정보처리기기 설치 제한 규정은?",
];

interface ExampleQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function ExampleQuestions({ onSelect, disabled }: ExampleQuestionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-navy-700/60 uppercase">
        Try an example
      </span>
      <div role="group" aria-label="Example questions" className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-full border border-navy-900/10 bg-mist-50 px-3.5 py-1.5 text-sm text-navy-800 transition-all outline-none hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-blue-500/5 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
