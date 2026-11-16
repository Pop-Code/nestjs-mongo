import { ValidationArguments } from 'class-validator';

// The messages of the validations, by validated object and property: a constraint is a single instance shared by
// all the validations, its message can not be stored on the instance.
const messages = new WeakMap<object, Map<string, string>>();

export function setValidationMessage(args: ValidationArguments, message: string): void {
    let map = messages.get(args.object);
    if (map === undefined) {
        map = new Map();
        messages.set(args.object, map);
    }
    map.set(args.property, message);
}

export function getValidationMessage(args: ValidationArguments | undefined, defaultMessage: string): string {
    if (args === undefined) return defaultMessage;
    return messages.get(args.object)?.get(args.property) ?? defaultMessage;
}
