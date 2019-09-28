import { ApiModelProperty } from '@nestjs/swagger';
import { classToPlain, Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsOptional,
    IsPositive,
    Matches,
    Max
} from 'class-validator';
import { WithJSONSerialize } from '../decorators';
import { WithJSONSerializeInterface } from '../interfaces/jsonserialize';

export interface Filter extends WithJSONSerializeInterface {}

@WithJSONSerialize()
export class Filter {
    @ApiModelProperty({
        description: 'The number of items to skip',
        required: false
    })
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    skip?: number = 0;

    @ApiModelProperty({
        description: 'The maximum number of items to return',
        default: 50,
        required: false
    })
    @IsPositive()
    @IsOptional()
    @IsInt()
    @Max(500)
    @Type(() => Number)
    limit: number = 50;

    @ApiModelProperty({
        description: 'The order to apply [property:[asc|desc]]',
        required: false,
        isArray: true,
        type: 'string',
        collectionFormat: 'csv'
    })
    @Transform(v => (typeof v === 'string' ? v.split(',') : v))
    @IsOptional()
    @IsArray()
    @Matches(/^(.+):(asc|desc)$/, { each: true })
    orderBy?: string[] = ['_id:asc'];

    get sort(): [string, 1 | -1][] {
        return this.orderBy.reduce((sorts: any[], orderString) => {
            const order = orderString.split(':');
            const property = order[0];
            const direction = order[1] === 'asc' ? 1 : -1;
            sorts.push([property, direction]);
            return sorts;
        }, []);
    }

    get sortForAggregation(): { [property: string]: 1 | -1 } {
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
