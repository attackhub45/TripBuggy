import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { useTripStore } from '../state/tripStore';
import { QUESTIONS } from '../state/questions';
import { SceneCrop } from '../art/DestinationArt';

export function FlowScreen() {
  const navigate = useNavigate();
  const { answers, answeredOrder, answerQuestion, destKey } = useTripStore(useShallow((s) => ({
    answers: s.answers,
    answeredOrder: s.answeredOrder,
    answerQuestion: s.answerQuestion,
    destKey: s.destKey,
  })));

  const step = answeredOrder.length;
  const question = QUESTIONS[step];

  function select(value: string) {
    if (!question) return;
    answerQuestion(question.key, value);
    if (step === QUESTIONS.length - 1) {
      navigate('/summary');
    }
  }

  function goBack() {
    if (step === 0) {
      navigate('/');
      return;
    }
    const prevKey = answeredOrder[step - 1];
    const newOrder = answeredOrder.slice(0, -1);
    useTripStore.setState((s) => {
      const answers = { ...s.answers };
      delete answers[prevKey];
      return { answers, answeredOrder: newOrder };
    });
  }

  if (!question) return null;

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <TopBar progress={{ total: QUESTIONS.length, current: step }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button className="btn-text" onClick={goBack} style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>‹ Back</button>
        <h2 style={{ fontSize: 30 }}>{question.prompt}</h2>
        <div className="chips">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`chip${answers[question.key] === opt ? ' selected' : ''}`}
              onClick={() => select(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      {answeredOrder.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 2px' }} aria-hidden="true">
          {answeredOrder.map((_, i) => (
            <div key={i} style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <SceneCrop destKey={destKey} cropIndex={i} size={64} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
