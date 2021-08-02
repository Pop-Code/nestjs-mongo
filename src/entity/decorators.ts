export function Collection(name: string) {
    return (target: any) => Reflect.defineMetadata('mongo:collectionName', name, target);
}
