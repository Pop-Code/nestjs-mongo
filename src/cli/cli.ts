import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { MongoClient } from 'mongodb';

import { EntityManager } from '../entity/manager';
import { Migration, MigrationRunner } from '../migration/migration';
import { SessionLoaderService } from '../session/service';

/** Where the command line writes its messages. */
export interface CliOutput {
    log: (message: string) => void;
    error: (message: string) => void;
}

export const CLI_USAGE = `Usage: nestjs-mongo migrate <up|down|status> [options]

Options:
  --uri <uri>                The connection string (default: the MONGODB_URI environment variable)
  --migrations <file>        A module that exports the list of migrations (\`migrations\` or \`default\` export)
  --collection <name>        The collection of the executed migrations (default: migrations)
  --steps <n>                down: the count of migrations to revert (default: 1)
  -h, --help                 Show this help`;

const isMigrationList = (value: unknown): value is Migration[] =>
    Array.isArray(value) &&
    value.every(
        (m: unknown) =>
            typeof m === 'object' &&
            m !== null &&
            typeof Reflect.get(m, 'name') === 'string' &&
            typeof Reflect.get(m, 'up') === 'function'
    );

/** Loads the list of migrations exported by a module (`migrations`, `default`, or the module itself). */
export function loadMigrations(file: string): Migration[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: unknown = require(resolve(process.cwd(), file));
    const candidates: unknown[] =
        typeof loaded === 'object' && loaded !== null
            ? [Reflect.get(loaded, 'migrations'), Reflect.get(loaded, 'default'), loaded]
            : [loaded];
    const migrations = candidates.find(isMigrationList);
    if (migrations === undefined) {
        throw new Error(`${file} does not export a list of migrations (\`migrations\` or \`default\` export)`);
    }
    return migrations;
}

/**
 * Runs the command line, returns the exit code.
 *
 * ```bash
 * nestjs-mongo migrate up --uri mongodb://localhost:27017/app --migrations dist/migrations.js
 * ```
 */
export async function runCli(args: string[], output: CliOutput = console): Promise<number> {
    let parsed: ReturnType<typeof parse>;
    try {
        parsed = parse(args);
    } catch (e) {
        output.error(`${e instanceof Error ? e.message : String(e)}\n\n${CLI_USAGE}`);
        return 1;
    }
    const { values, positionals } = parsed;
    if (values.help === true) {
        output.log(CLI_USAGE);
        return 0;
    }
    const [command, action] = positionals;
    if (command !== 'migrate' || !['up', 'down', 'status'].includes(action ?? '')) {
        output.error(CLI_USAGE);
        return 1;
    }
    const uri = values.uri ?? process.env.MONGODB_URI;
    if (uri === undefined || values.migrations === undefined) {
        output.error(`The --uri (or MONGODB_URI) and --migrations options are required\n\n${CLI_USAGE}`);
        return 1;
    }
    const steps = values.steps !== undefined ? Number(values.steps) : 1;
    if (!Number.isInteger(steps) || steps < 1) {
        output.error('--steps must be a positive integer');
        return 1;
    }

    let client: MongoClient | undefined;
    try {
        const migrations = loadMigrations(values.migrations);
        client = await new MongoClient(uri).connect();
        const runner = new MigrationRunner(
            new EntityManager(client, new SessionLoaderService()),
            values.collection ?? 'migrations'
        );
        if (action === 'up') {
            const executed = await runner.up(migrations);
            output.log(executed.length > 0 ? executed.map((name) => `up ${name}`).join('\n') : 'No pending migration');
        } else if (action === 'down') {
            const reverted = await runner.down(migrations, steps);
            output.log(
                reverted.length > 0 ? reverted.map((name) => `down ${name}`).join('\n') : 'No executed migration'
            );
        } else {
            const executed = new Map((await runner.executed()).map((m) => [m.name, m.executedAt]));
            output.log(
                migrations
                    .map((m) => {
                        const executedAt = executed.get(m.name);
                        return executedAt !== undefined
                            ? `executed ${executedAt.toISOString()} ${m.name}`
                            : `pending ${m.name}`;
                    })
                    .join('\n')
            );
        }
        return 0;
    } catch (e) {
        output.error(e instanceof Error ? e.message : String(e));
        return 1;
    } finally {
        await client?.close();
    }
}

function parse(args: string[]) {
    return parseArgs({
        args,
        allowPositionals: true,
        options: {
            uri: { type: 'string' },
            migrations: { type: 'string' },
            collection: { type: 'string' },
            steps: { type: 'string' },
            help: { type: 'boolean', short: 'h' }
        }
    });
}
