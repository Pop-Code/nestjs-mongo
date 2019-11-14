import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsOptional,
    IsPositive,
    Matches,
    Max
} from 'class-validator';
import { ISerializable, Serializable } from '../serializer';

export interface Filter extends ISerializable {}

@Serializable()
export class Filter {
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    skip?: number = 0;

    @IsPositive()
    @IsOptional()
    @IsInt()
    @Max(500)
    @Type(() => Number)
    limit: number = 50;

    @Transform(v => (typeof v === 'string' ? v.split(',') : v))
    @IsOptional()
    @IsArray()
    @Matches(/^(.+):(asc|desc)$/, { each: true })
    orderBy?: string[] = ['_id:asc'];

    getSort(): [string, 1 | -1][] {
        return this.orderBy.reduce((sorts: any[], orderString) => {
            const order = orderString.split(':');
            const property = order[0];
            const direction = order[1] === 'asc' ? 1 : -1;
            sorts.push([property, direction]);
            return sorts;
        }, []);
    }

    getSortForAggregation(): { [property: string]: 1 | -1 } {
        const sorts = {};
        this.orderBy.forEach(sort => {
            const order = sort.split(':');
            const property = order[0];
            const direction = order[1] === 'asc' ? 1 : -1;
            sorts[property] = direction;
        }, []);

        return sorts;
    }

    toQuery() {
        const query: any = {};
        return query;
    }
}
