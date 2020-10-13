import { IndexSpecification } from 'mongodb';

import { setIndexMetadata } from './metadata';

export function Index(metadata?: Partial<IndexSpecification>) {
    return (target: any, property: string) =>
        setIndexMetadata(
            target,
            property,
            metadata === undefined ? {} : metadata
        );
}
