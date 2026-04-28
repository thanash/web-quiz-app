'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';

interface Question {
  id: string;
  order: number;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  imageUrl?: string;
}

const emptyQuestion = () => ({
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimitSec: 20,
  imageUrl: '',
});

export default function QuizEditPage() {
  const { status } = useSession();
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQ, setNewQ] = useState(emptyQuestion());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/host/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch(`/web-quiz-app/api/host/quizzes/${quizId}`)
      .then(r => r.json())
      .then(data => {
        setTitle(data.title);
        setQuestions(data.questions);
        setLoading(false);
      });
  }, [status, quizId]);

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const filled = newQ.options.filter(o => o.trim());
    if (filled.length < 2) { alert('選択肢を2つ以上入力してください'); return; }
    const options = newQ.options.filter(o => o.trim());
    setSaving(true);
    const res = await fetch(`/web-quiz-app/api/host/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newQ, options }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setQuestions(prev => [...prev, data]);
      setNewQ(emptyQuestion());
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm('この問題を削除しますか？')) return;
    await fetch(`/web-quiz-app/api/host/quizzes/${quizId}/questions/${id}`, { method: 'DELETE' });
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-700 text-white px-6 py-4 flex items-center gap-4 shadow">
        <button onClick={() => router.push('/host/dashboard')} className="text-indigo-200 hover:text-white">← 戻る</button>
        <h1 className="text-xl font-bold flex-1">{title}</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 既存問題一覧 */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-700">問題一覧（{questions.length}問）</h2>
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Q{i + 1} · {q.timeLimitSec}秒</p>
                  <p className="font-semibold text-gray-800 mb-2">{q.text}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {q.options.map((opt, oi) => (
                      <span
                        key={oi}
                        className={`text-sm px-2 py-1 rounded ${oi === q.correctIndex ? 'bg-green-100 text-green-700 font-bold' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600 ml-2 text-sm">削除</button>
              </div>
            </div>
          ))}
        </div>

        {/* 新規問題追加 */}
        <form onSubmit={addQuestion} className="bg-white rounded-2xl p-5 shadow space-y-4">
          <h2 className="font-bold text-gray-700">問題を追加</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">問題文</label>
            <textarea
              value={newQ.text}
              onChange={e => setNewQ(p => ({ ...p, text: e.target.value }))}
              required
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {newQ.options.map((opt, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  選択肢 {String.fromCharCode(65 + i)}
                  {i === newQ.correctIndex && <span className="text-green-600 ml-1">✓正解</span>}
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const opts = [...newQ.options];
                      opts[i] = e.target.value;
                      setNewQ(p => ({ ...p, options: opts }));
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNewQ(p => ({ ...p, correctIndex: i }))}
                    className={`text-xs px-2 py-1 rounded ${i === newQ.correctIndex ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-green-100'}`}
                  >
                    正解
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">制限時間（秒）</label>
              <select
                value={newQ.timeLimitSec}
                onChange={e => setNewQ(p => ({ ...p, timeLimitSec: Number(e.target.value) }))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
              >
                {[10, 15, 20, 30, 45, 60].map(t => <option key={t} value={t}>{t}秒</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">画像URL（任意）</label>
            <input
              type="url"
              value={newQ.imageUrl}
              onChange={e => setNewQ(p => ({ ...p, imageUrl: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://..."
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {saving ? '追加中...' : '問題を追加'}
          </button>
        </form>
      </main>
    </div>
  );
}
