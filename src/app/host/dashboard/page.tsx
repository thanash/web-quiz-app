'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quiz {
  id: string;
  title: string;
  updatedAt: string;
  _count: { questions: number };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/host/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/web-quiz-app/api/host/quizzes')
      .then(r => r.json())
      .then(data => { setQuizzes(data); setLoading(false); });
  }, [status]);

  async function createQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch('/web-quiz-app/api/host/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setNewTitle('');
      router.push(`/host/quiz/${data.id}/edit`);
    }
  }

  async function startSession(quizId?: string) {
    const res = await fetch('/web-quiz-app/api/host/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quizId || null }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/host/session/${data.roomCode}`);
  }

  async function deleteQuiz(id: string) {
    if (!confirm('このクイズを削除しますか？')) return;
    await fetch(`/web-quiz-app/api/host/quizzes/${id}`, { method: 'DELETE' });
    setQuizzes(prev => prev.filter(q => q.id !== id));
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <h1 className="text-xl font-bold">🎯 Web Quiz</h1>
        <div className="flex items-center gap-4">
          <span className="text-indigo-200 text-sm">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/host/login' })}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-lg transition"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* アドリブセッション開始 */}
        <div className="bg-indigo-600 text-white rounded-2xl p-5 flex justify-between items-center shadow">
          <div>
            <p className="font-bold text-lg">今すぐ出題</p>
            <p className="text-indigo-200 text-sm">クイズなしでアドリブ出題を開始</p>
          </div>
          <button
            onClick={() => startSession()}
            className="bg-white text-indigo-700 font-bold px-4 py-2 rounded-xl hover:bg-indigo-50 transition"
          >
            開始
          </button>
        </div>

        {/* クイズ新規作成 */}
        <form onSubmit={createQuiz} className="bg-white rounded-2xl p-5 shadow space-y-3">
          <h2 className="font-bold text-gray-700">新しいクイズを作成</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="クイズのタイトル"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition font-bold"
            >
              作成
            </button>
          </div>
        </form>

        {/* クイズ一覧 */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-700">クイズ一覧</h2>
          {quizzes.length === 0 ? (
            <p className="text-gray-400 text-sm">まだクイズがありません</p>
          ) : (
            quizzes.map(q => (
              <div key={q.id} className="bg-white rounded-2xl p-4 shadow flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">{q.title}</p>
                  <p className="text-sm text-gray-400">{q._count.questions}問</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/host/quiz/${q.id}/edit`}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => startSession(q.id)}
                    className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 rounded-lg transition"
                  >
                    開始
                  </button>
                  <button
                    onClick={() => deleteQuiz(q.id)}
                    className="text-sm bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded-lg transition"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
