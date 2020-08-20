const users = JSON.parse(localStorage.getItem('users'))
const username = localStorage.getItem('username')
const password = localStorage.getItem('password')
const token = localStorage.getItem('token')
const user = {
  namespaced: true,
  state: () => ({
    username: username || null,
    password: password || null,
    token: token || null,
    users: users || []
  }),

  getters: {
    isLogin: (state) => {
      return !!state.username && !!state.token
    },
    currentUser: (state) => {
      return state.users.find((u) => u.username === state.username)
    },
    isAGActive: (state) => {
      const user = state.users.find((u) => u.username === state.username)
      return !!user && user.agRecharge === 1 && !!user.agExpiredTime
    },
    isBBINActive: (state) => {
      const user = state.users.find((u) => u.username === state.username)
      return !!user && user.bbinRecharge === 1 && !!user.bbinExpiredTime
    },
    isRMActive: (state) => {
      const user = state.users.find((u) => u.username === state.username)
      return !!user && user.rmRecharge === 1 && !!user.rmExpiredTime
    }
  },

  mutations: {
    ADD_USERNAME: (state, payload) => {
      state.username = payload
      localStorage.setItem('username', state.username)
    },
    ADD_PASSWORD: (state, password) => {
      state.password = password
      localStorage.setItem('password', state.password)
    },
    ADD_TOKEN: (state, token) => {
      state.token = token
      localStorage.setItem('token', state.token)
    },
    LOGOUT: (state) => {
      state.username = null
      state.token = null
      localStorage.removeItem('username')
      localStorage.removeItem('token')
    },
    ADD_USER: (state, user) => {
      if (state.users.length) {
        const i = state.users.findIndex((u) => u.userId === user.userId)
        if (i !== -1) {
          state.users.splice(i, 1, user)
          localStorage.setItem('users', JSON.stringify(state.users))
        } else {
          state.users.push(user)
          localStorage.setItem('users', JSON.stringify(state.users))
        }
      } else {
        state.users.push(user)
        localStorage.setItem('users', JSON.stringify(state.users))
      }
    },
    UPDATE_USER: (state, user) => {
      const index = state.users.findIndex((u) => u.userId === user.userId)
      state.users.splice(index, 1, user)
      localStorage.setItem('users', JSON.stringify(state.users))
    }
  },

  actions: {
    addUsername({ commit }, payload) {
      commit('ADD_USERNAME', payload)
    },
    addPassword({ commit }, password) {
      commit('ADD_PASSWORD', password)
    },
    addToken({ commit }, payload) {
      commit('ADD_TOKEN', payload)
    },
    logoutActions({ commit }) {
      commit('LOGOUT')
    },
    addUser({ commit }, user) {
      commit('ADD_USER', user)
    },
    updateUser({ commit }, user) {
      commit('UPDATE_USER', user)
    }
  }
}

export default user
