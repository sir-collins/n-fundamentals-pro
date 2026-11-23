import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentsGateway } from './comments.gateway';
import { CommentsResolver } from './comments.resolver';
import { pubSubProvider } from './pub-sub.provider';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { SongsModule } from '../songs/songs.module';

/**
 * Comments in MongoDB, with real-time delivery over Socket.IO
 * (`CommentsGateway`) and GraphQL subscriptions (`CommentsResolver`).
 * Imports `SongsModule` to check a `songId` exists before commenting.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    SongsModule,
  ],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    CommentsGateway,
    CommentsResolver,
    pubSubProvider,
  ],
})
export class CommentsModule {}
