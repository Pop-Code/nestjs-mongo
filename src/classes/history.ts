import { HistoryAction } from './history.action';
import { IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class HistoryActions {
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
