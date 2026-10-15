import { ElMessageBox } from 'element-plus'
import { isActive, setAlertStatus } from './alerts'
import { logEntityChange } from './db'

export async function requestReason(title) {
  try {
    const { value } = await ElMessageBox.prompt('Reason (required)', title, {
      inputType: 'textarea', inputValidator: (v) => !!v?.trim() || 'Please enter a reason',
      confirmButtonText: title
    })
    return value.trim()
  } catch { return null }
}

export async function clearWarnings(kind, id, warnings) {
  const active = warnings.filter(isActive)
  if (!active.length) return
  const reason = await requestReason('Clear warnings')
  if (reason === null) return
  for (const a of active) setAlertStatus(a.alertId, 'cleared', reason)
  logEntityChange(kind, id, 'Warnings cleared', `${active.length} active`, reason)
}
