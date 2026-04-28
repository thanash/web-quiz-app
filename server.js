'use strict';

require('dotenv').config();

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3002', 10);
const basePath = process.env.BASE_PATH || '/web-quiz-app';

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// Socket.IOのゲームステートをメモリ管理
// roomCode → { hostSocketId, questions: [], currentIndex, timer, status }
const roomState = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: `${basePath}/socket.io`,
    cors: { origin: '*' },
  });

  // ========== Socket.IO イベント ==========

  io.on('connection', (socket) => {

    // ホストがロビーに接続
    socket.on('host:join', ({ roomCode, hostId }) => {
      socket.join(roomCode);
      const state = roomState.get(roomCode) || {
        hostSocketId: null,
        questions: [],
        currentIndex: -1,
        status: 'waiting',
        answers: {},
        playerCount: 0,
      };
      state.hostSocketId = socket.id;
      roomState.set(roomCode, state);
      socket.data.role = 'host';
      socket.data.roomCode = roomCode;
      socket.data.hostId = hostId;
      socket.emit('host:joined', { roomCode });
    });

    // 参加者が入室
    socket.on('player:join', ({ roomCode, playerId, nickname }) => {
      socket.join(roomCode);
      socket.data.role = 'player';
      socket.data.roomCode = roomCode;
      socket.data.playerId = playerId;
      socket.data.nickname = nickname;

      const state = roomState.get(roomCode);
      if (state) state.playerCount = (state.playerCount || 0) + 1;

      // 参加者一覧をルーム全体に通知
      const players = getPlayersInRoom(io, roomCode);
      io.to(roomCode).emit('room:players', players);
    });

    // ホストが問題を出題
    socket.on('host:question', ({ roomCode, question }) => {
      const state = roomState.get(roomCode);
      if (!state || state.hostSocketId !== socket.id) return;

      state.answers = {};
      state.currentQuestion = question;
      state.status = 'active';
      state.questionStartedAt = Date.now();
      roomState.set(roomCode, state);

      io.to(roomCode).emit('game:question', {
        question: {
          id: question.id,
          text: question.text,
          options: question.options,
          timeLimitSec: question.timeLimitSec,
          imageUrl: question.imageUrl || null,
        },
        startedAt: state.questionStartedAt,
      });
    });

    // 参加者が回答
    socket.on('player:answer', ({ roomCode, playerId, selectedIndex, responseTimeSec }) => {
      const state = roomState.get(roomCode);
      if (!state || state.status !== 'active') return;
      if (state.answers[playerId]) return; // 二重回答防止

      const q = state.currentQuestion;
      const isCorrect = selectedIndex === q.correctIndex;
      const score = isCorrect
        ? Math.round(1000 * Math.max(0, (q.timeLimitSec - responseTimeSec) / q.timeLimitSec))
        : 0;

      state.answers[playerId] = { selectedIndex, isCorrect, score, responseTimeSec, nickname: socket.data.nickname };

      // 回答者数をホストに通知
      const answerCount = Object.keys(state.answers).length;
      const players = getPlayersInRoom(io, roomCode);
      io.to(state.hostSocketId).emit('host:answer_count', {
        count: answerCount,
        total: players.length,
      });

      socket.emit('player:answer_received', { isCorrect: null }); // 正解は後で発表
    });

    // ホストが回答締め切り・正解発表
    socket.on('host:reveal', ({ roomCode }) => {
      const state = roomState.get(roomCode);
      if (!state || state.hostSocketId !== socket.id) return;

      const q = state.currentQuestion;
      const answers = state.answers;

      // 選択肢ごとの集計
      const distribution = q.options.map((_, i) =>
        Object.values(answers).filter(a => a.selectedIndex === i).length
      );

      // 参加者名付き回答一覧
      const answerList = Object.entries(answers).map(([pid, a]) => ({
        playerId: pid,
        nickname: a.nickname,
        selectedIndex: a.selectedIndex,
        isCorrect: a.isCorrect,
        score: a.score,
      }));

      io.to(roomCode).emit('game:reveal', {
        correctIndex: q.correctIndex,
        distribution,
        answerList,
      });

      state.status = 'revealed';
    });

    // ホストがランキング表示
    socket.on('host:ranking', ({ roomCode, ranking }) => {
      const state = roomState.get(roomCode);
      if (!state || state.hostSocketId !== socket.id) return;
      io.to(roomCode).emit('game:ranking', { ranking });
    });

    // ホストがセッション終了
    socket.on('host:finish', ({ roomCode, finalRanking }) => {
      const state = roomState.get(roomCode);
      if (!state || state.hostSocketId !== socket.id) return;
      io.to(roomCode).emit('game:finished', { finalRanking });
      roomState.delete(roomCode);
    });

    // 切断時
    socket.on('disconnect', () => {
      const { role, roomCode } = socket.data;
      if (!roomCode) return;

      if (role === 'player') {
        const players = getPlayersInRoom(io, roomCode);
        io.to(roomCode).emit('room:players', players);
      }
    });
  });

  // ルーム内の参加者リストを取得
  function getPlayersInRoom(io, roomCode) {
    const sockets = io.sockets.adapter.rooms.get(roomCode);
    if (!sockets) return [];
    const players = [];
    for (const sid of sockets) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.data.role === 'player') {
        players.push({ playerId: s.data.playerId, nickname: s.data.nickname, socketId: sid });
      }
    }
    return players;
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}${basePath}`);
  });
});
