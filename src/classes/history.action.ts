import { IsString, IsDate } from 'class-validator';

export class HistoryAction {
    @IsString()
    action: string;

    @IsDate()
    date: Date;

    constructor(action: string, date: Date) {
        this.action = action;
        this.date = date;
    }
}
