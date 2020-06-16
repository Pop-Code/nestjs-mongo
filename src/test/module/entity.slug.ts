import { Collection, Slugify } from '../../decorators';
import { Entity } from '../../entity';

export const TEST_ENTITY_SLUG_COLLECTION_NAME = 'test_slug';

@Collection(TEST_ENTITY_SLUG_COLLECTION_NAME)
export class EntitySlugTest extends Entity {
    constructor(
        public readonly firstName: string,
        public readonly lastName: string
    ) {
        super();
    }

    @Slugify<EntitySlugTest>({
        keys: ['firstName', 'lastName'],
        expose: true,
        options: { lower: true }
    })
    slug: string;

    @Slugify<EntitySlugTest>({
        generate: ({ firstName }) => `${firstName} 42`,
        expose: true
    })
    slug2: string;
}
