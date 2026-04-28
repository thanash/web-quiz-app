'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

type Phase = 'lobby' | 'question' | 'reveal' | 'ranking' | 'finished';

interface Question {
  id: string;
  order: number;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  imageUrl?: string;
}

interface AnswerCount { count: number; total: number }
interface AnswerResult { playerId: string; nickname: string; selectedIndex: number; isCorrect: boolean; score: number }
interface RankingEntry { playerId: string; nickname: string; totalScore: number }
interface Player { playerId: string; nickname: string }

const emptyAdlib = () => ({
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimitSec: 20,
  imageUrl: '',
});

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function HostSessionPage() {
  const { data: authSession, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const socket = useSocket();

  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<Player[]>([]);
  const [presetQuestions, setPresetQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [answerCount, setAnswerCount] = useState<AnswerCount>({ count: 0, total: 0 });
  const [answerList, setAnswerList] = useState<AnswerResult[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [adlib, setAdlib] = useState(emptyAdlib());
  const [showAdlib, setShowAdlib] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/host/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch(`/web-quiz-app/api/host/sessions/${roomCode}`)
      .then(r => r.json())
      .then(data => {
        if (data.quiz?.questions) setPresetQuestions(data.quiz.questions);
      });
  }, [status, roomCode]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    socket.emit('host:join', { roomCode, hostId: authSession?.user?.id });

    socket.on('room:players', (ps: Player[]) => setPlayers(ps));
    socket.on('host:answer_count', (ac: AnswerCount) => setAnswerCount(ac));

    return () => {
      socket.off('room:players');
      socket.off('host:answer_count');
    };
  }, [socket, roomCode, authSession, status]);

  // タイマー
  useEffect(() => {
    if (phase !== 'question' || !currentQuestion) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, currentQuestion.timeLimitSec - elapsed);
      setTimeLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [phase, currentQuestion, startedAt]);

  function emitQuestion(q: Question) {
    socket.emit('host:question', {
      roomCode,
      question: { ...q, id: q.id || `adlib-${Date.now()}` },
    });
    setCurrentQuestion(q);
    setCorrectIndex(q.correctIndex);
    setAnswerCount({ count: 0, total: players.length });
    setStartedAt(Date.now());
    setTimeLeft(q.timeLimitSec);
    setPhase('question');
    setShowAdlib(false);
    fetch(`/web-quiz-app/api/host/sessions/${roomCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', currentQuestionIndex: currentQuestionIndex + 1 }),
    });
  }

  function startPreset(index: number) {
    setCurrentQuestionIndex(index);
    emitQuestion(presetQuestions[index]);
  }

  function startAdlib(e: React.FormEvent) {
    e.preventDefault();
    const options = adlib.options.filter(o => o.trim());
    if (options.length < 2) { alert('選択肢を2つ以上入力してください'); return; }
    emitQuestion({ ...adlib, options, id: `adlib-${Date.now()}`, order: 0 });
    setAdlib(emptyAdlib());
  }

  const revealAnswer = useCallback(async () => {
    socket.emit('host:reveal', { roomCode });

    // 回答をDBに保存しランキング取得
    if (currentQuestion && answerList.length > 0) {
      const res = await fetch(`/web-quiz-app/api/host/sessions/${roomCode}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerList, questionId: currentQuestion.id }),
      });
      const data = await res.json();
      if (data.ranking) setRanking(data.ranking.map((r: { id: string; nickname: string; totalScore: number }) => ({ playerId: r.id, nickname: r.nickname, totalScore: r.totalScore })));
    }
    setPhase('reveal');
  }, [socket, roomCode, currentQuestion, answerList]);

  socket.on('game:reveal', ({ answerList: al, correctIndex: ci }: { answerList: AnswerResult[]; correctIndex: number; distribution: number[] }) => {
    setAnswerList(al);
    setCorrectIndex(ci);
  });

  function showRanking() {
    const r = ranking.length > 0 ? ranking : [];
    socket.emit('host:ranking', { roomCode, ranking: r });
    setPhase('ranking');
  }

  async function finishSession() {
    if (!confirm('セッションを終了しますか？')) return;
    socket.emit('host:finish', { roomCode, finalRanking: ranking });
    await fetch(`/web-quiz-app/api/host/sessions/${roomCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'FINISHED' }),
    });
    setPhase('finished');
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-indigo-800 px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">ホスト操作パネル</h1>
          <p className="text-indigo-300 text-sm">ルームコード: <span className="font-mono font-black text-white text-xl tracking-widest">{roomCode}</span></p>
        </div>
        <button onClick={finishSession} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-sm transition">終了</button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">

        {/* ロビー */}
        {phase === 'lobby' && (
          <div className="bg-gray-800 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-3">参加者 ({players.length}人)</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {players.map(p => (
                <span key={p.playerId} className="bg-indigo-700 px-3 py-1 rounded-full text-sm">{p.nickname}</span>
              ))}
              {players.length === 0 && <p className="text-gray-400 text-sm">まだ誰も入室していません</p>}
            </div>
          </div>
        )}

        {/* 問題進行中 */}
        {phase === 'question' && currentQuestion && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>残り時間</span>
                <span className="text-yellow-400 font-bold text-2xl">{Math.ceil(timeLeft)}s</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                <div
                  className="bg-yellow-400 h-3 rounded-full transition-all duration-100"
                  style={{ width: `${(timeLeft / currentQuestion.timeLimitSec) * 100}%` }}
                />
              </div>
              <p className="font-semibold text-lg">{currentQuestion.text}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {currentQuestion.options.map((opt, i) => (
                  <div key={i} className={`${OPTION_COLORS[i]} rounded-xl p-3`}>
                    <span className="font-black">{OPTION_LABELS[i]}</span> {opt}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4 text-center">
              <p className="text-3xl font-black text-yellow-400">{answerCount.count}</p>
              <p className="text-gray-400 text-sm">/ {answerCount.total}人 回答済み</p>
            </div>
            <button
              onClick={revealAnswer}
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold py-3 rounded-xl text-lg transition"
            >
              正解を発表する
            </button>
          </div>
        )}

        {/* 正解発表 */}
        {phase === 'reveal' && currentQuestion && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400 mb-1">正解</p>
              <p className="text-2xl font-black text-green-400">{currentQuestion.options[correctIndex]}</p>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <h3 className="font-bold mb-3">参加者の回答</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {answerList.map(a => (
                  <div key={a.playerId} className="flex justify-between items-center">
                    <span className="text-sm">{a.nickname}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{currentQuestion.options[a.selectedIndex]}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${a.isCorrect ? 'bg-green-700 text-green-200' : 'bg-red-900 text-red-200'}`}>
                        {a.isCorrect ? `+${a.score}` : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={showRanking}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl text-lg transition"
            >
              ランキングを表示
            </button>
          </div>
        )}

        {/* ランキング */}
        {phase === 'ranking' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-2xl p-4">
              <h2 className="text-xl font-bold mb-3 text-center">🏆 ランキング</h2>
              {ranking.slice(0, 10).map((r, i) => (
                <div key={r.playerId} className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="font-bold w-8">{i + 1}</span>
                  <span className="flex-1">{r.nickname}</span>
                  <span className="font-bold text-yellow-400">{r.totalScore}pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 次の問題へ / アドリブ出題ボタン */}
        {(phase === 'lobby' || phase === 'ranking') && (
          <div className="space-y-3">
            {/* 事前クイズから出題 */}
            {presetQuestions.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-4">
                <h3 className="font-bold mb-2 text-sm text-gray-400">事前問題</h3>
                <div className="space-y-2">
                  {presetQuestions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => startPreset(i)}
                      className="w-full text-left bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm transition"
                    >
                      <span className="text-gray-400 mr-2">Q{i + 1}</span>{q.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* アドリブ出題 */}
            <div className="bg-gray-800 rounded-2xl p-4">
              <button
                onClick={() => setShowAdlib(p => !p)}
                className="w-full font-bold text-indigo-400 text-left flex justify-between"
              >
                <span>+ アドリブ出題</span>
                <span>{showAdlib ? '▲' : '▼'}</span>
              </button>
              {showAdlib && (
                <form onSubmit={startAdlib} className="mt-3 space-y-3">
                  <textarea
                    value={adlib.text}
                    onChange={e => setAdlib(p => ({ ...p, text: e.target.value }))}
                    placeholder="問題文"
                    required
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {adlib.options.map((opt, i) => (
                      <div key={i} className="flex gap-1">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => {
                            const opts = [...adlib.options];
                            opts[i] = e.target.value;
                            setAdlib(p => ({ ...p, options: opts }));
                          }}
                          placeholder={`選択肢${OPTION_LABELS[i]}`}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setAdlib(p => ({ ...p, correctIndex: i }))}
                          className={`text-xs px-2 rounded ${i === adlib.correctIndex ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-400'}`}
                        >
                          正
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={adlib.timeLimitSec}
                      onChange={e => setAdlib(p => ({ ...p, timeLimitSec: Number(e.target.value) }))}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                    >
                      {[10, 15, 20, 30, 45, 60].map(t => <option key={t} value={t}>{t}秒</option>)}
                    </select>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold py-2 rounded-xl text-sm transition"
                    >
                      出題開始！
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 終了 */}
        {phase === 'finished' && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="text-2xl font-bold mb-2">セッション終了</h2>
            <button onClick={() => router.push('/host/dashboard')} className="mt-4 bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-xl transition">
              ダッシュボードへ
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
