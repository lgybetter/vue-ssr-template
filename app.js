/**
 * app.js 是我们应用程序的「通用 entry」。
 * 在纯客户端应用程序中，我们将在此文件中创建根 Vue 实例，
 * 并直接挂载到 DOM。但是，对于服务器端渲染(SSR)，
 * 责任转移到纯客户端 entry 文件。app.js 简单地使用 
 * export 导出一个 createApp 函数：
 */

import Vue from 'vue'
import App from './App.vue'
import { createRouter } from './router'
import { createStore } from './store'
import { sync } from 'vuex-router-sync'


// 导出一个工厂函数，用于创建新的
// 应用程序、router 和 store 实例

export const createApp = ssrContext => {
  const router = createRouter()
  const store = createStore()

  // 同步路由状态(route state)到 store
  sync(store, router)

  const app = new Vue({
    router,
    store,
    ssrContext,
    render: h => h(App)
  })
  return { 
    app, 
    store, 
    router 
  }
}