<template>
  <div class="reset">
    <div class="box">
      <div class="logo"><BrandLogo :size="26" /><b>{{ BRAND.name }}</b></div>
      <template v-if="done">
        <h2>Password changed</h2>
        <p class="muted">Sign in with your new password, on the web or in the driver app.</p>
        <el-button type="primary" class="submit" size="large" @click="router.push('/login')">Go to sign in</el-button>
      </template>
      <template v-else-if="!token">
        <h2>Link incomplete</h2>
        <p class="muted">Open the link from the reset email again, or ask for a new one from the sign-in page.</p>
        <el-button class="submit" size="large" @click="router.push('/login')">Back to sign in</el-button>
      </template>
      <template v-else>
        <h2>Choose a new password</h2>
        <p class="muted">At least 6 characters. The link works once, for one hour.</p>
        <el-form :model="form" label-position="top" size="large" @submit.prevent="submit">
          <el-form-item label="New password"><el-input v-model="form.pass" type="password" show-password :prefix-icon="'Lock'" /></el-form-item>
          <el-form-item label="Repeat new password"><el-input v-model="form.again" type="password" show-password :prefix-icon="'Lock'" /></el-form-item>
          <el-button type="primary" native-type="submit" class="submit" :loading="busy">Change password</el-button>
        </el-form>
      </template>
    </div>
  </div>
</template>
<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BrandLogo from '../components/BrandLogo.vue'
import { api } from '../store/api'
import { BRAND } from '../brand'

// Opened from the reset email (POST /password/forgot): #/reset-password?token=…
const route = useRoute()
const router = useRouter()
const token = String(route.query.token || '')
const form = reactive({ pass: '', again: '' })
const busy = ref(false)
const done = ref(false)

async function submit() {
  if (form.pass.length < 6) return ElMessage.warning('Password must be at least 6 characters')
  if (form.pass !== form.again) return ElMessage.warning('The two passwords do not match')
  busy.value = true
  try {
    await api('/password/reset', { token, password: form.pass })
    done.value = true
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    busy.value = false
  }
}
</script>
<style scoped>
.reset { height: 100%; min-height: 600px; display: flex; align-items: center; justify-content: center; background: #071526; }
.box { width: 360px; background: #fff; color: #1f2d3d; border-radius: 14px; padding: 30px 32px 26px; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
.logo { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; color: #0f7d68; }
h2 { margin: 0 0 6px; font-size: 22px; }
.submit { width: 100%; margin-top: 6px; }
</style>
