import Peer, { type DataConnection } from 'peerjs';
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

const PEER_PREFIX = 'lolbpsim-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * PeerJS (WebRTC P2P) 기반 서버리스 방 통신 클라이언트.
 * GitHub Pages 같은 정적 호스팅에서도 별도 백엔드 없이 6자리 방 코드 1:1 대전이 동작합니다.
 */
class RoomClient {
  private peer: Peer | null = null;
  private isHost = false;
  private hostSide: DraftSide = 'BLUE';
  private latestState: SyncedDraftPayload | null = null;

  // Host 전용 연결 관리
  private guestConn: DataConnection | null = null;
  private guestSide: DraftSide | null = null;
  private spectatorConns = new Set<DataConnection>();

  // Guest 전용 연결 관리
  private hostConn: DataConnection | null = null;

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
    const hasGuest = Boolean(this.guestConn && this.guestConn.open);
    return {
      blueConnected:
        this.hostSide === 'BLUE' || (hasGuest && this.guestSide === 'BLUE'),
      redConnected:
        this.hostSide === 'RED' || (hasGuest && this.guestSide === 'RED'),
      spectatorCount: this.spectatorConns.size,
    };
  }

  private broadcastFromHost(
    msg: ServerMessage,
    excludeConn?: DataConnection,
  ): void {
    const targets: DataConnection[] = [];
    if (this.guestConn && this.guestConn.open) targets.push(this.guestConn);
    this.spectatorConns.forEach((conn) => {
      if (conn.open) targets.push(conn);
    });

    for (const conn of targets) {
      if (conn !== excludeConn) {
        conn.send(msg);
      }
    }
  }

  private handleHostSwapSides(): void {
    if (!this.isHost) return;
    this.hostSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
    if (this.guestConn && this.guestConn.open) {
      this.guestSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
      this.guestConn.send({
        type: 'SIDE_ASSIGNED',
        assignedSide: this.guestSide,
      } satisfies ServerMessage);
    }

    this.emitMessage({
      type: 'SIDE_ASSIGNED',
      assignedSide: this.hostSide,
    });

    const peers = this.getPeersSummary();
    this.emitMessage({ type: 'PEERS_UPDATED', peers });
    this.broadcastFromHost({ type: 'PEERS_UPDATED', peers });
  }

  connect(): Promise<void> {
    // PeerJS는 CREATE_ROOM / JOIN_ROOM 시점에 피어를 생성하므로 즉시 성공 반환
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
        this.broadcastFromHost({ type: 'STATE_UPDATED', state });
      } else if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({ type: 'SYNC_STATE', state });
      }
      return;
    }

    if (type === 'SWAP_ROOM_SIDES') {
      if (this.isHost) {
        this.handleHostSwapSides();
      } else if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({ type: 'SWAP_ROOM_SIDES' });
      }
    }
  }

  private startHostRoom(
    hostSide: DraftSide,
    initialState: SyncedDraftPayload | null,
  ): void {
    this.cleanupInternal();

    const code = generateRoomCode();
    this.isHost = true;
    this.hostSide = hostSide;
    this.latestState = initialState;

    const peer = new Peer(`${PEER_PREFIX}${code}`, { debug: 0 });
    this.peer = peer;

    let opened = false;
    const timeout = window.setTimeout(() => {
      if (!opened) {
        this.cleanupInternal();
        this.emitMessage({
          type: 'ERROR',
          message:
            'P2P 시그널링 서버 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
        });
      }
    }, 8000);

    peer.on('open', () => {
      opened = true;
      window.clearTimeout(timeout);
      this.emitMessage({
        type: 'ROOM_CREATED',
        roomCode: code,
        assignedSide: this.hostSide,
        state: this.latestState,
        peers: this.getPeersSummary(),
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        let assignedSide: OnlineRole = 'SPECTATOR';
        if (!this.guestConn || !this.guestConn.open) {
          this.guestConn = conn;
          this.guestSide = this.hostSide === 'BLUE' ? 'RED' : 'BLUE';
          assignedSide = this.guestSide;
        } else {
          this.spectatorConns.add(conn);
        }

        const peers = this.getPeersSummary();
        conn.send({
          type: 'ROOM_JOINED',
          roomCode: code,
          assignedSide,
          state: this.latestState,
          peers,
        } satisfies ServerMessage);

        this.emitMessage({ type: 'PEERS_UPDATED', peers });
        this.broadcastFromHost({ type: 'PEERS_UPDATED', peers }, conn);
      });

      conn.on('data', (raw) => {
        const msg = raw as Record<string, unknown>;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'SYNC_STATE' && msg.state) {
          const nextState = msg.state as SyncedDraftPayload;
          this.latestState = nextState;
          this.emitMessage({ type: 'STATE_UPDATED', state: nextState });
          this.broadcastFromHost({ type: 'STATE_UPDATED', state: nextState }, conn);
        } else if (msg.type === 'SWAP_ROOM_SIDES') {
          this.handleHostSwapSides();
        }
      });

      conn.on('close', () => {
        if (this.guestConn === conn) {
          this.guestConn = null;
          this.guestSide = null;
        }
        this.spectatorConns.delete(conn);
        const peers = this.getPeersSummary();
        this.emitMessage({ type: 'PEERS_UPDATED', peers });
        this.broadcastFromHost({ type: 'PEERS_UPDATED', peers });
      });
    });

    peer.on('error', (err) => {
      window.clearTimeout(timeout);
      if (!opened) {
        this.cleanupInternal();
        this.emitMessage({
          type: 'ERROR',
          message: `방 생성 중 오류가 발생했습니다. (${err.type || 'network'})`,
        });
      }
    });
  }

  private joinHostRoom(roomCode: string): void {
    this.cleanupInternal();

    this.isHost = false;

    const peer = new Peer({ debug: 0 });
    this.peer = peer;

    let joined = false;
    const timeout = window.setTimeout(() => {
      if (!joined) {
        this.cleanupInternal();
        this.emitMessage({
          type: 'ERROR',
          message: `방 코드(${roomCode})를 찾을 수 없거나 방장이 오프라인 상태입니다.`,
        });
      }
    }, 8000);

    peer.on('open', () => {
      const conn = peer.connect(`${PEER_PREFIX}${roomCode}`, { reliable: true });
      this.hostConn = conn;

      conn.on('data', (raw) => {
        const msg = raw as ServerMessage;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'ROOM_JOINED') {
          joined = true;
          window.clearTimeout(timeout);
        }
        this.emitMessage(msg);
      });

      conn.on('close', () => {
        window.clearTimeout(timeout);
        this.hostConn = null;
        this.emitClose();
      });

      conn.on('error', () => {
        if (!joined) {
          window.clearTimeout(timeout);
          this.cleanupInternal();
          this.emitMessage({
            type: 'ERROR',
            message: `방 코드(${roomCode})에 연결할 수 없습니다.`,
          });
        }
      });
    });

    peer.on('error', (err) => {
      window.clearTimeout(timeout);
      if (!joined) {
        this.cleanupInternal();
        const isNotFound = err.type === 'peer-unavailable';
        this.emitMessage({
          type: 'ERROR',
          message: isNotFound
            ? `존재하지 않는 방 코드(${roomCode})입니다.`
            : `방 접속에 실패했습니다. (${err.type || 'network'})`,
        });
      }
    });
  }

  private cleanupInternal(): void {
    this.guestConn?.close();
    this.guestConn = null;
    this.guestSide = null;
    this.spectatorConns.forEach((c) => c.close());
    this.spectatorConns.clear();
    this.hostConn?.close();
    this.hostConn = null;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.latestState = null;
  }

  disconnect(): void {
    this.cleanupInternal();
    this.emitClose();
  }
}

export const roomClient = new RoomClient();
