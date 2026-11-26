import { randomInt } from 'node:crypto';
import { REWARD_CODE_ALPHABET, REWARD_CODE_LENGTH } from '../schemas.js';

export function generateRewardCode(length = REWARD_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += REWARD_CODE_ALPHABET[randomInt(0, REWARD_CODE_ALPHABET.length)];
  }
  return code;
}
