import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { resetDemo } from '../store/db'
import { can, logout as signOut } from '../store/api'
import { unreadCount } from '../store/alerts'

// Stitch (D) is the one layout now; ?layout=<key> still previews the other shells for comparison.
export const LAYOUTS = [
  { key: 'hydro', label: 'D · Stitch' },
  { key: 'classic', label: 'Current' },
  { key: 'harbour', label: 'A · Top nav' },
  { key: 'rail', label: 'B · Icon rail' },
  { key: 'calm', label: 'C · Light sidebar' }
]
const pick = (k) => (LAYOUTS.some((l) => l.key === k) ? k : null)
export const layoutKey = ref(pick(new URLSearchParams(location.search).get('layout')) || 'hydro')

export const NAV = [
  { key: 'monitor', label: 'Monitor', icon: 'Odometer', items: [
    { path: '/dashboard', label: 'Dashboard', icon: 'House' },
    { path: '/alerts', label: 'Alerts', icon: 'Bell', badge: true },
    { path: '/tickets', label: 'Ops Tickets', icon: 'Message' }
  ] },
  { key: 'assets', label: 'Assets', icon: 'Box', items: [
    { path: '/locations', label: 'Locations', icon: 'Location' },
    { path: '/devices', label: 'Device List', icon: 'Box' },
    { path: '/inspections', label: 'Inspections', icon: 'Checked' },
    { path: '/tags', label: 'Device Tags', icon: 'PriceTag' },
    { path: '/import', label: 'CSV Import', icon: 'Upload', perm: 'write' },
    { path: '/change-logs', label: 'Change Log', icon: 'Clock' }
  ] },
  { key: 'parties', label: 'Companies', icon: 'OfficeBuilding', items: [
    { path: '/companies?type=occupier', label: 'Occupiers', icon: 'Shop' },
    { path: '/companies', label: 'Transport companies', icon: 'OfficeBuilding' },
    { path: '/drivers', label: 'Drivers', icon: 'User' },
    { path: '/vehicles', label: 'Vehicles', icon: 'Van' },
    { path: '/facilities', label: 'Facilities', icon: 'School' }
  ] },
  { key: 'ops', label: 'Operations', icon: 'Tickets', items: [
    { path: '/pickups', label: 'Pump-outs', icon: 'Download' },
    { path: '/transfers', label: 'Transfers', icon: 'Switch' },
    { path: '/unloads', label: 'Unloads', icon: 'Upload' },
    { path: '/trace', label: 'Waste Tracking', icon: 'Guide' }
  ] },
  { key: 'admin', label: 'Admin', icon: 'Setting', items: [
    { path: '/users', label: 'Users & Roles', icon: 'UserFilled', perm: 'admin' }
  ] }
]

export function useShell() {
  const route = useRoute()
  const router = useRouter()
  const nav = computed(() => NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length))
  const active = computed(() => {
    const p = route.path
    // "Occupiers" and "Transport companies" share the /companies route; only the query tells them apart.
    if (p.startsWith('/companies') && route.query.type && route.query.type !== 'transport') return `/companies?type=${route.query.type}`
    const map = { '/locations/': '/locations', '/devices/': '/devices', '/companies/': '/companies', '/drivers/': '/drivers', '/vehicles/': '/vehicles', '/pickups/': '/pickups', '/facilities/': '/facilities' }
    for (const [k, v] of Object.entries(map)) if (p.startsWith(k)) return v
    return p
  })
  const activeGroup = computed(() => nav.value.find((g) => g.items.some((i) => i.path === active.value)))
  const activeItem = computed(() => activeGroup.value?.items.find((i) => i.path === active.value))
  // Company pages serve several company types; the query says which one, the route meta only knows "transport".
  const COMPANY_TITLES = { occupier: ['Occupiers', 'Occupier details'], owner: ['Owners', 'Owner details'], facility_operator: ['Facility operators', 'Facility operator details'], authority: ['Authorities', 'Authority details'], all: ['Companies', 'Company details'] }
  const title = computed(() => {
    const t = COMPANY_TITLES[route.query.type]
    if (t && route.path.startsWith('/companies')) return route.params.id ? t[1] : t[0]
    return route.meta.title
  })

  async function reset() {
    try { await ElMessageBox.confirm('This will clear all changes, imports and new records and restore the original demo data.', 'Reset demo data', { type: 'warning' }) } catch { return }
    await resetDemo()
    ElMessage.success('Demo data reset')
    router.push('/dashboard')
  }
  function logout() { signOut(); router.push('/login') }
  const go = (path) => router.push(path)

  return { route, nav, active, activeGroup, activeItem, title, unreadCount, reset, logout, go }
}
