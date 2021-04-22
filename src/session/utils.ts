import { ClientSessionContext } from './types';

export const ensureSequentialTransaction = async <F extends () => Promise<any>>(
    ctx: ClientSessionContext,
    jobFn: F
): Promise<ReturnType<F>> => {
    /**
     * class-validator internally uses Promise.all to resolve awaiting validation promises
     * https://github.com/typestack/class-validator/blob/615931e2903cbd680bd8fe2256e8d37dd20aeb37/src/validation/Validator.ts#L109
     *
     * When a session has been set on the current context, we need a way to maintain a sequential approach
     * in the order of transactions committed to the session in order to avoid TransactionErrors that could
     * occur when parallelizing promises via Promise.all.
     *
     * Using the ClientSessionContext::orchestrator allows us to force sequential promise application
     */
    if (ctx === undefined) return await jobFn();
    return await ctx.orchestrator.addJob(jobFn);
};
