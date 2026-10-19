import { state, idx, isTransport, nextId, save, diffDevice, makeLog, CURRENT_USER } from './db'
import { rowToDevice, rowToLocation, locationKey } from './csv'
import { normName } from './seed'

const locKeyOf = (l) => [l.agreementNo || '', (l.address1 || '').toUpperCase(), l.name || ''].join('|')

// Builds an import plan without touching state.
export function previewImport(rows) {
  const locByKey = new Map(state.locations.map((l) => [locKeyOf(l), l]))
  const coByName = new Map(state.companies.filter(isTransport).map((c) => [normName(c.name), c]))
  const ownerByName = new Map(state.companies.filter((c) => !isTransport(c)).map((c) => [normName(c.name), c]))
  const plan = { adds: [], updates: [], unchanged: 0, errors: [], newLocations: new Map(), newCompanies: new Set(), newOwners: new Set() }
  const seen = new Set()
  rows.forEach((r, i) => {
    const line = i + 2
    const { device, errors } = rowToDevice(r)
    if (device.ref && seen.has(device.ref)) errors.push('Duplicate Device Ref in file')
    if (errors.length) return plan.errors.push({ line, ref: device.ref, reasons: errors })
    seen.add(device.ref)

    const key = locationKey(r)
    const loc = locByKey.get(key)
    if (!loc && !plan.newLocations.has(key)) plan.newLocations.set(key, { ...rowToLocation(r), lat: device.lat, lng: device.lng })
    const company = normName(r['Serviced By'])
    if (company && !coByName.has(company)) plan.newCompanies.add(company)
    const owner = normName(r['Owner'])
    if (owner && !ownerByName.has(owner)) plan.newOwners.add(owner)

    const existing = idx.devices.value.get(device.ref)
    const item = { line, row: r, device, locKey: key, company, owner }
    if (!existing) return plan.adds.push(item)

    const patch = { ...device }
    delete patch.id
    for (const f of ['lat', 'lng', 'qr', 'tags', 'lastService']) if (patch[f] == null || patch[f] === '') delete patch[f]
    if (patch.lastService && existing.lastService && patch.lastService <= existing.lastService) delete patch.lastService
    if (loc) patch.locationId = loc.id
    if (company && coByName.has(company)) patch.companyId = coByName.get(company).id
    if (owner && ownerByName.has(owner)) patch.ownerId = ownerByName.get(owner).id
    const fields = diffDevice(existing, patch)
    if (!fields.length && (loc || !plan.newLocations.has(key)) && (!company || coByName.has(company)) && (!owner || ownerByName.has(owner))) return plan.unchanged++
    plan.updates.push({ ...item, patch, fields })
  })
  return plan
}

export function executeImport(plan, fileName) {
  const locByKey = new Map(state.locations.map((l) => [locKeyOf(l), l]))
  for (const [key, l] of plan.newLocations) {
    const loc = { id: nextId('LO'), ...l }
    state.locations.push(loc)
    locByKey.set(key, loc)
  }
  const coByName = new Map(state.companies.filter(isTransport).map((c) => [normName(c.name), c]))
  for (const name of plan.newCompanies) {
    const c = { id: nextId('CO'), name, abn: '', contact: '', phone: '', address: '', status: 'active', types: '["transport"]' }
    state.companies.push(c)
    coByName.set(name, c)
  }
  const ownerByName = new Map(state.companies.filter((c) => !isTransport(c)).map((c) => [normName(c.name), c]))
  for (const name of plan.newOwners) {
    const c = { id: nextId('CO'), name, abn: '', contact: '', phone: '', address: '', status: 'active', types: '["owner"]' }
    state.companies.push(c)
    ownerByName.set(name, c)
  }
  const resolve = (it) => ({
    locationId: locByKey.get(it.locKey)?.id,
    ...(it.company ? { companyId: coByName.get(it.company).id } : {}),
    ...(it.owner ? { ownerId: ownerByName.get(it.owner).id } : {})
  })
  const logs = []
  const newDevices = []
  for (const it of plan.adds) {
    const dev = { ...it.device, companyId: null, ...resolve(it) }
    newDevices.push(dev)
    logs.push(makeLog(dev.id, 'Device created', '', dev.ref, 'CSV'))
  }
  state.devices = newDevices.concat(state.devices)
  let updated = 0
  for (const it of plan.updates) {
    const dev = idx.devices.value.get(it.device.ref)
    const patch = { ...it.patch, ...resolve(it) }
    const fields = diffDevice(dev, patch)
    for (const f of fields) {
      logs.push(makeLog(dev.id, f, dev[f], patch[f], 'CSV'))
      dev[f] = patch[f]
    }
    if (fields.length) updated++
  }
  state.changeLogs = logs.reverse().concat(state.changeLogs)
  const log = {
    id: nextId('IM'), at: new Date().toISOString(), user: CURRENT_USER, fileName,
    total: plan.adds.length + plan.updates.length + plan.unchanged + plan.errors.length,
    added: plan.adds.length, updated, unchanged: plan.unchanged + plan.updates.length - updated, failed: plan.errors.length,
    newLocations: plan.newLocations.size, newCompanies: plan.newCompanies.size + plan.newOwners.size,
    errors: plan.errors.slice(0, 200)
  }
  state.importLogs.unshift(log)
  save()
  return log
}
