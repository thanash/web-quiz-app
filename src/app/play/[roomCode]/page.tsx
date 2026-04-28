'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

type Phase = 'lobby' | 'question' | 'waiting' | 'reveal' | 'ranking' | 'finished';

interface Question {
  id: string;
  text: string;
  options: string[];
  timeLimitSec: number;
  imageUrl?: string;
}

interface AnswerResult {
  playerId: string;
  nickname: string;
  selectedIndex: number;
  isCorrect: boolean;
  score: number;
}

interface RankingEntry {
  playerId: string;
  nickname: string;
  totalScore: number;
}

const OPTION_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const socket = useSocket();

  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState('');
  const [phase, setPhase] = useState<Phase>('lobby');
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [answerList, setAnswerList] = useState<AnswerResult[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const pid = sessionStorage.getItem('playerId');
    const nn = sessionStorage.getItem('nickname');
    if (!pid || !nn) { router.push('/play'); return; }
    setPlayerId(pid);
    setNickname(nn);
  }, [router]);

  useEffect(() => {
    if (!playerId) return;

    socket.emit('player:join', { roomCode, playerId, nickname });

    socket.on('room:players', (players: { playerId: string; nickname: string }[]) => {
      setPlayerCount(players.length);
    });

    socket.on('game:question', ({ question: q, startedAt: sa }: { question: Question; startedAt: number }) => {
      setQuestion(q);
      setSelectedIndex(null);
      setStartedAt(sa);
      setTimeLeft(q.timeLimitSec);
      setPhase('question');
    });

    socket.on('player:answer_received', () => {
      setPhase('waiting');
    });

    socket.on('game:reveal', ({ correctIndex: ci, answerList: al }: { correctIndex: number; distribution: number[]; answerList: AnswerResult[] }) => {
      setCorrectIndex(ci);
      setAnswerList(al);
      const me = al.find(a => a.playerId === playerId);
      if (me) {
        setMyScore(me.score);
        setTotalScore(prev => prev + me.score);
      }
      setPhase('reveal');
    });

    socket.on('game:ranking', ({ ranking: r }: { ranking: RankingEntry[] }) => {
      setRanking(r);
      setPhase('ranking');
    });

    socket.on('game:finished', ({ finalRanking }: { finalRanking: RankingEntry[] }) => {
      setRanking(finalRanking);
      setPhase('finished');
    });

    return () => {
      socket.off('room:players');
      socket.off('game:question');
      socket.off('player:answer_received');
      socket.off('game:reveal');
      socket.off('game:ranking');
      socket.off('game:finished');
    };
  }, [socket, playerId, roomCode, nickname]);

  // カウントダウンタイマー
  useEffect(() => {
    if (phase !== 'question' || !question) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, question.timeLimitSec - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        if (selectedIndex === null) setPhase('waiting');
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, question, startedAt, selectedIndex]);

  const handleAnswer = useCallback((index: number) => {
    if (selectedIndex !== null || phase !== 'question') return;
    setSelectedIndex(index);
    const responseTimeSec = (Date.now() - startedAt) / 1000;
    socket.emit('player:answer', { roomCode, playerId, selectedIndex: index, responseTimeSec });
    setPhase('waiting');
  }, [selectedIndex, phase, socket, roomCode, playerId, startedAt]);

  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 text-white p-6">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-3xl font-bold mb-2">{nickname}</h1>
        <p className="text-xl mb-6">ルーム: <span className="font-mono font-bold tracking-widest">{roomCode}</span></p>
        <div className="bg-white/20 rounded-2xl px-8 py-6 text-center">
          <p className="text-2xl font-bold">{playerCount}人</p>
          <p className="text-sm mt-1">参加中</p>
        </div>
        <p className="mt-8 text-green-100 animate-pulse">ホストが開始するまでお待ちください...</p>
      </div>
    );
  }

  if (phase === 'question' && question) {
    const progress = timeLeft / question.timeLimitSec;
    return (
      <div className="min-h-screen flex flex-col bg-gray-900 text-white p-4">
        {/* タイマー */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{question.timeLimitSec}秒</span>
            <span className="font-bold text-yellow-400">{Math.ceil(timeLeft)}秒</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-yellow-400 h-3 rounded-full transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* 問題文 */}
        <div className="flex-1 flex flex-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="w-full max-h-40 object-contain rounded-xl mb-3" />
          )}
          <div className="bg-gray-800 rounded-2xl p-4 mb-4 text-center">
            <p className="text-lg font-semibold">{question.text}</p>
          </div>

          {/* 選択肢 */}
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={selectedIndex !== null}
                className={`${OPTION_COLORS[i]} text-white font-bold rounded-2xl p-4 text-left shadow-lg disabled:opacity-60 transition active:scale-95`}
              >
                <span className="text-xl font-black">{OPTION_LABELS[i]}</span>
                <p className="text-sm mt-1">{opt}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">回答を送信しました</p>
        <p className="text-gray-400 mt-2">他の参加者の回答を待っています...</p>
      </div>
    );
  }

  if (phase === 'reveal' && question) {
    const myAnswer = answerList.find(a => a.playerId === playerId);
    const isCorrect = myAnswer?.isCorrect ?? false;
    return (
      <div className="min-h-screen flex flex-col bg-gray-900 text-white p-4">
        <div className={`text-center py-6 rounded-2xl mb-4 ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="text-5xl mb-2">{isCorrect ? '⭕' : '❌'}</div>
          <p className="text-2xl font-bold">{isCorrect ? '正解！' : '不正解'}</p>
          {isCorrect && <p className="text-yellow-300 font-bold mt-1">+{myScore}pts</p>}
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <p className="text-sm text-gray-400 mb-1">正解</p>
          <p className="font-bold text-lg text-green-400">{question.options[correctIndex!]}</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-sm text-gray-400 mb-2">みんなの回答</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {answerList.map(a => (
              <div key={a.playerId} className="flex justify-between items-center">
                <span className="text-sm">{a.nickname}</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${a.isCorrect ? 'bg-green-700 text-green-200' : 'bg-red-900 text-red-200'}`}>
                  {question.options[a.selectedIndex]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-400 mt-4 animate-pulse">ランキング表示を待っています...</p>
      </div>
    );
  }

  if (phase === 'ranking') {
    const myRank = ranking.findIndex(r => r.playerId === playerId) + 1;
    return (
      <div className="min-h-screen flex flex-col bg-gray-900 text-white p-4">
        <h2 className="text-2xl font-bold text-center mb-2">ランキング</h2>
        <p className="text-center text-gray-400 mb-4">あなたの順位: <span className="text-yellow-400 font-bold text-2xl">{myRank}位</span></p>
        <div className="space-y-2">
          {ranking.slice(0, 10).map((r, i) => (
            <div key={r.playerId} className={`flex justify-between items-center px-4 py-3 rounded-xl ${r.playerId === playerId ? 'bg-yellow-600' : 'bg-gray-800'}`}>
              <span className="font-bold w-8">{i + 1}</span>
              <span className="flex-1">{r.nickname}</span>
              <span className="font-bold text-yellow-400">{r.totalScore}pts</span>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-400 mt-6 animate-pulse">次の問題を待っています...</p>
      </div>
    );
  }

  if (phase === 'finished') {
    const myRank = ranking.findIndex(r => r.playerId === playerId) + 1;
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-800 to-indigo-900 text-white p-4">
        <h2 className="text-3xl font-bold text-center mt-8 mb-2">🏆 最終結果</h2>
        <p className="text-center text-indigo-300 mb-6">お疲れ様でした！</p>
        <div className="bg-white/10 rounded-2xl p-4 mb-4 text-center">
          <p className="text-lg">あなたの順位</p>
          <p className="text-5xl font-black text-yellow-400">{myRank}位</p>
          <p className="text-xl text-indigo-200">{totalScore}pts</p>
        </div>
        <div className="space-y-2">
          {ranking.slice(0, 10).map((r, i) => (
            <div key={r.playerId} className={`flex justify-between items-center px-4 py-3 rounded-xl ${r.playerId === playerId ? 'bg-yellow-600' : 'bg-white/10'}`}>
              <span className="font-bold w-8">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
              <span className="flex-1">{r.nickname}</span>
              <span className="font-bold text-yellow-400">{r.totalScore}pts</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          className="mt-8 w-full bg-white text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 transition"
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  return null;
}
