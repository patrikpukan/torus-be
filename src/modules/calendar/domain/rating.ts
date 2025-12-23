/**
 * Rating Domain Model
 * Represents a 1:1 meeting rating with feedback
 */
export interface Rating {
  id: string;
  meetingEventId: string;
  userId: string;
  stars: number; // 0-5
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRatingInput {
  meetingEventId: string;
  stars: number;
  feedback?: string;
}
