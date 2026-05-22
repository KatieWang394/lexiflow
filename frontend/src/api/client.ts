/**
 * axios 实例
 * ==========
 * 整个项目唯一的 HTTP 客户端配置。
 * 所有 API 请求都通过这个实例发出，不要在其他地方直接 import axios。
 *
 * baseURL 优先读取环境变量 VITE_API_BASE_URL，
 * 未配置时回退到本地开发地址 http://localhost:8000。
 */

import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
