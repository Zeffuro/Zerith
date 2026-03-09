export interface IBaseManager {
    init?(...arguments_: unknown[]): void | Promise<void>;
    destroy?(...arguments_: unknown[]): void | Promise<void>;
}

