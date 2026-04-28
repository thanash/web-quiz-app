import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// セッション内のスコアを集計して各プレイヤーに反映
export async function POST(req: Request, { params }: { params: { roomCode: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { answers, questionId } = await req.json();
  // answers: [{ playerId, selectedIndex, isCorrect, responseTimeSec, score }]

  const gameSession = await prisma.gameSession.findUnique({ where: { roomCode: params.roomCode } });
  if (!gameSession) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  await prisma.$transaction([
    ...answers.map((a: { playerId: string; selectedIndex: number; isCorrect: boolean; responseTimeSec: number; score: number }) =>
      prisma.answer.create({
        data: {
          playerId: a.playerId,
          questionId,
          selectedIndex: a.selectedIndex,
          isCorrect: a.isCorrect,
          responseTimeSec: a.responseTimeSec,
          score: a.score,
        },
      })
    ),
    ...answers.map((a: { playerId: string; score: number }) =>
      prisma.player.update({
        where: { id: a.playerId },
        data: { totalScore: { increment: a.score } },
      })
    ),
  ]);

  const ranking = await prisma.player.findMany({
    where: { sessionId: gameSession.id },
    orderBy: { totalScore: 'desc' },
    select: { id: true, nickname: true, totalScore: true },
  });

  return NextResponse.json({ ranking });
}
