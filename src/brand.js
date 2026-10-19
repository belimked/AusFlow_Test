export const BRAND = {
  name: 'AusFlow Water',
  tagline: 'Liquid Trade Waste Services',
  console: 'Trade Waste Console'
}

// UAT WasteID links to the UAT TWAIN instance.
export const TWAIN_URL = location.hostname.startsWith('uat.') ? 'https://twain-uat.saulxj.ggff.net' : 'https://twain.saulxj.ggff.net'
