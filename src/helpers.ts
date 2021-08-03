export const isClass = (fn: any) => /^\s*class/.test(fn.toString());

export function getObjectName(o: Object): string {
    return o.constructor.name;
}
