import assert from 'node:assert/strict';
import {test} from 'node:test';
import {type JobState, pollJob} from '../src/poll.js';

const setup = (responses: Array<JobState | Error>, timeoutMs = 3_600_000) => {
    let t = 0;
    let calls = 0;
    const progress: number[] = [];
    const run = () =>
        pollJob({
            fetchStatus: async () => {
                const r = responses[Math.min(calls++, responses.length - 1)];
                if (r instanceof Error) throw r;
                return r;
            },
            sleep: async (ms) => {
                t += ms;
            },
            now: () => t,
            intervalMs: 10_000,
            timeoutMs,
            onProgress: (e) => progress.push(e),
        });
    return {run, progress, calls: () => calls};
};

test('running then done returns the final state', async () => {
    const s = setup([{jobStatus: 'running'}, {jobStatus: 'running'}, {jobStatus: 'done', timeToCreate: 5}]);
    const result = await s.run();
    assert.equal(result.jobStatus, 'done');
    assert.equal(result.timeToCreate, 5);
    assert.equal(s.calls(), 3);
});

test('running then error rejects with the job message', async () => {
    const s = setup([{jobStatus: 'running'}, {jobStatus: 'error', jobMessage: 'disk full'}]);
    await assert.rejects(s.run(), /disk full/);
});

test('times out while still running', async () => {
    const s = setup([{jobStatus: 'running'}], 120_000);
    await assert.rejects(s.run(), /did not finish within 2 minutes/);
    assert.ok(s.progress.length >= 1);
});

test('transient failures are retried', async () => {
    const s = setup([new Error('boom'), new Error('boom'), {jobStatus: 'done'}]);
    assert.equal((await s.run()).jobStatus, 'done');
});

test('persistent failures give up', async () => {
    const s = setup([new Error('boom')]);
    await assert.rejects(s.run(), /failed 5 times in a row/);
});
