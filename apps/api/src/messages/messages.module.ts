import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MessagesService } from './application/messages.service';
import { MessagesController } from './presentation/messages.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
