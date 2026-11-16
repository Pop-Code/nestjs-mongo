import { MongoClient } from 'mongodb';

import { CLI_USAGE, loadMigrations, runCli } from '../../src';
import { DBTEST } from '../constants';

const uri = `${DBTEST}-cli`;
const migrationsFile = 'test/cli/migrations.fixture.ts';

const run = async (...args: string[]) => {
    const logs: string[] = [];
    const errors: string[] = [];
    const code = await runCli(args, { log: (m) => logs.push(m), error: (m) => errors.push(m) });
    return { code, logs: logs.join('\n'), errors: errors.join('\n') };
};

let client: MongoClient;

beforeAll(async () => {
    client = await new MongoClient(uri).connect();
    await client.db().dropDatabase();
});

describe('nestjs-mongo migrate', () => {
    it('should show the help', async () => {
        expect(await run('--help')).toEqual({ code: 0, logs: CLI_USAGE, errors: '' });
        expect(await run('-h')).toMatchObject({ code: 0 });
    });

    it('should reject the invalid commands and options', async () => {
        expect(await run()).toMatchObject({ code: 1, errors: CLI_USAGE });
        expect(await run('migrate', 'sideways')).toMatchObject({ code: 1, errors: CLI_USAGE });
        expect((await run('migrate', 'up', '--unknown')).errors).toContain("Unknown option '--unknown'");
        expect((await run('migrate', 'up', '--migrations', migrationsFile)).errors).toContain(
            'The --uri (or MONGODB_URI) and --migrations options are required'
        );
        expect(
            (await run('migrate', 'down', '--uri', uri, '--migrations', migrationsFile, '--steps', '0')).errors
        ).toBe('--steps must be a positive integer');
    });

    it('should run, show and revert the migrations', async () => {
        const options = ['--uri', uri, '--migrations', migrationsFile];
        expect((await run('migrate', 'status', ...options)).logs).toBe('pending 001-insert\npending 002-update');
        expect(await run('migrate', 'up', ...options)).toEqual({
            code: 0,
            logs: 'up 001-insert\nup 002-update',
            errors: ''
        });
        expect((await run('migrate', 'up', ...options)).logs).toBe('No pending migration');
        expect(await client.db().collection('cli').findOne({})).toMatchObject({ name: 'migrated', status: 'active' });
        expect((await run('migrate', 'status', ...options)).logs).toMatch(
            /^executed \S+ 001-insert\nexecuted \S+ 002-update$/
        );

        expect((await run('migrate', 'down', ...options)).logs).toBe('down 002-update');
        expect((await run('migrate', 'down', ...options, '--steps', '5')).logs).toBe('down 001-insert');
        expect((await run('migrate', 'down', ...options)).logs).toBe('No executed migration');
        expect(await client.db().collection('cli').countDocuments()).toBe(0);
    });

    it('should use MONGODB_URI and a custom collection', async () => {
        process.env.MONGODB_URI = uri;
        try {
            const result = await run(
                'migrate',
                'up',
                '--migrations',
                'test/cli/default.fixture.ts',
                '--collection',
                'history'
            );
            expect(result.logs).toBe('up 001-insert');
            expect(await client.db().collection('history').countDocuments()).toBe(1);
        } finally {
            delete process.env.MONGODB_URI;
        }
    });

    it('should report the errors', async () => {
        const invalid = await run('migrate', 'up', '--uri', uri, '--migrations', 'test/cli/invalid.fixture.ts');
        expect(invalid).toMatchObject({ code: 1 });
        expect(invalid.errors).toContain('does not export a list of migrations');
        const missing = await run('migrate', 'up', '--uri', uri, '--migrations', 'test/cli/missing.ts');
        expect(missing.errors).toContain('Cannot find module');
    });
});

describe('loadMigrations', () => {
    it('should load the migrations, default or module exports', () => {
        expect(loadMigrations(migrationsFile)).toHaveLength(2);
        expect(loadMigrations('test/cli/default.fixture.ts')).toHaveLength(1);
    });
});

afterAll(async () => {
    await client.db().dropDatabase();
    await client.close();
});
