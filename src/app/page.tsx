import Link from 'next/link';

export default function TopPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-6">
      <div className="text-center text-white mb-12">
        <h1 className="text-5xl font-extrabold mb-3">🎯 Web Quiz</h1>
        <p className="text-lg text-indigo-200">参加型リアルタイムクイズ</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
        <Link
          href="/play"
          className="flex-1 bg-white text-indigo-700 font-bold text-xl py-6 rounded-2xl shadow-lg text-center hover:bg-indigo-50 transition"
        >
          🙋 参加する
          <p className="text-sm font-normal text-indigo-400 mt-1">学籍番号で入室</p>
        </Link>

        <Link
          href="/host/login"
          className="flex-1 bg-indigo-500 text-white font-bold text-xl py-6 rounded-2xl shadow-lg text-center hover:bg-indigo-400 transition border-2 border-indigo-300"
        >
          🎤 ホスト
          <p className="text-sm font-normal text-indigo-200 mt-1">出題者はこちら</p>
        </Link>
      </div>
    </div>
  );
}
