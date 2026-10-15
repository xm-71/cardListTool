import type { CloudErrorCode } from './cloudApi.ts';

const MESSAGES: Record<CloudErrorCode, string> = {
  emailInUse: 'That email is already in use.',
  invalidCredentials: 'Wrong email or password.',
  weakPassword: 'Use at least 8 characters.',
  emailNotConfirmed: 'Confirm your email first (check your inbox).',
  invalidLink: 'That link has expired. Ask for a new one.',
  network: 'You seem to be offline.',
  unavailable: 'The account service is unavailable right now.',
  unknown: 'Something went wrong. Try again.',
};

/** A plain sentence for an account error. */
export const friendlyMessage = (code: CloudErrorCode): string => MESSAGES[code];
