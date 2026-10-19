import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from './views/Layout.vue'
import { isSignedIn, can } from './store/api'
import { isLoaded, loadState, refreshUser } from './store/db'

const v = (name) => () => import(`./views/${name}.vue`)
const routes = [
  { path: '/login', component: v('Login'), meta: { public: true } },
  {
    path: '/', component: Layout, redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: v('Dashboard'), meta: { title: 'Dashboard' } },
      { path: 'alerts', component: v('Alerts'), meta: { title: 'Alerts' } },
      { path: 'tickets', component: v('Tickets'), meta: { title: 'Ops Tickets' } },
      { path: 'users', component: v('Users'), meta: { title: 'Users & Roles', perm: 'admin' } },
      { path: 'locations', component: v('Locations'), meta: { title: 'Locations' } },
      { path: 'locations/:id', component: v('LocationDetail'), meta: { title: 'Location Details' } },
      { path: 'devices', component: v('Devices'), meta: { title: 'Device List' } },
      { path: 'inspections', component: v('Inspections'), meta: { title: 'Inspections' } },
      { path: 'tags', component: v('Tags'), meta: { title: 'Device Tags' } },
      { path: 'devices/:id', component: v('DeviceDetail'), meta: { title: 'Device Details' } },
      { path: 'import', component: v('CsvImport'), meta: { title: 'CSV Import', perm: 'write' } },
      { path: 'change-logs', component: v('ChangeLogs'), meta: { title: 'Change Log' } },
      { path: 'companies', component: v('Companies'), meta: { title: 'Transport companies' } },
      { path: 'companies/:id', component: v('CompanyDetail'), meta: { title: 'Transport company details' } },
      { path: 'drivers', component: v('Drivers'), meta: { title: 'Drivers' } },
      { path: 'vehicles', component: v('Vehicles'), meta: { title: 'Vehicles' } },
      { path: 'vehicles/:id', component: v('VehicleDetail'), meta: { title: 'Vehicle Details' } },
      { path: 'pickups', component: v('Pickups'), meta: { title: 'Pump-outs' } },
      { path: 'pickups/:id', component: v('PickupDetail'), meta: { title: 'Pump-out Details' } },
      { path: 'transfers', component: v('Transfers'), meta: { title: 'Transfers' } },
      { path: 'unloads', component: v('Unloads'), meta: { title: 'Unloads' } },
      { path: 'trace', component: v('Trace'), meta: { title: 'Waste Tracking' } },
      { path: 'facilities', component: v('Facilities'), meta: { title: 'Facilities' } },
      { path: 'facilities/:id', component: v('FacilityDetail'), meta: { title: 'Facility Details' } }
    ]
  }
]

const router = createRouter({ history: createWebHashHistory(), routes })
router.beforeEach(async (to) => {
  if (to.meta.public) return
  const login = { path: '/login', query: { redirect: to.fullPath } }
  if (!isSignedIn()) return login
  if (!isLoaded()) await loadState().catch(() => login)
  if (!isLoaded()) return login
  refreshUser()
  if (to.meta.perm && !can(to.meta.perm)) return '/dashboard'
})
export default router
