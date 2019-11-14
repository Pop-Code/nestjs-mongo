import { HistoryAction } from './history.action';
import { IsArray } from 'class-validator';
import { Type } from 'class-transformer';

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
