import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsPositive, Matches, Max } from 'class-validator';

import { Serializable, SerializableInterface } from '../serializer';

export interface Filter extends SerializableInterface {}

/**
 * A pagination and sorting filter, for example to validate query string parameters.
 *
 * `orderBy` accepts `property:asc` or `property:desc` items (or a comma separated string).
 * Extend it and override {@link Filter.toQuery} to add your own query parameters.
 */
@Serializable()
export class Filter {
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    skip = 0;

    @IsPositive()
    @IsOptional()
    @IsInt()
    @Max(500)
    @Type(() => Number)
    limit = 50;

    @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
    @IsOptional()
    @IsArray()
    @Matches(/^(.+):(asc|desc)$/, { each: true })
    orderBy?: string[] = ['_id:asc'];

    /**
     * Get the sort for `cursor.sort()`.
     */
    getSort(): Array<[string, 1 | -1]> {
        if (this.orderBy === undefined) {
            return [];
        }
        return this.orderBy.reduce((sorts: any[], orderString) => {
            const order = orderString.split(':');
            const property = order[0];
            const direction = order[1] === 'asc' ? 1 : -1;
            sorts.push([property, direction]);
            return sorts;
        }, []);
    }

    /**
     * Get the sort for a `$sort` aggregation stage.
     */
    getSortForAggregation(): { [property: string]: 1 | -1 } {
        const sorts = {};
        if (this.orderBy === undefined) {
            return sorts;
        }
        this.orderBy.forEach((sort) => {
            const order = sort.split(':');
            const property = order[0];
            const direction = order[1] === 'asc' ? 1 : -1;
            sorts[property] = direction;
        }, []);

        return sorts;
    }

    /**
     * Get the mongo query of the filter. Returns `{}`, override it in your filters.
     */
    toQuery() {
        const query: any = {};
        return query;
    }
}
