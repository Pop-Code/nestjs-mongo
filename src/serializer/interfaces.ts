export interface SerializableInterface {
    /**
     * Transform a class instance to plain object (ObjectIds become string)
     */
    serialize: () => Record<string, any>;

    /**
     * Transform a class instance to json object (ObjectIds are not touched)
     */
    toJSON: () => Record<string, any>;
}
