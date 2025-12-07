import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service";
import { EmailService } from "../../shared/email/email.service";
import { pubSub } from "../../shared/graphql/graphql-setup.module";
import { SendMessageInput } from "./dto/send-message.input";
import { MessageModel } from "./models/message.model";

export const MESSAGE_SENT_EVENT = "messageSent";
export const TYPING_STATUS_EVENT = "typingStatus";
export const MESSAGES_READ_EVENT = "messagesRead";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private emailTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async sendMessage(
    input: SendMessageInput,
    senderId: string
  ): Promise<MessageModel> {
    this.logger.log(
      `sendMessage called - senderId: ${senderId}, pairingId: ${input.pairingId}`
    );

    // Verify the pairing exists and user is part of it
    const pairing = await this.prisma.pairing.findFirst({
      where: {
        id: input.pairingId,
        OR: [{ userAId: senderId }, { userBId: senderId }],
      },
      include: {
        userA: { select: { email: true, firstName: true, lastName: true } },
        userB: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!pairing) {
      this.logger.warn(
        `Pairing not found or user not in pairing - pairingId: ${input.pairingId}, userId: ${senderId}`
      );
      throw new NotFoundException(
        "Pairing not found or you are not part of this conversation"
      );
    }

    this.logger.log(`Creating message in pairing ${input.pairingId}`);

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        pairingId: input.pairingId,
        senderId,
        content: input.content,
      },
    });

    this.logger.log(`Message created - id: ${message.id}`);

    // Get recipient info for email
    const recipient =
      pairing.userAId === senderId ? pairing.userB : pairing.userA;
    const sender = pairing.userAId === senderId ? pairing.userA : pairing.userB;

    // Schedule email notification (10 minutes delay)
    const timeout = setTimeout(
      async () => {
        // Check if message is still unread
        const currentMessage = await this.prisma.message.findUnique({
          where: { id: message.id },
        });

        if (currentMessage && !currentMessage.isRead) {
          this.logger.log(
            `Sending delayed email notification for message ${message.id}`
          );
          this.sendMessageNotificationEmail(
            recipient.email,
            sender,
            message.content
          );
        } else {
          this.logger.log(
            `Message ${message.id} was read, skipping email notification`
          );
        }
        this.emailTimeouts.delete(message.id);
      },
      10 * 60 * 1000
    ); // 10 minutes

    this.emailTimeouts.set(message.id, timeout);

    // Publish subscription event
    this.logger.log(
      `Publishing messageSent event for pairingId: ${input.pairingId}`
    );
    pubSub.publish(MESSAGE_SENT_EVENT, {
      messageSent: {
        ...message,
        createdAt: message.createdAt,
      },
    });

    return message;
  }

  async markMessagesAsRead(
    pairingId: string,
    userId: string
  ): Promise<boolean> {
    // Find unread messages in this pairing sent by the OTHER user
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        pairingId,
        isRead: false,
        senderId: { not: userId }, // Messages sent by the other person
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) {
      return false;
    }

    // Update messages to read
    await this.prisma.message.updateMany({
      where: {
        id: { in: unreadMessages.map((m) => m.id) },
      },
      data: { isRead: true },
    });

    // Cancel scheduled emails for these messages
    for (const msg of unreadMessages) {
      const timeout = this.emailTimeouts.get(msg.id);
      if (timeout) {
        clearTimeout(timeout);
        this.emailTimeouts.delete(msg.id);
        this.logger.log(`Cancelled email notification for message ${msg.id}`);
      }
    }

    // Publish messagesRead event
    pubSub.publish(MESSAGES_READ_EVENT, {
      messagesRead: {
        pairingId,
        userId,
      },
    });

    return true;
  }

  async setTypingStatus(
    pairingId: string,
    userId: string,
    isTyping: boolean
  ): Promise<boolean> {
    pubSub.publish(TYPING_STATUS_EVENT, {
      typingStatus: {
        pairingId,
        userId,
        isTyping,
      },
    });
    return true;
  }

  async getMessagesByPairing(pairingId: string): Promise<MessageModel[]> {
    const messages = await this.prisma.message.findMany({
      where: { pairingId },
      orderBy: { createdAt: "asc" },
    });

    return messages;
  }

  private async sendMessageNotificationEmail(
    recipientEmail: string,
    sender: { firstName: string | null; lastName: string | null },
    messageContent: string
  ): Promise<void> {
    try {
      const senderName =
        sender.firstName || sender.lastName
          ? `${sender.firstName ?? ""} ${sender.lastName ?? ""}`.trim()
          : "Someone";

      await this.emailService.sendMail({
        to: recipientEmail,
        subject: `New message from ${senderName}`,
        text: `You have a new message from ${senderName}:\n\n"${messageContent}"\n\nLog in to your account to reply.`,
        html: `
          <p>You have a new message from <strong>${senderName}</strong>:</p>
          <blockquote style="border-left: 4px solid #ccc; padding-left: 16px; margin: 16px 0;">
            ${messageContent.replace(/\n/g, "<br />")}
          </blockquote>
          <p>Log in to your account to reply.</p>
        `,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send message notification email to ${recipientEmail}: ${err.message}`
      );
    }
  }
}
