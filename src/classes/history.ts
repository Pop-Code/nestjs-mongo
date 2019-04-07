/**
 * @module nestjs-mongo
 */

import { HistoryAction } from './history.action';
import { IsArray } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class HistoryActions {
    @ApiModelProperty({
        description: 'A list of HisotryAction',
        isArray: true,
        type: HistoryAction
    })
    @IsArray()
    @Type(() => HistoryAction)
    protected actions: HistoryAction[] = [];

    get length() {
        return this.actions.length;
    }

    add(historyAction: HistoryAction) {
        this.actions.push(historyAction);
    }

    clear(historyAction: HistoryAction) {
        this.actions = [];
    }

    getActions() {
        return this.actions;
    }
}
