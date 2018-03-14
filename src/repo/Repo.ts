import * as _ from '../support/lodash'
import Utils from '../support/Utils'
import Container from '../connections/Container'
import { Record, Records, NormalizedData, PlainItem, PlainCollection, Item, Collection } from '../data/Contract'
import Data from '../data/Data'
import Attrs, { Fields } from '../attributes/contracts/Contract'
import Attribute from '../attributes/Attribute'
import RelationClass from '../attributes/relations/Relation'
import Model from '../model/Model'
import { State, EntityState } from '../modules/Module'

export type WhereBoolean = 'and' | 'or'

export type WherePrimaryClosure = (record: Record, query: Repo, model?: Model) => boolean | void

export type WhereSecondaryClosure = (value: any) => boolean

export type OrderDirection = 'asc' | 'desc'

export type Predicate = (item: Record) => boolean

export type Condition = number | string | Predicate

export type Buildable = PlainItem | PlainCollection | null

export type Constraint = (query: Repo) => void | boolean

export type ConstraintCallback = (relationName: string) => Constraint | null

export interface Wheres {
  field: string | number | WherePrimaryClosure
  value: string | number | WhereSecondaryClosure
  boolean: WhereBoolean
}

export interface Orders {
  field: string
  direction: OrderDirection
}

export interface Hooks {
  on: string
  callback: Function
}

export interface Relation {
  name: string
  constraint: null | Constraint
}

export default class Repo {
  /**
   * Lifecycle hooks for the query.
   */
  static hooks: Hooks[] = []

  /**
   * The root state of the Vuex Store.
   */
  rootState: State

  /**
   * The entity state of the Vuex Store.
   */
  state: EntityState

  /**
   * The name of the entity.
   */
  entity: string

  /**
   * The model of the entity.
   */
  model: typeof Model

  /**
   * The where constraints for the query.
   */
  wheres: Wheres[] = []

  /**
   * The orders of the query result.
   */
  orders: Orders[] = []

  /**
   * Number of results to skip.
   */
  _offset: number = 0

  /**
   * Maximum number of records to return.
   *
   * We use polyfill of `Number.MAX_SAFE_INTEGER` for IE11 here.
   */
  _limit: number = Math.pow(2, 53) - 1

  /**
   * The relationships that should be loaded with the result.
   */
  load: Relation[] = []

  /**
   * Whether to wrap returing record with class or to return as plain object.
   */
  wrap: boolean

  /**
   * Create a new repo instance.
   */
  constructor (state: State, entity: string, wrap: boolean = true) {
    this.rootState = state
    this.state = state[entity]
    this.entity = entity
    this.model = this.getModel(entity)
    this.wrap = wrap
  }

  /**
   * Create a new repo instance
   */
  static query (state: State, name: string, wrap?: boolean): Repo {
    return new this(state, name, wrap)
  }

  /**
   * Get model of given name from the container.
   */
  static getModel (state: State, name: string): typeof Model {
    return Container.connection(state.name).model(name)
  }

  /**
   * Get all models from the container.
   */
  static getModels (state: State): { [name: string]: typeof Model } {
    return Container.connection(state.name).models()
  }

  /**
   * Save the given data to the state. This will replace any existing
   * data in the state.
   */
  static create (state: State, entity: string, data: any, insert: string[] = []): Item | Collection {
    return (new this(state, entity)).create(data, insert)
  }

  /**
   * Insert given data to the state. Unlike `create`, this method will not
   * remove existing data within the state, but it will update the data
   * with the same primary key.
   */
  static insert (state: State, entity: string, data: any, create: string[] = []): Item | Collection {
    return (new this(state, entity)).insert(data, create)
  }

  /**
   * Update data in the state.
   */
  static update (state: State, entity: string, data: any, condition?: Condition): Item | Collection {
    return (new this(state, entity)).update(data, condition)
  }

  /**
   * Insert or update given data to the state. Unlike `insert`, this method
   * will not replace existing data within the state, but it will update only
   * the submitted data with the same primary key.
   */
  static insertOrUpdate (state: State, entity: string, data: any, create: string[] = []): Item | Collection {
    return (new this(state, entity)).insertOrUpdate(data, create)
  }

  /**
   * Get all data of the given entity from the state.
   */
  static all (state: State, entity: string, wrap?: boolean): Collection {
    return (new this(state, entity, wrap)).get()
  }

  /**
   * Find a data of the given entity by given id from the given state.
   */
  static find (state: State, entity: string, id: string | number, wrap?: boolean): Item {
    return (new this(state, entity, wrap)).first(id)
  }

  /**
   * Get the count of the retrieved data.
   */
  static count (state: State, entity: string, wrap?: boolean): number {
    return (new this(state, entity, wrap)).count()
  }

  /**
   * Get the max value of the specified filed.
   */
  static max (state: State, entity: string, field: string, wrap?: boolean): number {
    return (new this(state, entity, wrap)).max(field)
  }

  /**
   * Get the min value of the specified filed.
   */
  static min (state: State, entity: string, field: string, wrap?: boolean): number {
    return (new this(state, entity, wrap)).min(field)
  }

  /**
   * Delete data from the state.
   */
  static delete (state: State, entity: string, condition: Condition): void {
    (new this(state, entity)).delete(condition)
  }

  /**
   * Delete all data from the state.
   */
  static deleteAll (state: State, entity?: string): void {
    if (entity) {
      (new this(state, entity)).deleteAll()

      return
    }

    const models = this.getModels(state)

    _.forEach(models, (_model, name) => {
      state[name] && (new this(state, name)).deleteAll()
    })
  }

  /**
   * Register a callback.
   */
  static on (on: string, callback: Function): void {
    this.hooks.push({ on, callback })
  }

  /**
   * Get Repo class.
   */
  self (): typeof Repo {
    return this.constructor as typeof Repo
  }

  /**
   * Get model of given name from the container.
   */
  getModel (name?: string): typeof Model {
    const entity = name || this.entity

    return this.self().getModel(this.rootState, entity)
  }

  /**
   * Get all models from the container.
   */
  getModels (): { [name: string]: typeof Model } {
    return this.self().getModels(this.rootState)
  }

  /**
   * Save the given data to the state. It will replace any existing
   * data in the state.
   */
  create (data: any, insert: string[] = []): Item | Collection {
    return this.persist('persistCreate', data, [], insert)
  }

  /**
   * Insert given data to the state. Unlike `create`, this method will not
   * remove existing data within the state, but it will update the data
   * with the same primary key.
   */
  insert (data: any, create: string[] = []): Item | Collection {
    return this.persist('persistInsert', data, create, [])
  }

  /**
   * Insert or update given data to the state. Unlike `insert`, this method
   * will not replace existing data within the state, but it will update only
   * the submitted data with the same primary key.
   */
  insertOrUpdate (data: any, create: string[] = []): Item | Collection {
    const normalizedData: NormalizedData = this.normalize(data)
    const toBePersisted: NormalizedData = {}
    const updatedItems: string[] = []
    let persistedItems: (string | number)[] = []

    // `normalizedData` contains the differenty entity types (e.g. `users`),
    _.forEach(normalizedData, (data, entity) => {
      const repo = new Repo(this.rootState, entity, false)

      // `data` contains the items of `entity`.
      _.forEach(data, (item, id) => {
        // Check if item does not already exist in store and mark it as new.
        if (repo.model.id(item) === undefined || repo.find(repo.model.id(item)) === null) {
          if (!toBePersisted.hasOwnProperty(entity)) {
            toBePersisted[entity] = {}
          }

          toBePersisted[entity][id] = item
        } else {
          repo.processUpdate(item, repo.model.id(item))
          updatedItems.push(repo.model.id(item))
        }
      })
    })

    if (Object.keys(toBePersisted).length > 0) {
      persistedItems = this.processPersist('persistInsert', toBePersisted, create, [])
    }

    // merging the ids of updated and persisted items to return all of them.
    return this.getReturnData([...updatedItems, ...persistedItems])
  }

  /**
   * Persist data into Vuex Store.
   */
  persist (method: string, data: any, forceCreateFor: string[] = [], forceInsertFor: string[] = []): Item | Collection {
    const normalizedData = this.normalize(data)

    if (_.isEmpty(normalizedData) && method === 'persistCreate') {
      this.state.data = {}

      return null
    }

    const items = this.processPersist(method, normalizedData, forceCreateFor, forceInsertFor)

    return this.getReturnData(items)
  }

  /**
   * Persist data into the store. It returns list of created ids.
   */
  processPersist (defaultMethod: string, data: NormalizedData, forceCreateFor: string[] = [], forceInsertFor: string[] = []): (string | number)[] {
    const items: (string | number)[] = []

    const records = Data.fillAll(data, this)

    _.forEach(records, (data, entity) => {
      const method = this.getPersistMethod(defaultMethod, entity, forceCreateFor, forceInsertFor)

      if (entity !== this.entity) {
        (new Repo(this.rootState, entity) as any)[method](data)

        return
      }

      (this as any)[method](data)

      _.forEach(data, item => { items.push(item.$id) })
    })

    return items
  }

  /**
   * Persist data by removing any existing data.
   */
  persistCreate (data: Records): void {
    this.state.data = data
  }

  /**
   * Persist data by keeping any existing data.
   */
  persistInsert (data: Records): void {
    this.state.data = { ...this.state.data, ...data }
  }

  /**
   * Normalize the given data.
   */
  normalize (data: any): NormalizedData {
    return Data.normalize(data, this)
  }

  /**
   * Get method for persist.
   */
  getPersistMethod (defaultMethod: string, entity: string, forceCreateFor: string[] = [], forceInsertFor: string[] = []): string {
    if (_.includes(forceCreateFor, entity)) {
      return 'persistCreate'
    }

    if (_.includes(forceInsertFor, entity)) {
      return 'persistInsert'
    }

    return defaultMethod
  }

  /**
   * Get all data that should be retunred.
   */
  getReturnData (items: (string | number)[]): Item | Collection {
    if (items.length === 0) {
      return null
    }

    const method = items.length > 1 ? 'get' : 'first'

    return new Repo(this.rootState, this.entity).where('$id', (value: any) => {
      return _.includes(items, value)
    })[method]()
  }

  /**
   * Get all data that should be retunred. This method will always return
   * array of data even there's only a single item.
   */
  getManyReturnData (items: (string | number)[]): Item | Collection {
    if (items.length === 0) {
      return []
    }

    return new Repo(this.rootState, this.entity).where('$id', (value: any) => {
      return _.includes(items, value)
    }).get()
  }

  /**
   * Update data in the state.
   */
  update (data: any, condition?: Condition): Item | Collection {
    if (!condition) {
      return this.processUpdateById(data, this.model.id(data))
    }

    if (typeof condition === 'number' || typeof condition === 'string') {
      return this.processUpdateById(data, condition)
    }

    return this.processUpdateByCondition(data, condition)
  }

  /**
   * Update data by id.
   */
  processUpdateById (data: any, id?: any): Item | Collection {
    const items: any[] = []

    if (id !== undefined) {
      this.processUpdate(data, id)

      items.push(id)
    }

    return this.getReturnData(items)
  }

  /**
   * Update data by id.
   */
  processUpdateByCondition (data: any, condition: (record: Record) => boolean): Item | Collection {
    const records = (new Repo(this.rootState, this.entity, false)).where(condition).get()

    const items = _.map(records, record => this.model.id(record))

    this.processUpdate(data, condition)

    return this.getManyReturnData(items)
  }

  /**
   * Update data in the state.
   */
  processUpdate (data: Record | ((record: Record) => void), condition: Condition): void {
    if (typeof condition !== 'function') {
      this.state.data[condition] && this.processUpdateByClosure(this.state.data[condition], data)

      return
    }

    Utils.forOwn(this.state.data, (record) => {
      condition(record) && this.processUpdateByClosure(record, data)
    })
  }

  /**
   * Process the update depending on data type.
   */
  processUpdateByClosure (data: Record, record: Record | ((record: Record) => void)): void {
    typeof record === 'function' ? record(data) : this.processUpdateRecursively(data, record, this.model.fields())
  }

  /**
   * Process the update by recursively checking the model schema.
   */
  processUpdateRecursively (data: Record, record: Record, fields: Fields): void {
    Utils.forOwn(fields, (field, key) => {
      if (record[key] === undefined) {
        return
      }

      if (field instanceof Attribute) {
        data[key] = record[key]

        return
      }

      this.processUpdateRecursively(data[key], record[key], field)
    })
  }

  /**
   * Returns all record of the query chain result. This method is alias
   * of the `get` method.
   */
  all (): Collection {
    return this.get()
  }

  /**
   * Returns single record of the query chain result. This method is alias
   * of the `first` method.
   */
  find (id: number | string): Item {
    return this.first(id)
  }

  /**
   * Returns all record of the query chain result.
   */
  get (): Collection {
    const records = this.process()

    return this.collect(records)
  }

  /**
   * Returns single record of the query chain result.
   */
  first (id?: number | string): Item {
    const records = this.process()

    if (_.isEmpty(records)) {
      return null
    }

    if (id !== undefined) {
      const item = _.find(records, ['$id', id])

      if (item === undefined) {
        return null
      }

      return this.item(item)
    }

    return this.item(records[0])
  }

  /**
   * Returns the last single record of the query chain result.
   */
  last (): Item {
    const records = this.process()

    if (_.isEmpty(records)) {
      return null
    }

    const last = records.length - 1

    return this.item(records[last])
  }

  /**
   * Add a and where clause to the query.
   */
  where (field: any, value?: any): this {
    this.wheres.push({ field, value, boolean: 'and' })

    return this
  }

  /**
   * Add a or where clause to the query.
   */
  orWhere (field: any, value?: any): this {
    this.wheres.push({ field, value, boolean: 'or' })

    return this
  }

  /**
   * Add an order to the query.
   */
  orderBy (field: string, direction: OrderDirection = 'asc'): this {
    this.orders.push({ field, direction })

    return this
  }

  /**
   * Add an offset to the query.
   */
  offset (offset: number): this {
    this._offset = offset

    return this
  }

  /**
   * Add limit to the query.
   */
  limit (limit: number): this {
    this._limit = limit

    return this
  }

  /**
   * Set the relationships that should be loaded.
   */
  with (name: string, constraint: Constraint | null = null): this {
    if (name === '*') {
      this.withAll()
    } else {
      this.load.push({ name, constraint })
    }

    return this
  }

  /**
   * Query all relations.
   */
  withAll (constraints: ConstraintCallback = () => null): this {
    const fields = this.model.fields()

    for (const field in fields) {
      if (Attrs.isRelation(fields[field])) {
        this.load.push({ name: field, constraint: constraints(field) })
      }
    }

    return this
  }

  /**
   * Query all relations recursively.
   */
  withAllRecursive (depth: number = 3): this {
    this.withAll(() => {
      return depth > 0 ? (query: Repo) => {
        query.withAllRecursive(depth - 1)
      } : null
    })

    return this
  }

  /**
   * Set where constraint based on relationship existence.
   */
  has (name: string, constraint?: number | string, count?: number): this {
    return this.addHasConstraint(name, constraint, count, true)
  }

  /**
   * Set where constraint based on relationship absence.
   */
  hasNot (name: string, constraint?: number | string, count?: number): this {
    return this.addHasConstraint(name, constraint, count, false)
  }

  /**
   * Add where constraints based on has or hasNot condition.
   */
  addHasConstraint (name: string, constraint?: number | string, count?: number, existence?: boolean): this {
    const ids = this.matchesHasRelation(name, constraint, count, existence)

    this.where('$id', (value: any) => _.includes(ids, value))

    return this
  }

  /**
   * Add where has condition.
   */
  whereHas (name: string, constraint: Constraint): this {
    return this.addWhereHasConstraint(name, constraint, true)
  }

  /**
   * Add where has not condition.
   */
  whereHasNot (name: string, constraint: Constraint): this {
    return this.addWhereHasConstraint(name, constraint, false)
  }

  /**
   * Add where has constraints that only matches the relationship constraint.
   */
  addWhereHasConstraint (name: string, constraint: Constraint, existence?: boolean): this {
    const ids = this.matchesWhereHasRelation(name, constraint, existence)

    this.where('$id', (value: any) => _.includes(ids, value))

    return this
  }

  /**
   * Process the query and filter data.
   */
  process (): PlainCollection {
    let records: PlainCollection = Object.keys(this.state.data).map(id => ({ ...this.state.data[id] }))

    // Process `beforeProcess` hook.
    records = this.executeHooks('beforeProcess', records)

    // If the where clause is registered, lets filter the records beased on it.
    if (!_.isEmpty(this.wheres)) {
      records = this.selectByWheres(records)
    }

    // Process `afterWhere` hook.
    records = this.executeHooks('afterWhere', records)

    // Next, lets sort the data if orderBy is registred.
    if (!_.isEmpty(this.orders)) {
      records = this.sortByOrders(records)
    }

    // Process `afterOrderBy` hook.
    records = this.executeHooks('afterOrderBy', records)

    // Finally, slice the record by limit and offset.
    records = _.slice(records, this._offset, this._offset + this._limit)

    // Process `afterLimit` hook.
    records = this.executeHooks('afterLimit', records)

    return records
  }

  /**
   * Filter the given data by registered where clause.
   */
  selectByWheres (records: PlainCollection): PlainCollection {
    return records.filter(record => this.whereOnRecord(record))
  }

  /**
   * Sort the given data by registered orders.
   */
  sortByOrders (records: PlainCollection): PlainCollection {
    const keys = _.map(this.orders, 'field')
    const directions = _.map(this.orders, 'direction')

    return _.orderBy(records, keys, directions)
  }

  /**
   * Checks if given Record matches the registered where clause.
   */
  whereOnRecord (record: Record): boolean {
    let whereTypes: any = _.groupBy(this.wheres, where => where.boolean)
    let whereResults: boolean[] = []
    let comparator: (where: any) => boolean = this.getComparator(record)

    if (whereTypes.and) {
      whereResults.push(_.every(whereTypes.and, comparator))
    }

    if (whereTypes.or) {
      whereResults.push(_.some(whereTypes.or, comparator))
    }

    return whereResults.indexOf(true) !== -1
  }

  /**
   * Get comparator for the where clause.
   */
  getComparator (record: Record): (where: any) => boolean {
    return (where: any) => {
      // Function with Record and Query as argument.
      if (_.isFunction(where.field)) {
        const query = new Repo(this.rootState, this.entity)
        const result = this.executeWhereClosure(record, query, where.field)

        if (typeof result === 'boolean') {
          return result
        }

        return !_.isEmpty(query.where('$id', record['$id']).get())
      }

      // Function with Record value as argument.
      if (_.isFunction(where.value)) {
        return where.value(record[where.field])
      }

      // Check if field value is in given where Array.
      if (_.isArray(where.value)) {
        return where.value.indexOf(record[where.field]) !== -1
      }

      // Simple equal check.
      return record[where.field] === where.value
    }
  }

  /**
   * Execute where closure.
   */
  executeWhereClosure (record: Record, query: Repo, closure: WherePrimaryClosure): boolean | void {
    if (closure.length !== 3) {
      return closure(record, query)
    }

    const model = new this.model(record)

    return closure(record, query, model)
  }

  /**
   * Execute the callback of the given hook.
   */
  executeHooks (on: string, records: PlainCollection): PlainCollection {
    let items = records

    this.self().hooks.forEach((hook) => {
      if (hook.on !== on) {
        items = records

        return
      }

      items = hook.callback(items, this.entity)
    })

    return items
  }

  /**
   * Get the count of the retrieved data.
   */
  count (): number {
    // Do not wrap result data with class because it's unnecessary.
    this.wrap = false

    return this.get().length
  }

  /**
   * Get the max value of the specified filed.
   */
  max (field: string): number {
    // Do not wrap result data with class because it's unnecessary.
    this.wrap = false

    const record = _.maxBy(this.get(), field)

    return record ? record[field] : 0
  }

  /**
   * Get the min value of the specified filed.
   */
  min (field: string): number {
    // Do not wrap result data with class because it's unnecessary.
    this.wrap = false

    const record = _.minBy(this.get(), field)

    return record ? record[field] : 0
  }

  /**
   * Create a item from given record.
   */
  item (queryItem: PlainItem): Item {
    if (!queryItem) {
      return null
    }

    let item: Item = queryItem

    if (!_.isEmpty(this.load)) {
      item = this.loadRelations([item])[0]
    }

    if (!this.wrap) {
      return item
    }

    return new this.model(item)
  }

  /**
   * Create a collection (array) from given records.
   */
  collect (collection: PlainCollection): Collection {
    if (_.isEmpty(collection)) {
      return []
    }

    let item = collection

    if (!_.isEmpty(this.load)) {
      item = this.loadRelations(item)
    }

    if (!this.wrap) {
      return item
    }

    return _.map(item, data => new this.model(data))
  }

  /**
   * Load the relationships for the record.
   */
  loadRelations (data: PlainCollection, relation?: Relation[]): PlainCollection {
    const _relation = relation || this.load
    const fields = this.model.fields()

    return _.reduce(_relation, (records, rel) => {
      return this.processLoadRelations(records, rel, fields)
    }, data)
  }

  /**
   * Process load relationships. This method is for the circuler processes.
   */
  processLoadRelations (data: PlainCollection, relation: Relation, fields: Fields): PlainCollection {
    const relationName = relation.name.split('.')[0]

    let collection: Collection = data

    Object.keys(fields).some((key) => {
      const field = fields[key]

      if (key === relationName) {
        if (field instanceof RelationClass) {
          collection = field.load(this, collection, relation)
        }

        return true
      }

      if (field instanceof Attribute) {
        return false
      }

      collection = this.processLoadRelations(collection, relation, field)

      return false
    })

    return collection
  }

  /**
   * Check if the given collection has given relationship.
   */
  matchesHasRelation (name: string, constraint?: number | string, count?: number, existence: boolean = true): string[] {
    let _constraint: (records: PlainCollection) => boolean

    if (constraint === undefined) {
      _constraint = record => record.length >= 1
    } else if (typeof constraint === 'number') {
      _constraint = record => record.length >= constraint
    } else if (constraint === '=' && typeof count === 'number') {
      _constraint = record => record.length === count
    } else if (constraint === '>' && typeof count === 'number') {
      _constraint = record => record.length > count
    } else if (constraint === '>=' && typeof count === 'number') {
      _constraint = record => record.length >= count
    } else if (constraint === '<' && typeof count === 'number') {
      _constraint = record => record.length < count
    } else if (constraint === '<=' && typeof count === 'number') {
      _constraint = record => record.length <= count
    }

    const data = (new Repo(this.rootState, this.entity, false)).with(name).get()

    let ids: string[] = []

    data.forEach((item) => {
      const target = item[name]

      let result: boolean = false

      if (!target) {
        result = false
      } else if (Array.isArray(target) && target.length < 1) {
        result = false
      } else if (Array.isArray(target)) {
        result = _constraint(target)
      } else if (target) {
        result = _constraint([target])
      }

      if (result !== existence) {
        return
      }

      ids.push(item.$id)
    })

    return ids
  }

  /**
   * Get all id of the record that matches the relation constraints.
   */
  matchesWhereHasRelation (name: string, constraint: Constraint, existence: boolean = true): string[] {
    const data = (new Repo(this.rootState, this.entity, false)).with(name, constraint).get()

    let ids: string[] = []

    data.forEach((item) => {
      const target = item[name]
      const result = Array.isArray(target) ? !!target.length : !!target

      if (result !== existence) {
        return
      }

      ids.push(item.$id)
    })

    return ids
  }

  /**
   * Delete data from the state.
   */
  delete (condition: Condition): void {
    if (typeof condition === 'function') {
      this.state.data = _.pickBy(this.state.data, record => !condition(record))

      return
    }

    const id = typeof condition === 'number' ? condition.toString() : condition

    this.state.data = _.pickBy(this.state.data, (_record, key) => key !== id)
  }

  /**
   * Delete all data from the state.
   */
  deleteAll (): void {
    this.state.data = {}
  }
}
