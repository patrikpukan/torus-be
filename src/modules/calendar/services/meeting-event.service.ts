import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/core/prisma/prisma.service";
import { withRls } from "src/db/withRls";
import { getRlsClaims } from "src/shared/auth/utils/get-rls-claims";
import { Identity } from "src/shared/auth/domain/identity";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import {
  MeetingEvent,
  MeetingConfirmationStatus,
  CreateMeetingEventInput,
  UpdateMeetingEventConfirmationInput,
  CancelMeetingEventInput,
} from "../domain/meeting-event";

@Injectable()
export class MeetingEventService {
  private readonly logger = new Logger(MeetingEventService.name);

  constructor(
    private readonly meetingEventRepository: MeetingEventRepository,
    private readonly prisma: PrismaService
  ) {}

  async createMeetingEvent(
    identity: Identity,
    input: CreateMeetingEventInput
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      // Validate date range
      if (input.startDateTime >= input.endDateTime) {
        throw new BadRequestException(
          "startDateTime must be before endDateTime"
        );
      }

      // Ensure meeting is between exactly two different users
      if (input.userAId === input.userBId) {
        throw new BadRequestException(
          "Cannot create meeting between the same user"
        );
      }

      // Validate the creator is one of the meeting participants
      if (
        input.createdByUserId !== input.userAId &&
        input.createdByUserId !== input.userBId
      ) {
        throw new BadRequestException(
          "Creator must be one of the meeting participants"
        );
      }

      // Validate the creator is the current user
      if (input.createdByUserId !== identity.id) {
        throw new BadRequestException("Cannot create meeting for another user");
      }

      // Validate both users exist
      const [userA, userB] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userAId } }),
        tx.user.findUnique({ where: { id: input.userBId } }),
      ]);

      if (!userA || !userB) {
        throw new BadRequestException("One or both users do not exist");
      }

      const creatorIsA = input.createdByUserId === input.userAId;

      return this.meetingEventRepository.create(
        {
          pairingId: input.pairingId ?? undefined,
          userAId: input.userAId,
          userBId: input.userBId,
          createdByUserId: input.createdByUserId,
          startDateTime: input.startDateTime,
          endDateTime: input.endDateTime,
          userAConfirmationStatus: creatorIsA
            ? MeetingConfirmationStatus.confirmed
            : MeetingConfirmationStatus.pending,
          userBConfirmationStatus: !creatorIsA
            ? MeetingConfirmationStatus.confirmed
            : MeetingConfirmationStatus.pending,
          ...(input.note
            ? creatorIsA
              ? { userANote: input.note }
              : { userBNote: input.note }
            : {}),
        } as any,
        tx
      );
    });
  }

  async getMeetingEvent(
    identity: Identity,
    id: string
  ): Promise<MeetingEvent | null> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(id, tx);

      if (meeting) {
        // Verify user is a participant
        if (
          meeting.userAId !== identity.id &&
          meeting.userBId !== identity.id
        ) {
          throw new BadRequestException(
            "Cannot access meeting event of which you are not a participant"
          );
        }
      }

      return meeting;
    });
  }

  async getMeetingsByDateRange(
    identity: Identity,
    startDate: Date,
    endDate: Date
  ): Promise<MeetingEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      if (startDate >= endDate) {
        throw new BadRequestException("startDate must be before endDate");
      }

      return this.meetingEventRepository.findByUserAndDateRange(
        identity.id,
        startDate,
        endDate,
        tx
      );
    });
  }

  async getUpcomingMeetings(identity: Identity): Promise<MeetingEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.meetingEventRepository.findUpcomingForUser(identity.id, tx)
    );
  }

  async getPendingConfirmations(identity: Identity): Promise<MeetingEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.meetingEventRepository.findPendingConfirmationsForUser(
        identity.id,
        tx
      )
    );
  }

  async confirmMeeting(
    identity: Identity,
    meetingId: string,
    note?: string
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(meetingId, tx);

      if (!meeting) {
        throw new NotFoundException("Meeting not found");
      }

      if (meeting.cancelledAt) {
        throw new BadRequestException("Cannot confirm a cancelled meeting");
      }

      // Determine which user is confirming
      let updateData: any;

      if (meeting.userAId === identity.id) {
        updateData = {
          userAConfirmationStatus: MeetingConfirmationStatus.confirmed,
          ...(note !== undefined && { userANote: note }),
          userAProposedStartDateTime: null,
          userAProposedEndDateTime: null,
        };
      } else if (meeting.userBId === identity.id) {
        updateData = {
          userBConfirmationStatus: MeetingConfirmationStatus.confirmed,
          ...(note !== undefined && { userBNote: note }),
          userBProposedStartDateTime: null,
          userBProposedEndDateTime: null,
        };
      } else {
        throw new BadRequestException(
          "You are not a participant of this meeting"
        );
      }

      return this.meetingEventRepository.update(meetingId, updateData, tx);
    });
  }

  async rejectMeeting(
    identity: Identity,
    meetingId: string,
    note?: string
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(meetingId, tx);

      if (!meeting) {
        throw new NotFoundException("Meeting not found");
      }

      if (meeting.cancelledAt) {
        throw new BadRequestException("Cannot reject a cancelled meeting");
      }

      let updateData: any;

      if (meeting.userAId === identity.id) {
        updateData = {
          userAConfirmationStatus: MeetingConfirmationStatus.rejected,
          ...(note !== undefined && { userANote: note }),
        };
      } else if (meeting.userBId === identity.id) {
        updateData = {
          userBConfirmationStatus: MeetingConfirmationStatus.rejected,
          ...(note !== undefined && { userBNote: note }),
        };
      } else {
        throw new BadRequestException(
          "You are not a participant of this meeting"
        );
      }

      return this.meetingEventRepository.update(meetingId, updateData, tx);
    });
  }

  async proposeMeetingTime(
    identity: Identity,
    input: UpdateMeetingEventConfirmationInput
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(
        input.meetingId,
        tx
      );

      if (!meeting) {
        throw new NotFoundException("Meeting not found");
      }

      if (meeting.cancelledAt) {
        throw new BadRequestException(
          "Cannot propose time for a cancelled meeting"
        );
      }

      if (!input.proposedStartDateTime || !input.proposedEndDateTime) {
        throw new BadRequestException(
          "Proposed start and end times are required"
        );
      }

      if (input.proposedStartDateTime >= input.proposedEndDateTime) {
        throw new BadRequestException(
          "proposedStartDateTime must be before proposedEndDateTime"
        );
      }

      let updateData: any;

      if (meeting.userAId === identity.id) {
        updateData = {
          userAConfirmationStatus: MeetingConfirmationStatus.proposed,
          userAProposedStartDateTime: input.proposedStartDateTime,
          userAProposedEndDateTime: input.proposedEndDateTime,
          ...(input.note !== undefined && { userANote: input.note }),
        };
      } else if (meeting.userBId === identity.id) {
        updateData = {
          userBConfirmationStatus: MeetingConfirmationStatus.proposed,
          userBProposedStartDateTime: input.proposedStartDateTime,
          userBProposedEndDateTime: input.proposedEndDateTime,
          ...(input.note !== undefined && { userBNote: input.note }),
        };
      } else {
        throw new BadRequestException(
          "You are not a participant of this meeting"
        );
      }

      return this.meetingEventRepository.update(
        input.meetingId,
        updateData,
        tx
      );
    });
  }

  async updateMeetingToProposedTime(
    identity: Identity,
    meetingId: string
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(meetingId, tx);

      if (!meeting) {
        throw new NotFoundException("Meeting not found");
      }

      if (meeting.cancelledAt) {
        throw new BadRequestException("Cannot update a cancelled meeting");
      }

      // Check if both users have proposed different times
      const hasUserAProposal =
        meeting.userAConfirmationStatus ===
          MeetingConfirmationStatus.proposed &&
        meeting.userAProposedStartDateTime &&
        meeting.userAProposedEndDateTime;

      const hasUserBProposal =
        meeting.userBConfirmationStatus ===
          MeetingConfirmationStatus.proposed &&
        meeting.userBProposedStartDateTime &&
        meeting.userBProposedEndDateTime;

      // If only one user has proposed, accept that proposal
      if (hasUserAProposal && !hasUserBProposal) {
        return this.meetingEventRepository.update(
          meetingId,
          {
            startDateTime: meeting.userAProposedStartDateTime!,
            endDateTime: meeting.userAProposedEndDateTime!,
            userAConfirmationStatus: MeetingConfirmationStatus.confirmed,
            userBConfirmationStatus: MeetingConfirmationStatus.confirmed,
            userAProposedStartDateTime: null,
            userAProposedEndDateTime: null,
          },
          tx
        );
      }

      if (hasUserBProposal && !hasUserAProposal) {
        return this.meetingEventRepository.update(
          meetingId,
          {
            startDateTime: meeting.userBProposedStartDateTime!,
            endDateTime: meeting.userBProposedEndDateTime!,
            userAConfirmationStatus: MeetingConfirmationStatus.confirmed,
            userBConfirmationStatus: MeetingConfirmationStatus.confirmed,
            userBProposedStartDateTime: null,
            userBProposedEndDateTime: null,
          },
          tx
        );
      }

      if (hasUserAProposal && hasUserBProposal) {
        throw new BadRequestException(
          "Both users have proposed different times. Please manually accept one of the proposals."
        );
      }

      throw new BadRequestException("No time proposals to accept");
    });
  }

  async cancelMeeting(
    identity: Identity,
    input: CancelMeetingEventInput
  ): Promise<MeetingEvent> {
    return withRls(this.prisma, getRlsClaims(identity), async (tx) => {
      const meeting = await this.meetingEventRepository.findById(
        input.meetingId,
        tx
      );

      if (!meeting) {
        throw new NotFoundException("Meeting not found");
      }

      if (meeting.cancelledAt) {
        throw new BadRequestException("Meeting is already cancelled");
      }

      // Only allow cancelling when both sides already confirmed (scheduled meeting)
      const aConfirmed =
        String(meeting.userAConfirmationStatus) ===
        String(MeetingConfirmationStatus.confirmed);
      const bConfirmed =
        String(meeting.userBConfirmationStatus) ===
        String(MeetingConfirmationStatus.confirmed);
      if (!(aConfirmed && bConfirmed)) {
        throw new BadRequestException(
          "Only scheduled meetings (both confirmed) can be cancelled"
        );
      }

      // Verify user is a participant or is cancelling on behalf of themselves
      if (input.cancelledByUserId !== identity.id) {
        throw new BadRequestException("Cannot cancel meeting for another user");
      }

      if (
        meeting.userAId !== input.cancelledByUserId &&
        meeting.userBId !== input.cancelledByUserId
      ) {
        throw new BadRequestException(
          "You are not a participant of this meeting"
        );
      }

      return this.meetingEventRepository.softCancel(
        input.meetingId,
        input.cancelledByUserId,
        input.reason,
        tx
      );
    });
  }

  /**
   * Get latest meeting for a pairing (if exists and not cancelled)
   */
  async getLatestMeetingForPairing(
    identity: Identity,
    pairingId: string
  ): Promise<MeetingEvent | null> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.meetingEventRepository.findByPairingId(pairingId, tx)
    );
  }

  /**
   * Get all meetings for a pairing (including cancelled)
   */
  async getAllMeetingsForPairing(
    identity: Identity,
    pairingId: string
  ): Promise<MeetingEvent[]> {
    return withRls(this.prisma, getRlsClaims(identity), (tx) =>
      this.meetingEventRepository.findByPairingIdAll(pairingId, tx)
    );
  }
}
