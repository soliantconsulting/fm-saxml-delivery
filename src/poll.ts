export type JobState = {
    jobStatus?: string;
    jobMessage?: string;
    timeToCreate?: unknown;
    timeToUpload?: unknown;
};

export type PollOptions = {
    fetchStatus: () => Promise<JobState>;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
    intervalMs: number;
    timeoutMs: number;
    progressMs?: number;
    maxFailures?: number;
    onProgress?: (elapsedMs: number) => void;
};

/** Polls until jobStatus is "done" and returns the final state; throws on "error", timeout, or repeated request failures. */
export const pollJob = async ({
    fetchStatus,
    sleep,
    now,
    intervalMs,
    timeoutMs,
    progressMs = 60_000,
    maxFailures = 5,
    onProgress,
}: PollOptions): Promise<JobState> => {
    const start = now();
    let lastProgress = start;
    let failures = 0;

    for (;;) {
        let state: JobState | undefined;
        try {
            state = await fetchStatus();
            failures = 0;
        } catch (e) {
            if (++failures >= maxFailures) {
                throw new Error(`Status check failed ${failures} times in a row: ${e}`);
            }
            await sleep(Math.min(5_000 * 2 ** (failures - 1), 60_000));
        }

        if (state?.jobStatus === 'done') {
            return state;
        }
        if (state?.jobStatus === 'error') {
            throw new Error(`Export failed: ${state.jobMessage ?? '(no message)'}`);
        }

        const elapsed = now() - start;
        if (elapsed >= timeoutMs) {
            throw new Error(`Export did not finish within ${Math.round(timeoutMs / 60_000)} minutes`);
        }
        if (now() - lastProgress >= progressMs) {
            lastProgress = now();
            onProgress?.(elapsed);
        }
        if (state) {
            await sleep(intervalMs);
        }
    }
};
