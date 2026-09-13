import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { SongsModule } from '../songs/songs.module';

/**
 * Bundles the `comments` feature. `MongooseModule.forFeature(...)`
 * registers `Comment` with this module so `@InjectModel(Comment.name)` in
 * `CommentsService` has something to inject — the Mongoose equivalent of
 * `TypeOrmModule.forFeature([Song])` in `SongsModule`. `SongsModule` is
 * imported for its exported `SongsService`, used to confirm a `songId`
 * refers to a real song before attaching a comment to it.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    SongsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
