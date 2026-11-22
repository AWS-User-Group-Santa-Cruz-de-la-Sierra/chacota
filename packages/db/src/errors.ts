export class NotFoundError extends Error {
  readonly name = 'NotFoundError';
}

export class ConflictError extends Error {
  readonly name = 'ConflictError';
}

export function isConditionalCheckFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ConditionalCheckFailedException') return true;
  // Transactions report per-item reasons.
  return (
    error.name === 'TransactionCanceledException' &&
    ((error as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? []).some(
      (r) => r.Code === 'ConditionalCheckFailed',
    )
  );
}
