export async function raceWithTimeout<T>(
  candidates: ReadonlyArray<PromiseLike<T>>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(timeoutValue), timeoutMs);
  });

  try {
    return await Promise.race([...candidates, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
