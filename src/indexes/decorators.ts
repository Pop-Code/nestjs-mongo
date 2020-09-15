import { IndexOptions } from 'mongodb';

import { setIndexMetadata } from './metadata';

export function Index(metadata: IndexOptions) {
    return (target: any, property: string) =>
        setIndexMetadata(target, property, metadata);
}
