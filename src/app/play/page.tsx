'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/web-quiz-app/api/participant/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: roomCode.toUpperCase(), studentNumber }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || '入室に失敗しました');
    } else {
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('nickname', data.nickname);
      router.push(`/play/${data.roomCode}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">クイズに参加</h1>
        <p className="text-center text-gray-500 text-sm mb-6">ルームコードと学籍番号を入力してください</p>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ルームコード</label>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="例: ABC123"
              maxLength={6}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学籍番号</label>
            <input
              type="text"
              value={studentNumber}
              onChange={e => setStudentNumber(e.target.value)}
              placeholder="例: 123456"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition text-lg"
          >
            {loading ? '入室中...' : '入室する'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/" className="hover:underline">← トップへ</Link>
        </p>
      </div>
    </div>
  );
}
