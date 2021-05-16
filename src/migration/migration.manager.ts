import { InjectManager } from '../decorators';
import { MongoManager } from '../manager';
import { Migration } from './migration';

export class MigrationManager {
    protected readonly migrations: Migration[] = [];

    constructor(@InjectManager() protected readonly em: MongoManager) {}

    addMigration(updateOperation: Migration) {
        this.migrations.push(updateOperation);
        return this;
    }

    deleteMigration(version: number): Migration {
        const index = this.getMigrationIndex(version);
        if (index === -1) {
            throw new Error(
                `Can not deregister migration: no migration found with version ${version}`
            );
        }
        const items = this.migrations.splice(index, 1);
        return items[0];
    }

    getMigrationIndex(version: number): number | undefined {
        return this.migrations.findIndex((u) => u.getVersion() === version);
    }

    getMigration(version: number) {
        const index = this.getMigrationIndex(version);
        if (index === -1) {
            throw new Error(
                `Can not deregister migration: no migration found with version ${version}`
            );
        }
    }

    protected sortMigrations() {
        this.migrations.sort((a, b) => {});
    }

    async exec() {
        for (const migration of this.migrations) {
        }
    }
}
