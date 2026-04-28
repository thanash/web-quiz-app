import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function ownsQuiz(hostId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, hostId } });
  return !!quiz;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({
    where: { id: params.id, hostId: session.user.id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) return NextResponse.json({ error: '見つかりません' }, { status: 404 });
  return NextResponse.json(quiz);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  if (!(await ownsQuiz(session.user.id, params.id)))
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  const { title } = await req.json();
  const quiz = await prisma.quiz.update({ where: { id: params.id }, data: { title } });
  return NextResponse.json(quiz);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  if (!(await ownsQuiz(session.user.id, params.id)))
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  await prisma.quiz.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
