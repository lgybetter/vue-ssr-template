export const fetchItem = (id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({
        title: 'Vuex'
      })
    }, 1000)
  })
}