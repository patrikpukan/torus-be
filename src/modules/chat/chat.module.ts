import { Module } from "@nestjs/common";
import { PrismaModule } from "../../core/prisma/prisma.module";
import { EmailService } from "../../shared/email/email.service";
import { Config } from "../../shared/config/config.service";
import { ChatResolver } from "./chat.resolver";
import { ChatService } from "./chat.service";

@Module({
  imports: [PrismaModule],
  providers: [ChatResolver, ChatService, EmailService, Config],
})
export class ChatModule {}
