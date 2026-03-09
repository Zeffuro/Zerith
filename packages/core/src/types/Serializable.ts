export type Serializable =
    | { [key: string]: Serializable }
    | boolean
    | null
    | number
    | Serializable[]
    | string;

