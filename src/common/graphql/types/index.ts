import {
  MutationResponseType,
  DataResponseType,
  PaginatedResponseType,
  ValidatedResponseType,
} from "./response.types";
import { DeleteResponseType } from "./delete-response.type";

/**
 * RESPONSE TYPE EXPORTS AND USAGE GUIDE
 *
 * All common response types are exported from this module for consistent usage
 * across all GraphQL resolvers in the application.
 *
 * EXPORTED TYPES:
 * 1. MutationResponseType
 *    - Use for: Simple operations without data return
 *    - Fields: success, message
 *    - Example: deleteUser(), archiveOrganization()
 *
 * 2. DataResponseType<T>
 *    - Use for: Operations returning single entity
 *    - Fields: success, message, data
 *    - Example: createUser(), updateProfile()
 *
 * 3. DeleteResponseType
 *    - Use for: Delete operations
 *    - Fields: success, message, deletedId, deletedCount
 *    - Example: deleteCalendarEvent(), removeUser()
 *
 * 4. PaginatedResponseType<T>
 *    - Use for: List operations with pagination
 *    - Fields: success, message, data[], total, page, pageSize
 *    - Example: getUsers(), searchOrganizations()
 *
 * 5. ValidatedResponseType
 *    - Use for: Validation/check operations
 *    - Fields: success, message, isValid
 *    - Example: validateInviteCode(), checkAvailability()
 *
 * PATTERN EXAMPLES:
 *
 * // Example 1: Simple Delete Mutation
 * @Mutation(() => DeleteResponseType)
 * async deleteCalendarEvent(
 *   @User() identity: Identity,
 *   @Args("id") id: string
 * ): Promise<DeleteResponseType> {
 *   return this.service.deleteCalendarEvent(identity, id);
 * }
 *
 * // Example 2: Create with Data Return
 * @Mutation(() => DataResponseType<MeetingEventType>)
 * async createMeetingEvent(
 *   @User() identity: Identity,
 *   @Args("input") input: CreateMeetingEventInputType
 * ): Promise<DataResponseType<MeetingEventType>> {
 *   const event = await this.service.createMeetingEvent(identity, input);
 *   return ResponseBuilder.success(mapMeetingEventToGraphQL(event));
 * }
 *
 * // Example 3: Validation
 * @Query(() => ValidatedResponseType)
 * async validateInviteCode(
 *   @Args("code") code: string
 * ): Promise<ValidatedResponseType> {
 *   const isValid = await this.service.validateCode(code);
 *   return ResponseBuilder.validated(isValid, 'Code validation completed');
 * }
 */

export {
  MutationResponseType,
  DataResponseType,
  PaginatedResponseType,
  ValidatedResponseType,
  DeleteResponseType,
};
