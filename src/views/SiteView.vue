<template>
  <v-app>
    <Footer />
    <v-app-bar app dense title style="-webkit-app-region: drag; -webkit-user-select: none;">
      <v-btn icon class="btn" @click="back">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <v-btn icon class="btn" @click="forward">
        <v-icon>mdi-arrow-right</v-icon>
      </v-btn>
      <v-btn icon class="btn" @click="refresh">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
      <v-toolbar-title>在标签中登录: {{ scheme.gameType }}</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon class="btn" @click="min">
        <v-icon>mdi-minus</v-icon>
      </v-btn>
      <v-btn icon class="btn" @click="max">
        <v-icon>{{ isMax ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
      </v-btn>
      <v-btn icon class="btn" @click="close">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-app-bar>
    <v-main>
      <v-card height="100%">
        <v-card-text>
          <v-list flat subheader>
            <v-list-item v-for="item in scheme.sites" :key="item.siteId" dense>
              <v-list-item-content>{{ item.name }}</v-list-item-content>
              <v-list-item-content>
                {{
                  currentAGInfo.length
                    ? currentAGInfo.find((a) => a.siteId === item.siteId)
                      ? '已登录'
                      : '未登录'
                    : '未登录'
                }}
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-tabs v-model="tab" align-with-title show-arrows>
          <v-tabs-slider color="primary"></v-tabs-slider>
          <v-tab v-for="item in scheme.sites" :key="item.siteId">
            <template class="red--text">
              {{ item.name }}
            </template>
          </v-tab>
        </v-tabs>
        <v-tabs-items v-model="tab">
          <v-tab-item v-for="item in scheme.sites" :key="item.siteId">
            <v-card flat height="100%">
              <webview
                :src="item.url"
                class="fill-height"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36"
              />
            </v-card>
          </v-tab-item>
        </v-tabs-items>
      </v-card>
      <v-dialog v-model="loginSuccessDialog" persistent max-width="300">
        <v-card height="100%">
          <v-card-title class="align-center">该方案所有{{ scheme.gameType }}登陆成功</v-card-title>
          <v-card-actions>
            <v-spacer />
            <v-btn class="ma-4" color="primary" @click="loginSuccessDialog = false">
              返回
            </v-btn>
            <v-btn class="ma-4" color="error" @click="close">
              关闭登陆窗口
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </v-app>
</template>
<script>
import _ from 'lodash'
import { min, max, unmax, close, ismax } from '@/utils/renderer'
const { remote, ipcRenderer } = window.require('electron')

export default {
  data: () => ({
    scheme: {},
    gameInfo: {
      schemeId: null,
      agInfo: []
    },
    currentAGInfo: [],
    tab: null,
    currentWebview: null,
    isMax: false,
    loginSuccessDialog: false
  }),
  computed: {},
  watch: {
    tab: {
      immediate: true,
      handler() {
        setTimeout(() => {
          let webview = ''
          let siteId = ''
          for (let i = 0; i < this.scheme.sites.length; i++) {
            if (this.tab === i) {
              const webviews = document.getElementsByTagName('webview')
              webview = webviews[this.tab]
              siteId = this.scheme.sites[i].siteId
            }
          }
          this.currentWebview = webview
        })
      }
    },
    currentWebview() {
      const index = this.tab
      // 配置DOM L3 级别事件，监听DOM SCR属性变化
      const config = { attributes: true }
      const callback = (mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            // AG正则
            const regAG = /^https:\/\/.*\/agingame\/.*\/(index\.jsp\?)$/
            if (regAG.test(this.currentWebview.src)) {
              const agInfo = {
                siteId: null,
                urlList: [],
                loginName: null,
                password: null,
                isTrial: null
              }
              const webContents = remote.webContents.fromId(this.currentWebview.getWebContentsId())
              try {
                if (!webContents.debugger.isAttached()) webContents.debugger.attach('1.1')
              } catch (err) {
                // console.log('Debugger attach failed : ', err)
              }
              webContents.debugger.on('detach', (event, reason) => {
                // console.log('Debugger detached due to : ', reason)
              })
              webContents.debugger.on('message', (event, method, params) => {
                // 获取AG配置信息
                if (method === 'Network.webSocketCreated') {
                  // 获取URL
                  const regAGURL = /(\w+):\/\/([^/:]+)/
                  const url = params.url.match(regAGURL)[0]

                  if (!agInfo.urlList.includes(url)) agInfo.urlList.push(url)
                  // 大厅URL 只发送一次请求
                  const regAGPlaza = /\s*(5000\/$)/
                  if (regAGPlaza.test(params.url)) {
                    webContents.debugger
                      .sendCommand('Runtime.evaluate', {
                        expression: 'Core.LoginStore._instance.loginName',
                        awaitPromise: true
                      })
                      .then((res) => {
                        if (res.result.value) agInfo.loginName = res.result.value
                      })
                    webContents.debugger
                      .sendCommand('Runtime.evaluate', {
                        expression: 'Core.LoginStore._instance.password',
                        awaitPromise: true
                      })
                      .then((res) => {
                        if (res.result.value) agInfo.password = res.result.value
                      })
                    webContents.debugger
                      .sendCommand('Runtime.evaluate', {
                        expression: 'Core.LoginStore.instance.isDemoAc',
                        awaitPromise: true
                      })
                      .then((res) => {
                        if (res.result.value) agInfo.isTrial = res.result.value
                      })
                    webContents.debugger
                      .sendCommand('Runtime.evaluate', {
                        expression: 'Core.ExternalData.version_seq',
                        awaitPromise: true
                      })
                      .then((res) => {
                        if (res.result.value) agInfo.version_seq = res.result.value
                      })
                    this.gameInfo.schemeId = this.scheme.schemeId
                    agInfo.siteId = this.scheme.sites[index].siteId
                    if (this.gameInfo.agInfo.length) {
                      const siteIndex = this.gameInfo.agInfo.findIndex((a) => a.siteId === agInfo.siteId)
                      if (siteIndex > -1) {
                        const sameSite = this.gameInfo.agInfo[siteIndex]
                        if (sameSite.loginName !== agInfo.loginName) {
                          sameSite.loginName = agInfo.loginName
                        }
                        if (sameSite.password !== agInfo.password) {
                          sameSite.password = agInfo.password
                        }
                        if (sameSite.isTrial !== agInfo.isTrial) {
                          sameSite.isTrial = agInfo.isTrial
                        }
                        if (sameSite.version_seq !== agInfo.version_seq) {
                          sameSite.version_seq = agInfo.version_seq
                        }
                        if (sameSite.urlList !== agInfo.urlList) {
                          sameSite.urlList = agInfo.urlList
                        }
                      } else {
                        this.gameInfo.agInfo.push(agInfo)
                      }
                    } else {
                      this.gameInfo.agInfo.push(agInfo)
                    }
                    this.currentAGInfo = this.gameInfo.agInfo
                  }
                }
              })
              webContents.debugger.sendCommand('Network.enable')
              webContents.debugger.sendCommand('Runtime.enable')
            }
          }
        }
      }
      const observer = new MutationObserver(callback)
      observer.observe(this.currentWebview, config)
    },
    currentAGInfo() {
      setTimeout(() => {
        let hasValue = true
        this.currentAGInfo.map((a) => {
          for (const key in a) {
            if (!a[key]) hasValue = false
          }
        })
        if (hasValue) {
          if (this.currentAGInfo.length === this.scheme.sites.length) {
            this.loginSuccessDialog = true
            ipcRenderer.send('gameInfo', JSON.stringify(this.gameInfo))
          }
        }
      }, 2000)
    }
  },
  created() {
    this.info = []
    this.scheme = remote.getGlobal('scheme').scheme
  },
  mounted() {
    window.onresize = () => {
      this.isMax = ismax()
    }
  },

  methods: {
    min() {
      min()
    },
    max() {
      this.isMax ? unmax() : max()
    },
    back() {
      this.currentWebview.goBack()
    },
    close() {
      remote.getCurrentWindow().destroy()
    },
    refresh() {
      this.currentWebview.reload()
    },
    forward() {
      this.currentWebview.goForward()
    }
  }
}
</script>
<style lang="scss" scoped>
.btn {
  -webkit-app-region: no-drag;
}
.v-window,
.v-window__container,
.v-window-item {
  height: 100%;
}
</style>
