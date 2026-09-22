import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CommentDocument } from './schemas/comment.schema';

/**
 * Broadcasts new comments/replies to everyone currently viewing a
 * song's comment thread. Rooms are per-song (`song:<id>`) — a client
 * must `subscribeToSong` before it'll receive anything for that song.
 * No CORS config here: the demo page (`public/realtime-comments.html`)
 * is served by this same app, same origin — consistent with deferring
 * CORS until a real cross-origin client actually needs it.
 */
@WebSocketGateway()
export class CommentsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribeToSong')
  async handleSubscribe(
    @MessageBody() songId: number,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await client.join(`song:${songId}`);
  }

  /** Called directly by CommentsService after a comment is saved. */
  broadcastNewComment(songId: number, comment: CommentDocument): void {
    this.server.to(`song:${songId}`).emit('newComment', comment);
  }
}
