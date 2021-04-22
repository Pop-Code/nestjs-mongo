import { ClientSession } from 'mongodb';

import { TransactionsOrchestrator } from './orchestrator';

export type ClientSessionContext =
    | {
          session: ClientSession;
          orchestrator: TransactionsOrchestrator;
      }
    | undefined;
