import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentsGateway } from './comments.gateway';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { SongsModule } from '../songs/songs.module';

/**
 * Bundles the `comments` feature. `MongooseModule.forFeature(...)`
 * registers `Comment` with this module so `@InjectModel(Comment.name)` in
 * `CommentsService` has something to inject — the Mongoose equivalent of
 * `TypeOrmModule.forFeature([Song])` in `SongsModule`. `SongsModule` is
 * imported for its exported `SongsService`, used to confirm a `songId`
 * refers to a real song before attaching a comment to it. `CommentsGateway`
 * broadcasts new comments over WebSockets to whoever's subscribed to that
 * song's room — injected directly into `CommentsService`, not
 * event-decoupled (that's Project 10's own capstone item).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    SongsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsGateway],
})
export class CommentsModule {}
