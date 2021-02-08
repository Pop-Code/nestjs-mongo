import { Type } from 'class-transformer';

import { Slugify } from '../../decorators';

export class EntitySlugTest {
    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @Type(() => String)
    public readonly firstName: string;

    @Type(() => String)
    public readonly lastName: string;

    @Slugify({
        generate: ({ firstName, lastName }: { [key: string]: string }) =>
            `${firstName} ${lastName}`,
        expose: true,
        options: { lower: true }
    })
    slug: string;

    @Slugify<EntitySlugTest>({
        keys: ['firstName', 'lastName'],
        expose: true,
        options: { lower: true }
    })
    slug2: string;
}
