import { CreateIndexesOptions, IndexDescription } from 'mongodb';

import { setIndexMetadata } from './metadata';

// TODO next release, change IndexDescription> & CreateIndexesOptions to Partial<IndexDescription>
export function Index(metadata?: Partial<IndexDescription> & CreateIndexesOptions) {
    return function (target: any, property: string) {
        setIndexMetadata(target, { property, description: metadata ?? {} });
    };
}
