export const EXAMPLE_QUESTIONS = [
  "개인정보 보호법 제29조의 안전조치의무는 무엇인가?",
  "개인정보란 무엇인가요?",
  "개인정보 수집·이용 시 지켜야 할 원칙은?",
  "정보주체의 권리는 무엇인가요?",
];

interface ExampleQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

export function ExampleQuestions({ onSelect, disabled }: ExampleQuestionsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-navy-700/70 uppercase">
        Try an example
      </span>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="rounded-full border border-navy-900/15 bg-white px-3.5 py-1.5 text-sm text-navy-800 transition-colors hover:border-gold-600/50 hover:bg-gold-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
