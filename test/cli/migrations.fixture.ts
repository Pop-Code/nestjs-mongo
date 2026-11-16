import { Migration } from '../../src';

export const migrations: Migration[] = [
    {
        name: '001-insert',
        up: async (db) => {
            await db.collection('cli').insertOne({ name: 'migrated' });
        },
        down: async (db) => {
            await db.collection('cli').deleteOne({ name: 'migrated' });
        }
    },
    {
        name: '002-update',
        up: async (db) => {
            await db.collection('cli').updateMany({}, { $set: { status: 'active' } });
        },
        down: async (db) => {
            await db.collection('cli').updateMany({}, { $unset: { status: '' } });
        }
    }
];
