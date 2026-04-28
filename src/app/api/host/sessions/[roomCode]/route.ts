import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { roomCode: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const gameSession = await prisma.gameSession.findUnique({
    where: { roomCode: params.roomCode },
    include: {
      quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
      players: { orderBy: { totalScore: 'desc' } },
    },
  });
  if (!gameSession) return NextResponse.json({ error: '見つかりません' }, { status: 404 });
  return NextResponse.json(gameSession);
}

export async function PATCH(req: Request, { params }: { params: { roomCode: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { status, currentQuestionIndex, hostSocketId } = await req.json();
  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (currentQuestionIndex !== undefined) data.currentQuestionIndex = currentQuestionIndex;
  if (hostSocketId !== undefined) data.hostSocketId = hostSocketId;
  if (status === 'ACTIVE') data.startedAt = new Date();
  if (status === 'FINISHED') data.finishedAt = new Date();

  const gameSession = await prisma.gameSession.update({
    where: { roomCode: params.roomCode },
    data,
  });
  return NextResponse.json(gameSession);
}
