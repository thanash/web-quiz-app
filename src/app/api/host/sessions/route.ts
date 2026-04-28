import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { quizId } = await req.json();

  // ルームコード重複チェック
  let roomCode: string;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    const exists = await prisma.gameSession.findUnique({ where: { roomCode } });
    if (!exists) break;
    attempts++;
  } while (attempts < 10);

  // quizIdが指定された場合は所有確認
  if (quizId) {
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, hostId: session.user.id } });
    if (!quiz) return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const gameSession = await prisma.gameSession.create({
    data: { roomCode, quizId: quizId || null },
  });
  return NextResponse.json(gameSession, { status: 201 });
}
