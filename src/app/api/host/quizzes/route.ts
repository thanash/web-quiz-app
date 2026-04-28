import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const quizzes = await prisma.quiz.findMany({
    where: { hostId: session.user.id },
    include: { _count: { select: { questions: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(quizzes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'タイトルを入力してください' }, { status: 400 });

  const quiz = await prisma.quiz.create({
    data: { title: title.trim(), hostId: session.user.id },
  });
  return NextResponse.json(quiz, { status: 201 });
}
