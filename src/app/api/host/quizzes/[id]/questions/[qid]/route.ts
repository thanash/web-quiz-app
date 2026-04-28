import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: { id: string; qid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, hostId: session.user.id } });
  if (!quiz) return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  await prisma.question.delete({ where: { id: params.qid } });
  return NextResponse.json({ ok: true });
}
