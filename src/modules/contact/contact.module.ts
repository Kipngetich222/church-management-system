import { Module } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";

@Module({
  imports: [MessagesModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}