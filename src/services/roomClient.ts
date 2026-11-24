import type {
  DraftSide,
  FearlessRule,
  GameRecord,
  SeriesFormat,
} from '@/types/draft';

export type OnlineRole = DraftSide | 'SPECTATOR';

export interface RoomPeers {
  blueConnected: boolean;
  redConnected: boolean;
  spectatorCount: number;
}

export interface SyncedDraftPayload {
  seriesFormat: SeriesFormat;
  fearlessRule: FearlessRule;
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

class RoomClient {
  private ws: WebSocket | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private closeHandlers = new Set<CloseHandler>();

  private getWsUrl(): string {
    const customWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    if (customWsUrl && customWsUrl.trim()) {
      return customWsUrl.trim();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        ws.close();
        reject(new Error('방 서버에 연결할 수 없습니다. (`npm run dev` 실행 확인)'));
      }, 4000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        resolve();
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('방 서버 연결에 실패했습니다.'));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerMessage;
          this.messageHandlers.forEach((handler) => handler(parsed));
        } catch {
          // ignore malformed payload
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
        }
        this.closeHandlers.forEach((handler) => handler());
      };
    });
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.send({ type: 'LEAVE_ROOM' });
      this.ws.close();
      this.ws = null;
    }
  }
}

export const roomClient = new RoomClient();
