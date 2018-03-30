# 高举 Vue-SSR

> 将同一个组件渲染为服务器端的 HTML 字符串，将它们直接发送到浏览器，最后将静态标记"混合"为客户端上完全交互的应用程序。
---
## SSR的目的

To solve

- 首屏渲染问题

- SEO问题
---
## 项目结构

```
vue-ssr
├── build                 (webapck编译配置)
├── components            (vue 页面) 
├── dist                  (编译后的静态资源目录)
├── api.js                (请求接口，模拟异步请求)
├── app.js                (创建Vue实例入口)
├── App.vue               (Vue页面入口)
├── entry-client.js       (前端执行入口)
├── entry-server.js       (后端执行入口)
├── index.template.html   (前端渲染模板)
├── router.js             (Vue路由配置)
├── server.js             (Koa服务)
├── store.js              (Vuex数据状态中心配置)
```
---
## 原理概览

![vue-ssr](./docs/786a415a-5fee-11e6-9c11-45a2cfdf085c.png)


这张图相信很多大佬们都看过N遍了，每个人理解不同，我发表一下自己个人的理解，如果有什么理解错误请原谅我。

先看Source部分，Source部分先由app.js引入Vue全家桶，至于Vue全家桶如何配置后面会说明。app.js其实就是创建一个注册好各种依赖的Vue对象实例，在SPA单页环境下，我们只需要拿到这个Vue实例，然后指定挂载到模板特定的dom结点，然后丢给webpack处理就完事了。但是SSR在此分为两部分，一部分是前端单页，一部分是后端直出。于是，Client entry的作用是挂载Vue对象实例，并由webpack进行编译打包，最后在浏览器渲染。Server entry的作用是拿到Vue对象实例，并处理收集页面中的asynData，获取对应的数据上下文，然后再由webpack解析处理。最后Node Server端中使用weback编译好的两个bundle文件( 服务器需要「服务器 bundle」然后用于服务器端渲染(SSR)，而「客户端 bundle」会发送给浏览器，用于混合静态标记。)，当用户请求页面时候，这时候服务端会先使用SSR来生成对应的页面文档结构，而在用户切换路由则是使用了SPA的模式。

---

## 搭建环境

### 项目依赖说明

Koa2 + Vue2 +  Vue-router + Vuex

### 一切都从路由开始

先来配置vue-router, 生成router.js

```js
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
```
为每个请求创建一个新的Vue实例，路由也是如此，通过一个工厂函数来保证每次都是新创建一个Vue路由的新实例。

### Vuex 配置

配置Vuex, 生成store.js

```js
import Vue from 'vue'
import Vuex from 'vuex'
import { fetchItem } from './api'

Vue.use(Vuex)

export const createStore = () => {
  return new Vuex.Store({
    state: {
      items: {}
    },
    actions: {
      fetchItem ({ commit }, id) {
        return fetchItem(id).then(item => {
          commit('setItem', { id, item })
        })
      }
    },
    mutations: {
      setItem (state, { id, item }) {
        Vue.set(state.items, id, item)
      }
    }
  })
}
```

同样也是通过一个工厂函数，来创建一个新的Vuex实例并暴露该方法

### 生成一个Vue的根实例

创建Vue实例，生成app.js

```js
import Vue from 'vue'
import App from './App.vue'
import { createRouter } from './router'
import { createStore } from './store'
import { sync } from 'vuex-router-sync'

export const createApp = ssrContext => {
  const router = createRouter()
  const store = createStore()

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
```

通过使用我们编写的createRouter, createStore来每次都创建新的Vue-router和Vuex实例，保证和Vue的实例一样都是重新创建过的，接着挂载注册router和store到Vue的实例中，提供createApp传入服务端渲染对应的数据上下文。


到此我们已经基本完成source部分的工作了。接着就要考虑如何去编译打包这些文件，让浏览器和Node服务端去运行解析。

### 先从前端入口文件开始

前端打包入口文件: entry-client.js

```js
import { createApp } from './app'

const { 
  app, 
  store,
  router 
} = createApp()
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__)
}

router.onReady(() => {
  router.beforeResolve((to, from, next) => {
    const matched = router.getMatchedComponents(to)
    const prevMatched = router.getMatchedComponents(from)
    let diffed = false
    const activated = matched.filter((c, i) => {
      return diffed || (diffed = (prevMatched[i] !== c))
    })
    if (!activated.length) {
      return next()
    }
    Promise.all(activated.map(c => {
      if (c.asyncData) {
        return c.asyncData({ store, route: to })
      }
    })).then(() => {
      next()
    }).catch(next)
  })
  app.$mount('#app')
})
```

客户端的entry只需创建应用程序，并且将其挂载到 DOM 中， 需要注意的是，任然需要在挂载 app 之前调用 router.onReady，因为路由器必须要提前解析路由配置中的异步组件，(如果你有使用异步组件的话，本项目没有使用到异步组件，但后续考虑加入) 才能正确地调用组件中可能存在的路由钩子。通过添加路由钩子函数，用于处理 asyncData，在初始路由 resolve 后执行，以便我们不会二次预取(double-fetch)已有的数据。使用 `router.beforeResolve()`，以便确保所有异步组件都 resolve，并对比之前没有渲染的组件找出两个匹配列表的差异组件，如果没有差异表示无需处理直接next输出。

### 再看服务端渲染解析入口文件

服务端渲染的执行入口文件: entry-server.js

```js
import { createApp } from './app'

export default context => {
  return new Promise((resolve, reject) => {
    const { 
      app, 
      store,
      router 
    } = createApp(context)

    router.push(context.url)

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents()
      if (!matchedComponents.length) {
        return reject({ code: 404 })
      }

      Promise.all(matchedComponents.map(Component => {
        if (Component.asyncData) {
          return Component.asyncData({
            store,
            route: router.currentRoute
          })
        }
      })).then(() => {
        context.state = store.state
        resolve(app)
      }).catch(reject)
    }, reject)
  })
}
```

服务器 entry 使用 default export 导出函数，并在每次渲染中重复调用此函数。此时，创建和返回应用程序实例之外，还在此执行服务器端路由匹配(server-side route matching)和数据预取逻辑(data pre-fetching logic)。在所有预取钩子(preFetch hook) resolve 后，我们的 store 现在已经填充入渲染应用程序所需的状态。当我们将状态附加到上下文，并且 `template` 选项用于 renderer 时，状态将自动序列化为 `window.__INITIAL_STATE__`，并注入 HTML。

### 激动人心的来写webpack

直接上手weback4.x版本

webpack配置分为3个配置，公用配置，客户端配置，服务端配置。

三个配置文件以此如下：

base config:

```js
const path = require('path')
const webpack = require('webpack')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = {
  devtool: '#cheap-module-source-map',
  output: {
    path: path.resolve(__dirname, '../dist'),
    publicPath: '/',
    filename: '[name]-[chunkhash].js'
  },
  resolve: {
    alias: {
      'public': path.resolve(__dirname, '../public'),
      'components': path.resolve(__dirname, '../components')
    },
    extensions: ['.js', '.vue']
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader'
        }
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: 'css-loader'
      }
    ]
  },
  performance: {
    maxEntrypointSize: 300000,
    hints: 'warning'
  },
  plugins: [
    new ExtractTextPlugin({
      filename: 'common.[chunkhash].css'
    })
  ]
}
```

改配置只是简单的配置vue, css, babel等loader的使用，接着ExtractTextPlugin提取css资源文件，指定输出的目录，而入口文件则分别在client和server的config中配置。

client config

```js
const webpack = require('webpack')
const merge = require('webpack-merge')
const path = require('path')
const baseConfig = require('./webpack.base.config.js')
const VueSSRClientPlugin = require('vue-server-renderer/client-plugin')


module.exports = merge(baseConfig, {
  entry: path.resolve(__dirname, '../entry-client.js'),
  plugins: [
    new VueSSRClientPlugin()
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          chunks: 'initial',
          minChunks: 2, maxInitialRequests: 5,
          minSize: 0
        },
        vendor: {
          test: /node_modules/,
          chunks: 'initial',
          name: 'vendor',
          priority: 10,
          enforce: true
        }
      }
    },
    runtimeChunk: true
  }
})
```

客户端的入口文件，使用VueSSRClientPlugin生成对应的vue-ssr-client-manifest.json的映射文件，然后添加vendor的chunk分离。

server config

```js
const merge = require('webpack-merge')
const path = require('path')
const nodeExternals = require('webpack-node-externals')
const baseConfig = require('./webpack.base.config.js')
const VueSSRServerPlugin = require('vue-server-renderer/server-plugin')


module.exports = merge(baseConfig, {
  // 将 entry 指向应用程序的 server entry 文件
  entry: path.resolve(__dirname, '../entry-server.js'),
  // 允许 webpack Node 适用方式(Node-appropriate fashion)处理动态导入(dynamic import)，
  target: 'node',
  // 提供 source map 支持
  devtool: 'source-map',
  // 使用 Node 风格导出模块(Node-style exports)
  output: {
    filename: 'server-bundle.js',
    libraryTarget: 'commonjs2'
  },
  externals: nodeExternals({
    // 不要外置化 webpack 需要处理的依赖模块。
    // 你可以在这里添加更多的文件类型。例如，未处理 *.vue 原始文件，
    // 你还应该将修改 `global`（例如 polyfill）的依赖模块列入白名单
    whitelist: /\.css$/
  }),
  // 这是将服务器的整个输出
  // 构建为单个 JSON 文件的插件。
  // 默认文件名为 `vue-ssr-server-bundle.json`
  plugins: [
    new VueSSRServerPlugin()
  ]
})
```

到此打包的流程已经结束了，server端配置参考了官网的注释。

### 使用Koa2

```js
const { createBundleRenderer } = require('vue-server-renderer')
const serverBundle = require('./dist/vue-ssr-server-bundle.json')
const clientManifest = require('./dist/vue-ssr-client-manifest.json')
const fs = require('fs')
const path = require('path')

const Koa = require('koa')
const KoaRuoter = require('koa-router')
const serve = require('koa-static')

const app = new Koa()
const router = new KoaRuoter()

const template = fs.readFileSync(path.resolve('./index.template.html'), 'utf-8')

const renderer = createBundleRenderer(serverBundle, {
  // 推荐
  runInNewContext: false,
  // （可选）页面模板
  template, 
  // （可选）客户端构建 manifest
  clientManifest 
})

app.use(serve(path.resolve(__dirname, './dist')))

router.get('*', (ctx, next) => {
  ctx.set('Content-Type', 'text/html')
  return new Promise((resolve, reject) => {
    const handleError = err => {
      if (err && err.code === 404) {
          ctx.status = 404
          ctx.body = '404 | Page Not Found'
      } else {
          ctx.status = 500
          ctx.body = '500 | Internal Server Error'
          console.error(`error during render : ${ctx.url}`)
          console.error(err.stack)
      }
      resolve()
    }
    console.log(ctx.url)
    const context = { url: ctx.url, title: 'Vue SSR' }
  
    // 这里无需传入一个应用程序，因为在执行 bundle 时已经自动创建过。
    // 现在我们的服务器与应用程序已经解耦！
    renderer.renderToString(context, (err, html) => {
      // 处理异常……
      if (err) {
        handleError(err)
      }
      ctx.body = html
      resolve()
    })
  })
})

app.use(router.routes()).use(router.allowedMethods())

const port = 3000
app.listen(port, '127.0.0.1', () => {
    console.log(`server running at localhost:${port}`)
})
```

最后效果当然是这样的了:

![预览](/docs/20180330213059.png)

参考文档:

[vue-ssr官方文档](https://ssr.vuejs.org/zh/, "vue-ssr官方文档")

代码仓库:

[github链接](https://github.com/lgybetter/vue-ssr-template, "github 链接")