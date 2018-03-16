<template>
  <div id="app">
    <h1 @click="handleClick">vue ssr</h1>
    <router-link to="/bar">Bar</router-link><br>
    <router-link to="/baz">Bar</router-link><br>
    <router-link to="/foo">Foo</router-link><br>
    <router-link to="/item/1">Item</router-link><br>
    <router-view></router-view>
  </div>
</template>


<script>
export default {
  methods: {
    handleClick () {
      console.log('click')
    }
  }
}
</script>