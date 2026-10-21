<template>
  <div class="login">
    <LoginScene />
    <div class="shade"></div>
    <div class="hero">
      <div class="logo"><span class="mark"><BrandLogo :size="30" /></span><div>{{ BRAND.name }}<small>{{ BRAND.tagline }}</small></div></div>
      <h1>Track every litre of liquid waste —<br />from grease trap to treatment.</h1>
      <p>QR-tagged devices, GPS-verified pump-outs and full chain-of-custody for transfers and unloads — in one place for trade waste compliance.</p>
      <div class="steps">
        <div v-for="(s, i) in STEPS" :key="s.t" class="step">
          <span class="dot" :style="{ background: s.c }"><el-icon><component :is="s.i" /></el-icon></span>
          <div><b>{{ s.t }}</b><small>{{ s.d }}</small></div>
          <span v-if="i < STEPS.length - 1" class="arrow">→</span>
        </div>
      </div>
      <div class="figures">
        <div><b>{{ stats.devices.toLocaleString() }}</b><span>devices</span></div>
        <div><b>{{ stats.companies }}</b><span>licensed transport companies</span></div>
        <div><b>{{ stats.facilities }}</b><span>treatment facilities</span></div>
      </div>
    </div>

    <div class="box">
      <h2>Sign in</h2>
      <p class="muted">{{ BRAND.console }} · Liquid Waste Tracking</p>
      <el-form :model="form" @submit.prevent="submit" label-position="top" size="large">
        <el-form-item label="Username"><el-input v-model="form.user" :prefix-icon="'User'" /></el-form-item>
        <el-form-item label="Password"><el-input v-model="form.pass" type="password" show-password :prefix-icon="'Lock'" /></el-form-item>
        <el-button type="primary" native-type="submit" class="submit">Sign in</el-button>
      </el-form>
      <el-button link type="primary" class="forgot" @click="forgot">Forgot password?</el-button>
      <p class="muted tip">Demo accounts: admin / admin123 (Admin) · ops01 / ops123 (Operations) · user01 / user123 (User)</p>
    </div>
    <div class="foot">Prototype · Queensland demo data</div>
  </div>
</template>
<script setup>
import { reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import LoginScene from '../components/LoginScene.vue'
import BrandLogo from '../components/BrandLogo.vue'
import { api, login } from '../store/api'
import { BRAND } from '../brand'

const STEPS = [
  { t: 'Scan', d: 'Device QR', i: 'FullScreen', c: '#f0a020' },
  { t: 'Pump-out', d: 'GPS + volume', i: 'Odometer', c: '#18a58a' },
  { t: 'Transfer', d: 'Truck to truck', i: 'Van', c: '#3fb1e3' },
  { t: 'Unload', d: 'At facility', i: 'OfficeBuilding', c: '#8e5bd8' }
]
const form = reactive({ user: 'admin', pass: 'admin123' })
const router = useRouter()
const route = useRoute()
const stats = reactive({ devices: 0, companies: 0, facilities: 0 })
onMounted(() => api('/public/stats').then((s) => Object.assign(stats, s)).catch(() => {}))
async function submit() {
  if (!form.user.trim() || !form.pass) return ElMessage.warning('Enter your username and password')
  try {
    await login(form.user.trim(), form.pass)
  } catch (e) {
    return ElMessage.error(e.message)
  }
  router.push(route.query.redirect || '/dashboard')
}
// Old WasteID "Forgot Password?": the server emails a one-time link if the account has an email address.
async function forgot() {
  let value
  try {
    ({ value } = await ElMessageBox.prompt('Enter your username or email address. A reset link will be sent to the email address on your account.',
      'Reset password', { confirmButtonText: 'Send link', inputValue: form.user.trim(), inputValidator: (v) => !!v?.trim() || 'Required' }))
  } catch {
    return
  }
  try {
    await api('/password/forgot', { login: value.trim() })
    ElMessage.success({ message: 'If that account has an email address, a reset link is on its way. It works for one hour.', duration: 6000 })
  } catch (e) {
    ElMessage.error(e.message)
  }
}
</script>
<style scoped>
.forgot { display: block; margin: 10px auto 0; }
.login { position: relative; height: 100%; min-height: 600px; overflow: hidden; background: #071526; color: #fff; }
.shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4,14,26,.75) 0%, rgba(4,14,26,.35) 45%, rgba(4,14,26,0) 70%); pointer-events: none; }
.hero { position: absolute; left: 6vw; top: 9vh; max-width: 640px; }
.logo { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 800; letter-spacing: .5px; }
.logo small { display: block; font-size: 12px; font-weight: 500; color: #9fc0cc; letter-spacing: .3px; }
.mark { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center; }
h1 { font-size: 32px; line-height: 1.25; margin: 28px 0 12px; font-weight: 700; }
.hero p { color: #b9d3dc; font-size: 15px; line-height: 1.6; margin: 0 0 22px; }
.steps { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.step { display: flex; align-items: center; gap: 8px; }
.step .dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.step b { display: block; font-size: 13px; } .step small { color: #9fc0cc; font-size: 11px; }
.arrow { color: #6fe3c6; margin: 0 4px; }
.figures { display: flex; gap: 28px; margin-top: 26px; }
.figures b { display: block; font-size: 24px; } .figures span { color: #9fc0cc; font-size: 12px; }
.box { position: absolute; right: 7vw; top: 50%; transform: translateY(-50%); width: 360px; background: rgba(255,255,255,.96); color: #1f2d3d; border-radius: 14px; padding: 34px 32px 26px; box-shadow: 0 24px 60px rgba(0,0,0,.45); backdrop-filter: blur(6px); }
h2 { margin: 0; font-size: 24px; }
.submit { width: 100%; margin-top: 6px; background: linear-gradient(135deg, #18a58a, #0f7d68); border: none; }
.tip { font-size: 12px; text-align: center; margin-top: 16px; line-height: 1.6; }
.foot { position: absolute; left: 6vw; bottom: 18px; font-size: 12px; color: rgba(255,255,255,.45); }
@media (max-width: 1100px) { .hero { display: none; } .box { right: 50%; transform: translate(50%, -50%); } }
</style>
