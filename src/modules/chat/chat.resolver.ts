import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Args,
  ID,
} from "@nestjs/graphql";
import { UseGuards, Logger } from "@nestjs/common";
import { AuthenticatedUserGuard } from "../../shared/auth/guards/authenticated-user.guard";
import { User } from "../../shared/auth/decorators/user.decorator";
import type { Identity } from "../../shared/auth/domain/identity";
import {
  ChatService,
  MESSAGE_SENT_EVENT,
  TYPING_STATUS_EVENT,
  MESSAGES_READ_EVENT,
} from "./chat.service";
import { MessageModel } from "./models/message.model";
import { TypingStatus } from "./models/typing-status.model";
import { MessagesReadEvent } from "./models/messages-read.model";
import { SendMessageInput } from "./dto/send-message.input";
import { pubSub } from "../../shared/graphql/graphql-setup.module";

@Resolver(() => MessageModel)
@UseGuards(AuthenticatedUserGuard)
export class ChatResolver {
  private readonly logger = new Logger(ChatResolver.name);

  constructor(private readonly chatService: ChatService) {}

  @Query(() => [MessageModel], {
    description: "Get all messages for a specific pairing",
  })
  async getMessages(
    @Args("pairingId", { type: () => ID }) pairingId: string
  ): Promise<MessageModel[]> {
    this.logger.log(`getMessages called for pairingId: ${pairingId}`);
    const messages = await this.chatService.getMessagesByPairing(pairingId);
    this.logger.log(
      `Retrieved ${messages.length} messages for pairingId: ${pairingId}`
    );
    return messages;
  }

  @Mutation(() => MessageModel, {
    description: "Send a message to a user you are paired with",
  })
  async sendMessage(
    @Args("input") input: SendMessageInput,
    @User() user: Identity | null
  ): Promise<MessageModel> {
    this.logger.log(
      `[CHAT] 📨 sendMessage mutation - user: ${user?.id}, pairingId: ${input.pairingId}, contentLength: ${input.content.length}`
    );
    if (!user) {
      this.logger.error("[CHAT] ❌ User not authenticated");
      throw new Error("User not authenticated");
    }
    const message = await this.chatService.sendMessage(input, user.id);
    this.logger.log(`[CHAT] ✅ Message sent - messageId: ${message.id}`);
    return message;
  }

  @Mutation(() => Boolean, {
    description: "Mark all messages in a pairing as read",
  })
  async markMessagesAsRead(
    @Args("pairingId", { type: () => ID }) pairingId: string,
    @User() user: Identity | null
  ): Promise<boolean> {
    if (!user) {
      throw new Error("User not authenticated");
    }
    return this.chatService.markMessagesAsRead(pairingId, user.id);
  }

  @Mutation(() => Boolean, {
    description: "Set typing status for a pairing",
  })
  async setTypingStatus(
    @Args("pairingId", { type: () => ID }) pairingId: string,
    @Args("isTyping") isTyping: boolean,
    @User() user: Identity | null
  ): Promise<boolean> {
    if (!user) {
      throw new Error("User not authenticated");
    }
    return this.chatService.setTypingStatus(pairingId, user.id, isTyping);
  }

  @Subscription(() => MessageModel, {
    filter: (payload, variables) => {
      return payload.messageSent.pairingId === variables.pairingId;
    },
    resolve: (payload) => payload.messageSent,
    description: "Subscribe to new messages in a pairing",
  })
  messageSent(@Args("pairingId", { type: () => ID }) pairingId: string) {
    return pubSub.asyncIterator(MESSAGE_SENT_EVENT);
  }

  @Subscription(() => TypingStatus, {
    filter: (payload, variables) => {
      return (
        payload.typingStatus.pairingId === variables.pairingId &&
        payload.typingStatus.userId !== variables.userId // Don't send back to self
      );
    },
    resolve: (payload) => payload.typingStatus,
    description: "Subscribe to typing status changes in a pairing",
  })
  typingStatus(
    @Args("pairingId", { type: () => ID }) pairingId: string,
    @Args("userId", { type: () => ID }) userId: string // Current user ID to filter out own events
  ) {
    return pubSub.asyncIterator(TYPING_STATUS_EVENT);
  }

  @Subscription(() => MessagesReadEvent, {
    filter: (payload, variables) => {
      return (
        payload.messagesRead.pairingId === variables.pairingId &&
        payload.messagesRead.userId !== variables.userId // Don't send back to self (optional, but good practice)
      );
    },
    resolve: (payload) => payload.messagesRead,
    description: "Subscribe to read receipt events in a pairing",
  })
  messagesRead(
    @Args("pairingId", { type: () => ID }) pairingId: string,
    @Args("userId", { type: () => ID }) userId: string // Current user ID to filter out own events
  ) {
    return pubSub.asyncIterator(MESSAGES_READ_EVENT);
  }
}
