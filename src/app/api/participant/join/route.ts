import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL?.replace('schema=quiz', 'schema=public') });

export async function POST(req: Request) {
  const { roomCode, studentNumber } = await req.json();

  if (!roomCode || !studentNumber) {
    return NextResponse.json({ error: 'ルームコードと学籍番号を入力してください' }, { status: 400 });
  }

  // ルームの存在確認
  const gameSession = await prisma.gameSession.findUnique({
    where: { roomCode: roomCode.toUpperCase() },
  });
  if (!gameSession) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 });
  if (gameSession.status === 'FINISHED')
    return NextResponse.json({ error: 'このセッションは終了しています' }, { status: 410 });

  // 学籍番号で学生照合
  const result = await pool.query(
    'SELECT id, student_number, name FROM students WHERE student_number = $1',
    [studentNumber.trim()]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: '学籍番号が見つかりません' }, { status: 404 });
  }
  const student = result.rows[0];

  // 既に入室済みか確認
  const existing = await prisma.player.findFirst({
    where: { sessionId: gameSession.id, studentId: student.id },
  });
  if (existing) {
    return NextResponse.json({ playerId: existing.id, nickname: existing.nickname, roomCode: gameSession.roomCode });
  }

  // プレイヤー登録
  const player = await prisma.player.create({
    data: {
      sessionId: gameSession.id,
      studentId: student.id,
      nickname: student.name,
    },
  });

  return NextResponse.json({ playerId: player.id, nickname: player.nickname, roomCode: gameSession.roomCode }, { status: 201 });
}
