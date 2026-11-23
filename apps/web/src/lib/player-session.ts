/**
 * Whether a failed /state response means the phone's saved session is useless. Under load the API
 * can answer 429 or 5xx for a moment: dropping the player then would cost them their place and score.
 */
export function shouldForgetSession(status: number): boolean {
  return status === 401 || status === 404;
}
