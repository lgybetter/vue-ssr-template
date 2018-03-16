/**
 * 我们的服务器代码使用了一个 * 处理程序，它接受任意 URL。
 * 这允许我们将访问的 URL 传递到我们的 Vue 应用程序中，
 * 然后对客户端和服务器复用相同的路由配置！
 */

import Vue from 'vue'
import Router from 'vue-router'

import Bar from './components/Bar.vue'
import Baz from './components/Baz.vue'
import Foo from './components/Foo.vue'
import Item from './components/Item.vue'
Vue.use(Router)

export const createRouter = () => {
  return new Router({
    mode: 'history',
    routes: [
      { path: '/item/:id', component: Item },
      { path: '/bar', component: Bar },
      { path: '/baz', component: Baz },
      { path: '/foo', component: Foo }
    ]
  })
}