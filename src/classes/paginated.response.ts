import { ApiModelProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { WithJSONSerialize } from '../decorators';
import { WithJSONSerializeInterface } from '../interfaces/jsonserialize';

export interface PaginatedResponse extends WithJSONSerializeInterface {}

@WithJSONSerialize()
export class PaginatedResponse {
    @ApiModelProperty({
        description: 'The total count of data',
        minimum: 0
    })
    @IsNumber()
    count: number;
    data: any;
}
