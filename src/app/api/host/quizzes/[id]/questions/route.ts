import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, hostId: session.user.id } });
  if (!quiz) return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  const { text, options, correctIndex, timeLimitSec, imageUrl } = await req.json();
  if (!text || !options || options.length < 2 || correctIndex == null) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
  }

  const count = await prisma.question.count({ where: { quizId: params.id } });
  const question = await prisma.question.create({
    data: {
      quizId: params.id,
      order: count + 1,
      text,
      options,
      correctIndex,
      timeLimitSec: timeLimitSec ?? 20,
      imageUrl: imageUrl ?? null,
    },
  });
  return NextResponse.json(question, { status: 201 });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, hostId: session.user.id } });
  if (!quiz) return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  // 問題一覧の一括更新（並べ替え含む）
  const { questions } = await req.json();
  await prisma.$transaction(
    questions.map((q: { id: string; order: number; text: string; options: string[]; correctIndex: number; timeLimitSec: number; imageUrl?: string }) =>
      prisma.question.update({
        where: { id: q.id },
        data: {
          order: q.order,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          timeLimitSec: q.timeLimitSec,
          imageUrl: q.imageUrl ?? null,
        },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
