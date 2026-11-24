import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 3001);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** @type {Map<string, { code: string, state: any, blue: import('ws').WebSocket | null, red: import('ws').WebSocket | null, spectators: Set<import('ws').WebSocket> }>} */
const rooms = new Map();

function generateRoomCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getPeersSummary(room) {
  return {
    blueConnected: Boolean(room.blue && room.blue.readyState === 1),
    redConnected: Boolean(room.red && room.red.readyState === 1),
    spectatorCount: room.spectators.size,
  };
}

function sendJson(ws, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(room, payload, excludeWs = null) {
  const targets = [room.blue, room.red, ...room.spectators];
  for (const client of targets) {
    if (client && client !== excludeWs && client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
  }
}

function removeClientFromCurrentRoom(ws) {
  const code = ws._roomCode;
  if (!code) return;

  const room = rooms.get(code);
  ws._roomCode = null;
  ws._side = null;
  if (!room) return;

  if (room.blue === ws) room.blue = null;
  if (room.red === ws) room.red = null;
  room.spectators.delete(ws);

  const peers = getPeersSummary(room);
  if (!peers.blueConnected && !peers.redConnected && peers.spectatorCount === 0) {
    rooms.delete(code);
    return;
  }

  broadcastToRoom(room, { type: 'PEERS_UPDATED', peers });
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws._roomCode = null;
  ws._side = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === 'CREATE_ROOM') {
      removeClientFromCurrentRoom(ws);

      const code = generateRoomCode();
      const hostSide = msg.hostSide === 'RED' ? 'RED' : 'BLUE';
      const room = {
        code,
        state: msg.initialState ?? null,
        blue: hostSide === 'BLUE' ? ws : null,
        red: hostSide === 'RED' ? ws : null,
        spectators: new Set(),
      };

      rooms.set(code, room);
      ws._roomCode = code;
      ws._side = hostSide;

      sendJson(ws, {
        type: 'ROOM_CREATED',
        roomCode: code,
        assignedSide: hostSide,
        state: room.state,
        peers: getPeersSummary(room),
      });
      return;
    }

    if (msg.type === 'JOIN_ROOM') {
      const code = String(msg.roomCode || '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        sendJson(ws, {
          type: 'ERROR',
          message: `방 코드(${code || '없음'})를 찾을 수 없습니다.`,
        });
        return;
      }

      removeClientFromCurrentRoom(ws);

      let assignedSide = 'SPECTATOR';
      if (!room.blue || room.blue.readyState !== 1) {
        room.blue = ws;
        assignedSide = 'BLUE';
      } else if (!room.red || room.red.readyState !== 1) {
        room.red = ws;
        assignedSide = 'RED';
      } else {
        room.spectators.add(ws);
      }

      ws._roomCode = code;
      ws._side = assignedSide;

      const peers = getPeersSummary(room);
      sendJson(ws, {
        type: 'ROOM_JOINED',
        roomCode: code,
        assignedSide,
        state: room.state,
        peers,
      });

      broadcastToRoom(room, { type: 'PEERS_UPDATED', peers }, ws);
      return;
    }

    if (msg.type === 'SYNC_STATE') {
      const code = ws._roomCode || String(msg.roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) return;

      room.state = msg.state;
      broadcastToRoom(room, { type: 'STATE_UPDATED', state: msg.state }, ws);
      return;
    }

    if (msg.type === 'SWAP_ROOM_SIDES') {
      const code = ws._roomCode;
      const room = code ? rooms.get(code) : null;
      if (!room) return;

      const prevBlue = room.blue;
      const prevRed = room.red;
      room.blue = prevRed;
      room.red = prevBlue;

      if (room.blue) {
        room.blue._side = 'BLUE';
        sendJson(room.blue, { type: 'SIDE_ASSIGNED', assignedSide: 'BLUE' });
      }
      if (room.red) {
        room.red._side = 'RED';
        sendJson(room.red, { type: 'SIDE_ASSIGNED', assignedSide: 'RED' });
      }

      broadcastToRoom(room, {
        type: 'PEERS_UPDATED',
        peers: getPeersSummary(room),
      });
      return;
    }

    if (msg.type === 'LEAVE_ROOM') {
      removeClientFromCurrentRoom(ws);
    }
  });

  ws.on('close', () => {
    removeClientFromCurrentRoom(ws);
  });
});

console.log(`[LoLBPSim WS] Room server listening on ws://localhost:${PORT}`);
