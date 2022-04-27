import { Debugger } from 'debug';

/**
 * Transactions in sessions need to be sequential
 * Utility class to allow wrapping promises sequentially when used
 * in a Promise.all context.
 */
export class TransactionsOrchestrator {
    protected readonly jobs: Array<Promise<any>> = [];
    protected current = 0;

    constructor(protected readonly log: Debugger) {}

    async addJob<F extends () => Promise<any>>(jobFunc: F): Promise<ReturnType<F>> {
        const current = this.current;
        this.log('Registering job %s on orchestrator', current);

        this.jobs.push(
            new Promise((resolve, reject) => {
                const prevJob = this.jobs?.[current - 1] ?? Promise.resolve();
                prevJob
                    .then(() => {
                        this.log('Executing job %s on orchestrator', current);
                        return resolve(jobFunc());
                    })
                    .catch((e) => reject(e));
            })
        );

        const result = this.jobs[current];
        this.current += 1;

        return await result;
    }
}
