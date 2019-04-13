export interface WithRelationshipInterface {
    getCachedRelationship<T = any>(prop: string): T;
    setCachedRelationship(prop: string, value: any): WithRelationshipInterface;
}
