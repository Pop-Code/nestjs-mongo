import { IsNumber } from 'class-validator';

import { Serializable, SerializableInterface } from '../serializer';

export interface PaginatedData extends SerializableInterface {}

/**
 * A page of results returned by {@link EntityService.list}: the total `count` and the page `data`.
 */
@Serializable()
export class PaginatedData<D = any> {
    @IsNumber()
    count: number;

    data: D[];
}
