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