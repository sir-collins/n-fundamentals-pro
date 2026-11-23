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
 * Pushes new comments over Socket.IO to clients in that song's room
 * (`song:<id>`), which they join with `subscribeToSong`. No CORS config:
 * the demo page (`public/realtime-comments.html`) is same-origin.
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
