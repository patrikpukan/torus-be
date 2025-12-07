export interface PairingExecutionResult {
  success: boolean;
  message: string;
  pairingsCreated: number;
  unpairedUsers?: number;
}
