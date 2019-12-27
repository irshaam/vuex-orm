import { Store } from 'vuex'
import Connection from '../connections/Connection'
import Query from '../query/Query'
import OptionsBuilder from './support/OptionsBuilder'
import RootState from './contracts/RootState'
import MutationsContract from './contracts/RootMutations'
import * as Payloads from './payloads/RootMutations'

/**
 * Execute generic mutation. This method is used by `Model.commit` method so
 * that user can commit any state changes easily through models.
 */
function $mutate (this: Store<any>, state: RootState, payload: Payloads.$Mutate): void {
  payload.callback(state[payload.entity])
}

/**
 * Save given data to the store by replacing all existing records in the
 * store. If you want to save data without replacing existing records,
 * use the `insert` method instead.
 */
function create (this: Store<any>, _state: RootState, payload: Payloads.Create): void {
  const entity = payload.entity
  const data = payload.data
  const options = OptionsBuilder.createPersistOptions(payload)

  const result = payload.result

  result.data = (new Query(this, entity)).create(data, options)
}

/**
 * Insert the given record.
 */
function insert (this: Store<any>, state: RootState, payload: any): void {
  const { entity, record } = payload

  ;(new Connection(this, state.$name, entity)).insert(record)
}

/**
 * Insert the given records.
 */
function insertRecords (this: Store<any>, state: RootState, payload: any): void {
  const { entity, records } = payload

  ;(new Connection(this, state.$name, entity)).insertRecords(records)
}

/**
 * Update data in the store.
 */
function update (this: Store<any>, _state: RootState, payload: Payloads.Update): void {
  const entity = payload.entity
  const data = payload.data
  const where = payload.where || null
  const options = OptionsBuilder.createPersistOptions(payload)

  const result = payload.result

  result.data = (new Query(this, entity)).update(data, where, options)
}

/**
 * Insert or update given data to the state. Unlike `insert`, this method
 * will not replace existing data within the state, but it will update only
 * the submitted data with the same primary key.
 */
function insertOrUpdate (this: Store<any>, _state: RootState, payload: Payloads.InsertOrUpdate): void {
  const entity = payload.entity
  const data = payload.data
  const options = OptionsBuilder.createPersistOptions(payload)

  const result = payload.result

  result.data = (new Query(this, entity)).insertOrUpdate(data, options)
}

/**
 * Delete records from the store. The actual name for this mutation is
 * `delete`, but named `destroy` here because `delete` can't be declared at
 * this scope level.
 */
function destroy (this: Store<any>, state: RootState, payload: any): void {
  const { entity, id } = payload

  ;(new Connection(this, state.$name, entity)).delete(id)
}

/**
 * Delete all data from the store.
 */
function deleteAll (this: Store<any>, _state: RootState, payload?: Payloads.DeleteAll): void {
  if (payload && payload.entity) {
    (new Query(this, payload.entity)).deleteAll()

    return
  }

  Query.deleteAll(this)
}

const RootMutations: MutationsContract = {
  $mutate,
  create,
  insert,
  insertRecords,
  update,
  insertOrUpdate,
  delete: destroy,
  deleteAll
}

export default RootMutations
