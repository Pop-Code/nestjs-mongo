import { MongoManager } from '../manager';

export abstract class Migration {
    /**
     * The next version of the database
     */
    protected readonly version: number;

    constructor(version: number) {
        this.version = version;
    }

    getVersion() {
        return this.version;
    }

    /**
     * The exec method will be executed by mongodb at the application startup
     * If multiple UpdateOperation are registered, operations are sorted by version using semver.
     * @param em
     */
    abstract exec(em: MongoManager): Promise<void> | void;
}
