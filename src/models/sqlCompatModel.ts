class QueryChain<T = any> implements PromiseLike<T> {
  constructor(private readonly executor: () => Promise<T>) {}

  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  sort() { return this; }
  limit() { return this; }

  exec() {
    return this.executor();
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executor().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null) {
    return this.executor().catch(onrejected);
  }
}

function createDocument<T extends Record<string, any>>(data: T = {} as T) {
  return {
    ...data,
    _id: data._id || data.id,
    id: data.id || data._id,
    save: async function () { return this; },
    markModified: () => undefined,
    populate: async function () { return this; },
    select: function () { return this; },
    lean: function () { return this; },
    exec: async function () { return this; },
  };
}

export function createSqlCompatModel(modelName: string) {
  class SqlCompatModel {
    [key: string]: any;

    constructor(data: Record<string, any> = {}) {
      Object.assign(this, createDocument(data));
    }

    static find(filter: Record<string, any> = {}) {
      return new QueryChain(async () => [] as any[]);
    }

    static findOne(filter: Record<string, any> = {}) {
      return new QueryChain(async () => null as any);
    }

    static findById(id: string) {
      return new QueryChain(async () => null as any);
    }

    static create(data: Record<string, any>) {
      return Promise.resolve(createDocument({ ...data, id: data.id || data._id || crypto.randomUUID() }));
    }

    static findByIdAndUpdate(id: string, update: Record<string, any>) {
      return new QueryChain(async () => createDocument({ id, _id: id, ...(update.$set || update) }) as any);
    }

    static findByIdAndDelete(id: string) {
      return new QueryChain(async () => createDocument({ id, _id: id }) as any);
    }

    static findOneAndDelete(filter: Record<string, any>) {
      return new QueryChain(async () => createDocument(filter) as any);
    }

    static updateOne() {
      return new QueryChain(async () => ({ modifiedCount: 0 }) as any);
    }

    static updateMany() {
      return new QueryChain(async () => ({ modifiedCount: 0 }) as any);
    }

    static deleteMany() {
      return new QueryChain(async () => ({ deletedCount: 0 }) as any);
    }

    static aggregate() {
      return new QueryChain(async () => [] as any[]);
    }
  }

  Object.defineProperty(SqlCompatModel, "name", { value: modelName });
  return SqlCompatModel as any;
}
