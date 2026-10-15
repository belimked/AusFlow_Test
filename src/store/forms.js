import { state, haulers, nextId, save, ENTITY_STATUS, COMPANY_TYPES, companyTypes, DRIVER_STATUS, VEHICLE_TYPE } from './db'

const opts = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }))
const companyOptions = () => haulers.value.map((c) => ({ value: c.id, label: c.name + (c.status === 'active' ? '' : ' (Inactive)') }))
const unique = (key, label, rec) => (v) => state[key].some((x) => x[label] === v && x.id !== rec?.id) ? 'Already exists' : ''

export const companyFields = (rec) => [
  { key: 'name', label: 'Company name', required: true, validator: unique('companies', 'name', rec) },
  { key: 'types', label: 'Types', type: 'multiselect', options: opts(COMPANY_TYPES), required: true },
  { key: 'abn', label: 'ABN', required: true, placeholder: '11 digits', validator: (v) => (v && v.replace(/\s/g, '').length !== 11 ? 'ABN must be 11 digits' : '') },
  { key: 'contact', label: 'Contact' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', type: 'address' },
  { key: 'status', label: 'Status', type: 'radio', options: opts(ENTITY_STATUS) }
]
export const driverFields = (rec) => [
  { key: 'companyId', label: 'Hauler', type: 'select', options: companyOptions(), required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'account', label: 'Username', required: true, validator: unique('drivers', 'account', rec) },
  { key: 'status', label: 'Status', type: 'radio', options: opts(DRIVER_STATUS) }
]
export const vehicleFields = (rec) => [
  { key: 'companyId', label: 'Hauler', type: 'select', options: companyOptions(), required: true },
  { key: 'plate', label: 'Plate', required: true, validator: unique('vehicles', 'plate', rec) },
  { key: 'type', label: 'Truck type', type: 'radio', options: opts(VEHICLE_TYPE) },
  { key: 'tank', label: 'Tank capacity (L)', type: 'number', step: 500, required: true },
  { key: 'qr', label: 'Vehicle QR code', type: 'qr', prefix: 'VH', required: true },
  { key: 'status', label: 'Status', type: 'radio', options: opts(ENTITY_STATUS) }
]
export const facilityFields = (rec) => [
  { key: 'name', label: 'Facility name', required: true, validator: unique('facilities', 'name', rec) },
  { key: 'address', label: 'Address', type: 'address', required: true },
  { key: 'qr', label: 'Facility QR code', type: 'qr', prefix: 'FA', required: true },
  { key: 'status', label: 'Status', type: 'radio', options: opts(ENTITY_STATUS) },
  { key: 'coords', label: 'Coordinates', type: 'map' }
]
export const DEFAULTS = {
  companies: { status: 'active', types: '["hauler"]' },
  drivers: { status: 'active' },
  vehicles: { type: 'small', tank: 4000, status: 'active' },
  facilities: { status: 'active', lat: null, lng: null }
}
const PREFIX = { companies: 'CO', drivers: 'DR', vehicles: 'VE', facilities: 'FA' }

export function upsert(key, record, data) {
  if (key === 'companies') data.types = JSON.stringify(Array.isArray(data.types) ? data.types : companyTypes(data))
  if (record) Object.assign(record, data)
  else state[key].unshift({ ...data, id: nextId(PREFIX[key]), ...(key === 'drivers' ? { createdAt: new Date().toISOString() } : {}) })
  save()
}
