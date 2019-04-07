/**
 * @module nestjs-mongo
 */

import { ApiModelProperty } from '@nestjs/swagger';
import { IsString, IsDate } from 'class-validator';

export class HistoryAction {
    @ApiModelProperty({
        description: 'A message describing the action'
    })
    @IsString()
    action: string;

    @ApiModelProperty({
        description: 'The date of the action',
        type: 'string',
        format: 'date-time'
    })
    @IsDate()
    date: Date;

    constructor(action: string, date: Date) {
        this.action = action;
        this.date = date;
    }
}
