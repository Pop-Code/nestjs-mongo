/**
 * @module nestjs-mongo
 */

import { ApiModelProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { serialize } from 'class-transformer';

export class PaginatedResponse {
    @ApiModelProperty({
        description: 'The total count of data',
        minimum: 0
    })
    @IsNumber()
    count: number;
    data: any;

    toJSON() {
        return JSON.parse(serialize(this));
    }
}
