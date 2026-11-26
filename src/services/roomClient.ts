import type {
  DraftSide,
  FearlessRule,
  GameRecord,
  RofsCategory,
  SeriesFormat,
  SidePickSelectionMode,
} from '@/types/draft';

export type OnlineRole = DraftSide | 'SPECTATOR';

export interface RoomPeers {
  blueConnected: boolean;
  redConnected: boolean;
  spectatorCount: number;
}

export interface NextGameRofsFirst {
  category: RofsCategory;
  value: string;
}

export interface SyncedDraftPayload {
  seriesFormat: SeriesFormat;
  fearlessRule: FearlessRule;
  selectionMode: SidePickSelectionMode;
  firstPickSide: DraftSide;
  blueTeamName: string;
  redTeamName: string;
  timerEnabled: boolean;
  timeLeft: number;
  gameNumber: number;
  currentStepIndex: number;
  hoveredChampionId: string | null;
  blueBans: string[];
  redBans: string[];
  bluePicks: string[];
  redPicks: string[];
  currentWinner: DraftSide | null;
  nextGameRofsFirst: NextGameRofsFirst | null;
  history: GameRecord[];
}

export type ServerMessage =
  | {
      type: 'ROOM_CREATED';
      roomCode: string;
      assignedSide: OnlineRole;
      state: SyncedDraftPayload | null;
      peers: RoomPeers;
    }
  | {
      type: 'ROOM_JOINED';
      roomCode: string;
      assignedSide: OnlineRole;
      state: SyncedDraftPayload | null;
      peers: RoomPeers;
    }
  | { type: 'STATE_UPDATED'; state: SyncedDraftPayload }
  | { type: 'PEERS_UPDATED'; peers: RoomPeers }
  | { type: 'SIDE_ASSIGNED'; assignedSide: OnlineRole }
  | { type: 'ERROR'; message: string };

type MessageHandler = (msg: ServerMessage) => void;
type CloseHandler = () => void;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOPIC_PREFIX = 'lolbpsim/v1/room/';

/**
 * 공개 TLS WebSocket MQTT 릴레이 브로커 목록 (NAT/방화벽 영향 없이 서로 다른 PC 간 100% 연결)
 */
const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function generateClientId(): string {
  return `lolbp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function encodeRemainingLength(length: number): number[] {
  const bytes: number[] = [];
  let x = length;
  do {
    let digit = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) digit |= 0x80;
    bytes.push(digit);
  } while (x > 0);
  return bytes;
}

function encodeUtf8Field(str: string): Uint8Array {
  const data = encoder.encode(str);
  const out = new Uint8Array(2 + data.length);
  out[0] = (data.length >> 8) & 0xff;
  out[1] = data.length & 0xff;
  out.set(data, 2);
  return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function buildMqttConnectPacket(clientId: string): Uint8Array {
  const variableHeader = new Uint8Array([
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // "MQTT"
    0x04, // Protocol Level 4 (3.1.1)
    0x02, // Clean Session
    0x00, 0x1e, // Keep Alive = 30s
  ]);
  const payload = encodeUtf8Field(clientId);
  const remaining = encodeRemainingLength(
    variableHeader.length + payload.length,
  );
  return concatBytes(
    new Uint8Array([0x10, ...remaining]),
    variableHeader,
    payload,
  );
}

function buildMqttSubscribePacket(packetId: number, topic: string): Uint8Array {
  const variableHeader = new Uint8Array([
    (packetId >> 8) & 0xff,
    packetId & 0xff,
  ]);
  const topicField = encodeUtf8Field(topic);
  const qosByte = new Uint8Array([0x00]);
  const remaining = encodeRemainingLength(
    variableHeader.length + topicField.length + qosByte.length,
  );
  return concatBytes(
    new Uint8Array([0x82, ...remaining]),
    variableHeader,
    topicField,
    qosByte,
  );
}

function buildMqttPublishPacket(topic: string, message: string): Uint8Array {
  const topicField = encodeUtf8Field(topic);
  const payload = encoder.encode(message);
  const remaining = encodeRemainingLength(topicField.length + payload.length);
  return concatBytes(
    new Uint8Array([0x30, ...remaining]),
    topicField,
    payload,
  );
}

function buildMqttPingPacket(): Uint8Array {
  return new Uint8Array([0xc0, 0x00]);
}

interface RelayEnvelope {
  senderId: string;
  targetId?: string;
  type: string;
  roomCode?: string;
  assignedSide?: OnlineRole;
  state?: SyncedDraftPayload | null;
  peers?: RoomPeers;
}

/**
 * 순수 브라우저 MQTT-over-WSS 릴레이 기반 방 통신 클라이언트.
 * WebRTC(NAT/방화벽) 제약을 받지 않아 GitHub Pages에서도 서로 다른 PC/네트워크 간
 * 6자리 방 코드 1:1 대전이 안정적으로 동작합니다.
 */
class RoomClient {
  private ws: WebSocket | null = null;
  private pingInterval: number | null = null;
  private clientId = generateClientId();
  private topic: string | null = null;

  private isHost = false;
  private hostSide: DraftSide = 'BLUE';
  private latestState: SyncedDraftPayload | null = null;

  // Host 전용 참가자 관리
  private guestId: string | null = null;
  private guestSide: DraftSide | null = null;
  private spectatorIds = new Set<string>();

  private messageHandlers = new Set<MessageHandler>();
  private closeHandlers = new Set<CloseHandler>();

  private emitMessage(msg: ServerMessage): void {
    this.messageHandlers.forEach((handler) => handler(msg));
  }

  private emitClose(): void {
    this.closeHandlers.forEach((handler) => handler());
  }

  private getPeersSummary(): RoomPeers {
    if (!this.isHost) {
      return { blueConnected: false, redConnected: false, spectatorCount: 0 };
    }
    const hasGuest = Boolean(this.guestId);
    return {
      blueConnected:
        this.hostSide === 'BLUE' || (hasGuest && this.guestSide === 'BLUE'),
      redConnected:
        this.hostSide === 'RED' || (hasGuest && this.guestSide === 'RED'),
      spectatorCount: this.spectatorIds.size,
    };
  }

  private publish(envelope: Omit<RelayEnvelope, 'senderId'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.topic) {
      return;
    }
    const full: RelayEnvelope = { ...envelope, senderId: this.clientId };
    this.ws.send(buildMqttPublishPacket(this.topic, JSON.stringify(full)));
  }

  private handleHostSwapSides(): void {
    if (!this.isHost) return;
    this.hostSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
    if (this.guestId) {
      this.guestSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
      this.publish({
        type: 'SIDE_ASSIGNED',
        targetId: this.guestId,
        assignedSide: this.guestSide,
      });
    }

    this.emitMessage({
      type: 'SIDE_ASSIGNED',
      assignedSide: this.hostSide,
    });

    const peers = this.getPeersSummary();
    this.emitMessage({ type: 'PEERS_UPDATED', peers });
    this.publish({ type: 'PEERS_UPDATED', peers });
  }

  private connectMqttBroker(
    topic: string,
    onSubscribed: () => void,
    onEnvelope: (env: RelayEnvelope) => void,
    onFail: (message: string) => void,
    brokerIndex = 0,
  ): void {
    if (brokerIndex >= MQTT_BROKERS.length) {
      onFail(
        '릴레이 서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }

    const url = MQTT_BROKERS[brokerIndex];
    const ws = new WebSocket(url, 'mqtt');
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.topic = topic;

    let subscribed = false;
    let movedToFallback = false;

    const tryNextBroker = () => {
      if (movedToFallback || subscribed) return;
      movedToFallback = true;
      window.clearTimeout(connectTimer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.connectMqttBroker(
        topic,
        onSubscribed,
        onEnvelope,
        onFail,
        brokerIndex + 1,
      );
    };

    const connectTimer = window.setTimeout(() => {
      tryNextBroker();
    }, 5000);

    ws.onopen = () => {
      ws.send(buildMqttConnectPacket(this.clientId));
    };

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const buf = new Uint8Array(event.data);
      let pos = 0;

      while (pos < buf.length) {
        const header = buf[pos];
        const packetType = header & 0xf0;

        let multiplier = 1;
        let remainingLength = 0;
        let lenPos = pos + 1;

        while (lenPos < buf.length) {
          const digit = buf[lenPos];
          lenPos += 1;
          remainingLength += (digit & 0x7f) * multiplier;
          if ((digit & 0x80) === 0) break;
          multiplier *= 128;
        }

        const bodyStart = lenPos;
        const bodyEnd = bodyStart + remainingLength;
        if (bodyEnd > buf.length) break;

        if (packetType === 0x20) {
          // CONNACK -> 구독 요청
          ws.send(buildMqttSubscribePacket(1, topic));
        } else if (packetType === 0x90) {
          // SUBACK -> 방 준비 완료
          if (!subscribed) {
            subscribed = true;
            window.clearTimeout(connectTimer);
            this.pingInterval = window.setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(buildMqttPingPacket());
              }
            }, 20000);
            onSubscribed();
          }
        } else if (packetType === 0x30) {
          // PUBLISH
          const body = buf.subarray(bodyStart, bodyEnd);
          if (body.length >= 2) {
            const topicLen = (body[0] << 8) | body[1];
            const qos = (header >> 1) & 0x03;
            const payloadStart = 2 + topicLen + (qos > 0 ? 2 : 0);
            if (payloadStart <= body.length) {
              const rawText = decoder.decode(body.subarray(payloadStart));
              try {
                const env = JSON.parse(rawText) as RelayEnvelope;
                if (env && env.senderId !== this.clientId) {
                  onEnvelope(env);
                }
              } catch {
                // ignore malformed json
              }
            }
          }
        }

        pos = bodyEnd;
      }
    };

    ws.onerror = () => {
      if (!subscribed) {
        tryNextBroker();
      }
    };

    ws.onclose = () => {
      window.clearTimeout(connectTimer);
      if (!subscribed) {
        tryNextBroker();
        return;
      }
      if (this.ws === ws) {
        this.cleanupInternal();
        this.emitClose();
      }
    };
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  send(payload: Record<string, unknown>): void {
    const type = payload.type as string | undefined;

    if (type === 'CREATE_ROOM') {
      this.startHostRoom(
        (payload.hostSide as DraftSide) === 'RED' ? 'RED' : 'BLUE',
        (payload.initialState as SyncedDraftPayload | null) ?? null,
      );
      return;
    }

    if (type === 'JOIN_ROOM') {
      const code = String(payload.roomCode ?? '')
        .trim()
        .toUpperCase();
      this.joinHostRoom(code);
      return;
    }

    if (type === 'LEAVE_ROOM') {
      this.disconnect();
      return;
    }

    if (type === 'SYNC_STATE') {
      const state = payload.state as SyncedDraftPayload;
      if (this.isHost) {
        this.latestState = state;
      }
      this.publish({ type: 'STATE_UPDATED', state });
      return;
    }

    if (type === 'SWAP_ROOM_SIDES') {
      if (this.isHost) {
        this.handleHostSwapSides();
      } else {
        this.publish({ type: 'SWAP_ROOM_SIDES' });
      }
    }
  }

  private startHostRoom(
    hostSide: DraftSide,
    initialState: SyncedDraftPayload | null,
  ): void {
    this.cleanupInternal();

    const code = generateRoomCode();
    this.clientId = generateClientId();
    this.isHost = true;
    this.hostSide = hostSide;
    this.latestState = initialState;

    const topic = `${TOPIC_PREFIX}${code}`;

    this.connectMqttBroker(
      topic,
      () => {
        this.emitMessage({
          type: 'ROOM_CREATED',
          roomCode: code,
          assignedSide: this.hostSide,
          state: this.latestState,
          peers: this.getPeersSummary(),
        });
      },
      (env) => {
        if (env.type === 'HELLO_JOIN') {
          let assignedSide: OnlineRole;
          if (this.guestId === env.senderId && this.guestSide) {
            assignedSide = this.guestSide;
          } else if (!this.guestId) {
            this.guestId = env.senderId;
            this.guestSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
            assignedSide = this.guestSide;
          } else {
            this.spectatorIds.add(env.senderId);
            assignedSide = 'SPECTATOR';
          }

          const peers = this.getPeersSummary();
          this.publish({
            type: 'ROOM_JOINED',
            targetId: env.senderId,
            roomCode: code,
            assignedSide,
            state: this.latestState,
            peers,
          });
          this.emitMessage({ type: 'PEERS_UPDATED', peers });
          this.publish({ type: 'PEERS_UPDATED', peers });
          return;
        }

        if (env.type === 'STATE_UPDATED' && env.state) {
          this.latestState = env.state;
          this.emitMessage({ type: 'STATE_UPDATED', state: env.state });
          return;
        }

        if (env.type === 'SWAP_ROOM_SIDES') {
          this.handleHostSwapSides();
          return;
        }

        if (env.type === 'LEAVE_ROOM') {
          if (this.guestId === env.senderId) {
            this.guestId = null;
            this.guestSide = null;
          }
          this.spectatorIds.delete(env.senderId);
          const peers = this.getPeersSummary();
          this.emitMessage({ type: 'PEERS_UPDATED', peers });
          this.publish({ type: 'PEERS_UPDATED', peers });
        }
      },
      (message) => {
        this.cleanupInternal();
        this.emitMessage({ type: 'ERROR', message });
      },
    );
  }

  private joinHostRoom(roomCode: string): void {
    this.cleanupInternal();

    this.clientId = generateClientId();
    this.isHost = false;

    const topic = `${TOPIC_PREFIX}${roomCode}`;
    let settled = false;
    let retryTimer: number | null = null;
    let joinTimeout: number | null = null;

    const clearTimers = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (joinTimeout !== null) {
        window.clearTimeout(joinTimeout);
        joinTimeout = null;
      }
    };

    const failJoin = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimers();
      this.cleanupInternal();
      this.emitMessage({ type: 'ERROR', message });
    };

    this.connectMqttBroker(
      topic,
      () => {
        this.publish({ type: 'HELLO_JOIN' });

        retryTimer = window.setTimeout(() => {
          if (!settled) {
            this.publish({ type: 'HELLO_JOIN' });
          }
        }, 2000);

        joinTimeout = window.setTimeout(() => {
          failJoin(
            `방 코드(${roomCode})를 찾을 수 없습니다. 방장이 방을 열어둔 상태인지 확인해 주세요.`,
          );
        }, 8000);
      },
      (env) => {
        if (
          env.type === 'ROOM_JOINED' &&
          env.targetId === this.clientId &&
          !settled
        ) {
          settled = true;
          clearTimers();
          this.emitMessage({
            type: 'ROOM_JOINED',
            roomCode: env.roomCode ?? roomCode,
            assignedSide: env.assignedSide ?? 'RED',
            state: env.state ?? null,
            peers: env.peers ?? {
              blueConnected: true,
              redConnected: true,
              spectatorCount: 0,
            },
          });
          return;
        }

        if (!settled) return;

        if (env.type === 'STATE_UPDATED' && env.state) {
          this.emitMessage({ type: 'STATE_UPDATED', state: env.state });
        } else if (env.type === 'PEERS_UPDATED' && env.peers) {
          this.emitMessage({ type: 'PEERS_UPDATED', peers: env.peers });
        } else if (
          env.type === 'SIDE_ASSIGNED' &&
          env.targetId === this.clientId &&
          env.assignedSide
        ) {
          this.emitMessage({
            type: 'SIDE_ASSIGNED',
            assignedSide: env.assignedSide,
          });
        }
      },
      (message) => {
        failJoin(message);
      },
    );
  }

  private cleanupInternal(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.topic = null;
    this.isHost = false;
    this.latestState = null;
    this.guestId = null;
    this.guestSide = null;
    this.spectatorIds.clear();
  }

  disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.topic) {
      this.publish({ type: 'LEAVE_ROOM' });
    }
    this.cleanupInternal();
    this.emitClose();
  }
}

export const roomClient = new RoomClient();
