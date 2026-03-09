export interface IBaseManager {
    destroy?(...arguments_: unknown[]): Promise<void> | void;
    init?(...arguments_: unknown[]): Promise<void> | void;
}

