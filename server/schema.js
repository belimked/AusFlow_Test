import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('authority'),
  status: text('status').notNull().default('active')
})

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' })
})

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  abn: text('abn'),
  contact: text('contact'),
  phone: text('phone'),
  address: text('address'),
  status: text('status').notNull().default('active'),
  types: text('types').notNull().default('["hauler"]')
})

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  agreementNo: text('agreement_no'),
  custodianCategory: text('custodian_category'),
  address1: text('address1'),
  address2: text('address2'),
  suburb: text('suburb'),
  state: text('state'),
  postcode: text('postcode'),
  ownerId: text('owner_id'),
  occupierId: text('occupier_id'),
  lat: real('lat'),
  lng: real('lng'),
  status: text('status').notNull().default('active')
})

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  ref: text('ref').notNull(),
  number: text('number'),
  aka: text('aka'),
  status: text('status').notNull(),
  type: text('type'),
  waste: text('waste'),
  qr: text('qr'),
  tags: text('tags'),
  capacity: real('capacity'),
  lat: real('lat'),
  lng: real('lng'),
  freqWeeks: real('freq_weeks'),
  lastService: text('last_service'),
  approvalCategory: text('approval_category'),
  risk: text('risk'),
  locationDesc: text('location_desc'),
  comments: text('comments'),
  locationId: text('location_id'),
  companyId: text('company_id')
}, (t) => [index('devices_location_idx').on(t.locationId), index('devices_company_idx').on(t.companyId)])

export const drivers = sqliteTable('drivers', {
  id: text('id').primaryKey(),
  companyId: text('company_id'),
  name: text('name').notNull(),
  account: text('account'),
  phone: text('phone'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at')
}, (t) => [index('drivers_company_idx').on(t.companyId)])

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  companyId: text('company_id'),
  plate: text('plate').notNull(),
  type: text('type'),
  tank: real('tank'),
  qr: text('qr'),
  status: text('status').notNull().default('active')
}, (t) => [index('vehicles_company_idx').on(t.companyId)])

export const facilities = sqliteTable('facilities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  lat: real('lat'),
  lng: real('lng'),
  qr: text('qr'),
  status: text('status').notNull().default('active')
})

export const pickups = sqliteTable('pickups', {
  id: text('id').primaryKey(),
  deviceId: text('device_id'),
  locationId: text('location_id'),
  companyId: text('company_id'),
  driverId: text('driver_id'),
  vehicleId: text('vehicle_id'),
  volume: real('volume'),
  waste: text('waste'),
  startAt: text('start_at'),
  endAt: text('end_at'),
  startLat: real('start_lat'),
  startLng: real('start_lng'),
  endLat: real('end_lat'),
  endLng: real('end_lng'),
  distance: real('distance'),
  photos: integer('photos'),
  flags: text('flags', { mode: 'json' }),
  note: text('note'),
  status: text('status').notNull()
}, (t) => [index('pickups_device_idx').on(t.deviceId), index('pickups_vehicle_idx').on(t.vehicleId)])

export const transfers = sqliteTable('transfers', {
  id: text('id').primaryKey(),
  companyId: text('company_id'),
  driverId: text('driver_id'),
  fromVehicleId: text('from_vehicle_id'),
  toVehicleId: text('to_vehicle_id'),
  volume: real('volume'),
  at: text('at'),
  lat: real('lat'),
  lng: real('lng')
}, (t) => [index('transfers_from_idx').on(t.fromVehicleId), index('transfers_to_idx').on(t.toVehicleId)])

export const unloads = sqliteTable('unloads', {
  id: text('id').primaryKey(),
  companyId: text('company_id'),
  driverId: text('driver_id'),
  vehicleId: text('vehicle_id'),
  facilityId: text('facility_id'),
  waste: text('waste'),
  volume: real('volume'),
  at: text('at'),
  lat: real('lat'),
  lng: real('lng')
}, (t) => [index('unloads_vehicle_idx').on(t.vehicleId)])

export const changeLogs = sqliteTable('change_logs', {
  id: text('id').primaryKey(),
  deviceId: text('device_id'),
  entityType: text('entity_type').notNull().default('device'),
  entityId: text('entity_id'),
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  user: text('user'),
  source: text('source'),
  at: text('at')
}, (t) => [index('change_logs_device_idx').on(t.deviceId)])

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  text: text('text').notNull(),
  user: text('user'),
  source: text('source').notNull(),
  at: text('at')
}, (t) => [index('notes_entity_idx').on(t.entityType, t.entityId)])

export const inspections = sqliteTable('inspections', {
  id: text('id').primaryKey(), deviceId: text('device_id').notNull(), inspector: text('inspector'),
  at: text('at'), result: text('result').notNull(), comments: text('comments'),
  nextInspection: text('next_inspection'), source: text('source').notNull()
}, (t) => [index('inspections_device_idx').on(t.deviceId)])

export const reportedIssues = sqliteTable('reported_issues', {
  id: text('id').primaryKey(), deviceId: text('device_id').notNull(), category: text('category').notNull(),
  description: text('description'), reportedBy: text('reported_by'), at: text('at'),
  status: text('status').notNull().default('open'), source: text('source').notNull().default('App')
}, (t) => [index('reported_issues_device_idx').on(t.deviceId)])

export const importLogs = sqliteTable('import_logs', {
  id: text('id').primaryKey(),
  at: text('at'),
  user: text('user'),
  fileName: text('file_name'),
  total: integer('total'),
  added: integer('added'),
  updated: integer('updated'),
  unchanged: integer('unchanged'),
  failed: integer('failed'),
  newLocations: integer('new_locations'),
  newCompanies: integer('new_companies'),
  errors: text('errors', { mode: 'json' })
})

export const alertNotes = sqliteTable('alert_notes', {
  id: text('id').primaryKey(),
  alertId: text('alert_id').notNull(),
  kind: text('kind').notNull(),
  status: text('status'),
  text: text('text'),
  user: text('user'),
  at: text('at')
}, (t) => [index('alert_notes_alert_idx').on(t.alertId)])

export const alertReads = sqliteTable('alert_reads', {
  id: text('id').primaryKey()
})

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  kind: text('kind').notNull(),
  name: text('name'),
  dataUrl: text('data_url').notNull(),
  user: text('user'),
  at: text('at')
}, (t) => [index('photos_entity_idx').on(t.entityType, t.entityId)])
