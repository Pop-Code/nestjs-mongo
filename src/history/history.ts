import { Type } from 'class-transformer';
import { IsArray } from 'class-validator';

import { HistoryAction } from './history.action';

export class HistoryActions {
    @IsArray()
    @Type(() => HistoryAction)
    actions: HistoryAction[] = [];

    add(historyAction: HistoryAction) {
        this.actions.push(historyAction);
    }

    clear() {
        this.actions = [];
    }

    getActions() {
        return this.actions;
    }
}
