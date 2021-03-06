<template>
  <v-app>
    <Header />
    <Side />
    <Footer />
    <v-main>
      <v-card height="100%" flat>
        <template v-if="operationList.length">
          <v-tabs v-model="tab" show-arrows background-color="primary">
            <v-tab v-for="scheme in operationList" :key="scheme.schemeId">
              {{ scheme.schemeName }}
            </v-tab>
          </v-tabs>
          <v-tabs-items v-model="tab">
            <v-tab-item v-for="scheme in operationList" :key="scheme.schemeId">
              <v-card-text class="pa-0 ma-0">
                <v-card-actions>
                  <v-btn color="error" :disabled="!scheme.isAllConnect" @click="stopScheme(scheme.schemeId)">
                    停止运行
                  </v-btn>
                  <v-card-text class="red--text font-weight-black">
                    {{ `止水金额：${scheme.totalLiushui}` }}
                  </v-card-text>
                  <v-card-text v-if="!scheme.isAllConnect" class="red--text font-weight-black">
                    游戏房间连接中，勿动
                  </v-card-text>
                </v-card-actions>
                <v-card flat>
                  <v-card-text>
                    <v-card :height="currentHeight - 220" flat>
                      <table>
                        <thead>
                          <tr v-for="(site, i) in currentScheme.sites" :key="i">
                            <th class="red--text font-weight-black">
                              {{
                                `网站：${site.name}——余额：${
                                  site.balance === undefined ? '读取中...' : site.balance
                                }——当前流水：${site.amount === undefined ? '读取中...' : site.amount}`
                              }}
                            </th>
                          </tr>
                        </thead>
                        <tbody
                          style="overflow: auto; display: block;"
                          :style="{ height: `${currentHeight - currentHeadHeight - 270}px` }"
                        >
                          <tr v-for="(log, i) in currentWebSocketLog(scheme.schemeId)" :key="i">
                            <td>{{ log.msg }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </v-card>
                  </v-card-text>
                </v-card>
              </v-card-text>
            </v-tab-item>
          </v-tabs-items>
        </template>
        <template v-else>
          <v-card height="100%" class="d-flex text-center justify-center">
            <v-card-title>
              当前没有方案在运行
              <br />
              <br />
              去创建方案并点击运行
            </v-card-title>
          </v-card>
        </template>
      </v-card>
      <v-dialog v-model="stopSchemeDialog" persistent max-width="300">
        <v-card class="pa-2">
          <v-card-title class="text-center">
            确认停止执行该方案
          </v-card-title>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" @click="stopSchemeDialog = false">
              返回
            </v-btn>
            <v-btn color="error" @click="stop">
              停止运行
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-main>
  </v-app>
</template>
<script>
import moment from 'moment'
import * as cmd from '@/utils/ag/cmd'
import { loginRoom } from '@/utils/ag/room'
import Side from '@/components/main/Side'
import Header from '@/components/main/Header'
import Footer from '@/components/main/Footer'
import { mapState, mapActions, mapGetters } from 'vuex'
import { doSend } from '@/utils/ag/static/Cube-Socket-Live.v1943'
export default {
  name: 'SchemeOperation',
  components: {
    Header,
    Side,
    Footer
  },
  data: () => ({
    tab: null,
    schemes: [],
    currentHeight: null,
    currentHeadHeight: null,
    stopSchemeDialog: false,
    currentSchemeId: null,
    currentSchemeIndex: null,
    isConnect: [],
    currentGameCode: null,
    siteEven: [],
    siteOdd: []
  }),
  computed: {
    ...mapState('site', ['siteList']),
    ...mapState('gameInfo', ['gameInfo']),
    ...mapState('ag', ['config', 'webSocketLog']),
    ...mapState('scheme', ['schemeList', 'operationList']),
    ...mapGetters('scheme', ['currentOperation']),
    ...mapGetters('ag', ['currentWebSocketLog']),
    currentScheme() {
      return this.operationList[this.tab] || []
    }
  },
  watch: {
    $route: {
      immediate: true,
      handler(route) {
        if (Object.keys(route.params).length !== 0) {
          console.log('执行 watch $route')
          setTimeout(() => {
            const operation = this.operationList.find((o) => o.schemeId === route.params.schemeId)
            if (!operation) {
              this.addOperationScheme()
              this.socket()
            }
          })
        }
      }
    },
    isConnect() {
      console.log('执行 watch isConnect')
      if (this.currentScheme && this.currentScheme.sites.length === this.isConnect.length) {
        this.$set(this.currentScheme, 'isAllConnect', true)
        this.updateOperation(this.currentScheme)
      }
    },
    currentScheme: {
      handler() {
        console.log('执行 watch currentScheme')
        let amount
        if (this.currentScheme.sites && this.currentScheme.sites.length) {
          if (this.currentScheme.amountType === 3) {
            const site = this.currentScheme.sites.find((s) => {
              if ('specifyValue' in s) {
                return s.specifyValue[1] === 1
              }
            })
            amount = site ? site.amount : 0
          } else {
            amount = Math.min.apply(
              Math,
              this.currentScheme.sites.map((s) => {
                return s.amount
              })
            )
          }
        }
        if (amount !== 0 && amount >= this.currentScheme.totalLiushui) {
          setTimeout(() => {
            for (const site of this.currentScheme.sites) {
              this.addWebSocketLog({
                schemeId: this.currentScheme.schemeId,
                msg: '达到流水 关闭连接'
              })
              site.platformWebSocket.close()
              site.plazaWebSocket.close()
              site.roomWebSocket.close()
            }
          }, 3000)
        }
      },
      deep: true
    },
    currentGameCode: function (newVal, oldVal) {
      console.log('执行 watch currentGameCode')
      if (this.currentScheme.isAllConnect && newVal && newVal !== oldVal) {
        if (this.currentScheme.amountType === 1) {
          const arr = this.currentScheme.randomRange.split('*').map(Number)
          let amount = Math.floor(Math.random() * (arr[1] - arr[0])) + arr[0]
          amount = amount < 20 ? 20 : amount
          amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)

          const type = [1, 2]
          const type1 = type[Math.floor(Math.random() * type.length)]
          let type2
          type1 === 1 ? (type2 = 2) : (type2 = 1)

          const siteEven = this.currentScheme.sites.filter((s, i) => i % 2 === 0)
          const siteOdd = this.currentScheme.sites.filter((s, i) => i % 2 !== 0)

          siteEven.map((even) => {
            if (even.roomWebSocket && even.roomWebSocket.readyState === 1) {
              /*
              计算下注金额的临界值
              if (even.amount + amount >= this.currentScheme.totalLiushui) {
                amount = this.currentScheme.totalLiushui - even.amount
                amount = amount < 20 ? 20 : amount
                amount = amount % 10 === 0 ? amount + 10 : amount - (amount % 10)
              }
              */
              even.roomWebSocket.send(
                doSend(
                  cmd.gameBetExt(newVal, type1, amount),
                  even.socketId,
                  even.userEncryptKey,
                  even.userDecryptKey,
                  even.broadcastDecryptKey
                ).buffer
              )
              this.$set(even, 'amount', even.amount + amount)
              this.updateOperation(this.currentScheme)
              this.addWebSocketLog({
                schemeId: this.currentScheme.schemeId,
                msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${even.name}——房间：${
                  even.vid
                }，局号：${newVal}，下注：${type1 === 1 ? '庄' : '闲'}，金额：${amount}`
              })
            }
          })
          siteOdd.map((odd) => {
            if (odd.roomWebSocket && odd.roomWebSocket.readyState === 1) {
              /*
              计算下注金额的临界值
              if (odd.amount + amount >= this.currentScheme.totalLiushui) {
                amount = this.currentScheme.totalLiushui - odd.amount
                amount = amount < 20 ? 20 : amount
                amount = amount % 10 === 0 ? amount + 10 : amount - (amount % 10)
              }
              */
              odd.roomWebSocket.send(
                doSend(
                  cmd.gameBetExt(newVal, type2, amount),
                  odd.socketId,
                  odd.userEncryptKey,
                  odd.userDecryptKey,
                  odd.broadcastDecryptKey
                ).buffer
              )
              this.$set(odd, 'amount', odd.amount + amount)
              this.updateOperation(this.currentScheme)
              this.addWebSocketLog({
                schemeId: this.currentScheme.schemeId,
                msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${odd.name}——房间：${
                  odd.vid
                }，局号：${newVal}，下注：${type2 === 1 ? '庄' : '闲'}，金额：${amount}`
              })
            }
          })
        } else if (this.currentScheme.amountType === 2) {
          const arr = this.currentScheme.randomValue.split('*').map(Number)
          let amount = arr[Math.floor(Math.random() * arr.length)]
          amount = amount < 20 ? 20 : amount
          amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)

          const type = [1, 2]
          const type1 = type[Math.floor(Math.random() * type.length)]
          let type2
          type1 === 1 ? (type2 = 2) : (type2 = 1)

          const siteEven = this.currentScheme.sites.filter((s, i) => i % 2 === 0)
          const siteOdd = this.currentScheme.sites.filter((s, i) => i % 2 !== 0)

          siteEven.map((even) => {
            if (even.roomWebSocket && even.roomWebSocket.readyState === 1) {
              /*
              计算下注金额的临界值
              if (even.amount + amount >= this.currentScheme.totalLiushui) {
                amount = this.currentScheme.totalLiushui - even.amount
                amount = amount < 20 ? 20 : amount
                amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)
              }
              */
              even.roomWebSocket.send(
                doSend(
                  cmd.gameBetExt(newVal, type1, amount),
                  even.socketId,
                  even.userEncryptKey,
                  even.userDecryptKey,
                  even.broadcastDecryptKey
                ).buffer
              )
              this.$set(even, 'amount', even.amount + amount)
              this.updateOperation(this.currentScheme)
              this.addWebSocketLog({
                schemeId: this.currentScheme.schemeId,
                msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${even.name}——房间：${
                  even.vid
                }，局号：${newVal}，下注：${type1 === 1 ? '庄' : '闲'}，金额：${amount}`
              })
            }
          })
          siteOdd.map((odd) => {
            if (odd.roomWebSocket && odd.roomWebSocket.readyState === 1) {
              /*
              计算下注金额的临界值
              if (odd.amount + amount >= this.currentScheme.totalLiushui) {
                amount = this.currentScheme.totalLiushui - odd.amount
                amount = amount < 20 ? 20 : amount
                amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)
              }
              */
              odd.roomWebSocket.send(
                doSend(
                  cmd.gameBetExt(newVal, type2, amount),
                  odd.socketId,
                  odd.userEncryptKey,
                  odd.userDecryptKey,
                  odd.broadcastDecryptKey
                ).buffer
              )
              this.$set(odd, 'amount', odd.amount + amount)
              this.updateOperation(this.currentScheme)
              this.addWebSocketLog({
                schemeId: this.currentScheme.schemeId,
                msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${odd.name}——房间：${
                  odd.vid
                }，局号：${newVal}，下注：${type2 === 1 ? '庄' : '闲'}，金额：${amount}`
              })
            }
          })
        } else {
          const minLen = Math.min.apply(
            Math,
            this.currentScheme.sites.map((s) => {
              return s.specifyValue.length
            })
          )
          const minArr = this.currentScheme.sites.find((s) => s.specifyValue.length === minLen).specifyValue
          const amountIndex = Math.floor(Math.random() * (minArr.length - 2)) + 2
          const type = [1, 2]
          const type1 = type[Math.floor(Math.random() * type.length)]
          let type2
          type1 === 1 ? (type2 = 2) : (type2 = 1)

          // let ratio
          this.currentScheme.sites.map((s) => {
            if (s.roomWebSocket && s.roomWebSocket.readyState === 1) {
              let playType
              s.specifyValue[0] === 0 ? (playType = type1) : (playType = type2)
              const amount = s.specifyValue[amountIndex]

              /*
              计算下注金额的临界值
              if (s.specifyValue[1] === 1) {
                if (s.amount + amount >= this.currentScheme.totalLiushui) {
                  const currentAmount = amount
                  amount = this.currentScheme.totalLiushui - s.amount
                  ratio = amount / currentAmount
                  amount = amount < 20 ? 20 : amount
                  amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)
                  console.log(
                    '是否是计算止水金额的网站：%s，本来应该下注的金额：%s，修改后应该下注的金额：%s，比例：%s',
                    s.specifyValue[1] === 1,
                    currentAmount,
                    amount,
                    ratio
                  )
                }
              } else {
                if (ratio) {
                  amount = amount * ratio
                  amount = amount < 20 ? 20 : amount
                  amount = amount % 10 === 0 ? amount : amount + 10 - (amount % 10)
                }
              }
              */
              setTimeout(() => {
                s.roomWebSocket.send(
                  doSend(
                    cmd.gameBetExt(newVal, playType, amount),
                    s.socketId,
                    s.userEncryptKey,
                    s.userDecryptKey,
                    s.broadcastDecryptKey
                  ).buffer
                )
                this.addWebSocketLog({
                  schemeId: this.currentScheme.schemeId,
                  msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${s.name}——房间：${
                    s.vid
                  }，局号：${newVal}，下注：${playType === 1 ? '庄' : '闲'}，金额：${amount}`
                })
                this.$set(s, 'amount', s.amount + amount)
              })
            }
          })
        }
      }
    }
  },
  created() {
    console.log('执行created')
  },
  mounted() {
    console.log('执行 mounted')
    if (this.tab) this.currentHeadHeight = 22 * this.operationList[this.tab].sites.length
    this.currentHeight = window.innerHeight
    window.onresize = () => {
      this.currentHeight = window.innerHeight
    }
  },
  methods: {
    ...mapActions('scheme', ['addOperation', 'deleteOperation', 'updateOperation']),
    ...mapActions('ag', ['addWebSocketLog', 'deleteWebSocketLog']),

    addOperationScheme() {
      console.log('执行 method socket')
      const schemeId = this.$route.params.schemeId
      const schemeState = this.schemeList.find((s) => s.schemeId === schemeId)
      schemeState.sites = JSON.parse(schemeState.sites)
      if ((schemeState.amountType === 1 || schemeState.amountType === 2) && schemeState.sites.length % 2 !== 0) {
        schemeState.sites.splice(schemeState.sites.length - 1, 1)
      }
      schemeState.sites = schemeState.sites.map((siteId) => {
        return this.siteList.find((s) => s.siteId === siteId)
      })
      schemeState.isAllConnect = false
      this.addOperation(schemeState)
    },
    socket() {
      console.log('执行 method socket')
      const schemeId = this.$route.params.schemeId
      const gameInfo = this.gameInfo.find((i) => i.schemeId === schemeId)
      const scheme = this.operationList.find((o) => o.schemeId === schemeId)
      const agInfo = scheme.sites.map((s) => {
        return gameInfo.agInfo.find((a) => a.siteId === s.siteId)
      })
      const room = JSON.parse(scheme.room)
      const roomRandom = room[Math.floor(Math.random() * room.length)]
      const loginPort = this.config.find((c) => c.hostType === 'login').port
      const plazaPort = this.config.find((c) => c.hostType === 'plaza').port
      const roomPort = this.config.filter((c) => c.vids).find((c) => c.vids.find((v) => v === roomRandom)).port
      agInfo.map(async (agConfig) => {
        const site = scheme.sites[scheme.sites.findIndex((s) => s.siteId === agConfig.siteId)]
        this.$set(agConfig, 'loginPort', loginPort)
        this.$set(agConfig, 'plazaPort', plazaPort)
        this.$set(agConfig, 'vid', roomRandom)
        this.$set(agConfig, 'roomPort', roomPort)
        this.$set(site, 'vid', roomRandom)
        this.$set(site, 'amount', 0)
        const result = await loginRoom(
          agConfig,
          (msg) => {
            this.addWebSocketLog({
              schemeId: scheme.schemeId,
              msg: `${moment().locale('zh-cn').format('YYYY-MM-DD HH:mm:ss')}——网站：${site.name}——` + msg
            })
          },
          (balance) => {
            this.$set(site, 'balance', balance)
            this.updateOperation(scheme)
          },
          (gmcode) => {
            this.currentGameCode = gmcode
          },
          (userEncryptKey) => {
            this.$set(site, 'userEncryptKey', userEncryptKey)
            this.updateOperation(scheme)
          },
          (userDecryptKey) => {
            this.$set(site, 'userDecryptKey', userDecryptKey)
            this.updateOperation(scheme)
          },
          (broadcastDecryptKey) => {
            this.$set(site, 'broadcastDecryptKey', broadcastDecryptKey)
            this.updateOperation(scheme)
          }
        )
        if (result) {
          this.isConnect.push(true)
          this.$set(site, 'platformWebSocket', result.currentPlatformWebSocket)
          this.$set(site, 'plazaWebSocket', result.currentPlazaWebSocket)
          this.$set(site, 'roomWebSocket', result.currentRoomWebSocket)
          this.$set(site, 'socketId', result.socketId)
          this.updateOperation(scheme)
        }
      })

      if (scheme.amountType === 3) {
        const specifyArr = JSON.parse(scheme.specify)
        specifyArr.map((s) => {
          const site = scheme.sites.find((ss) => ss.siteId === s.id)
          this.$set(site, 'specifyValue', s.specifyValue.split('*').map(Number))
          this.updateOperation(scheme)
        })
      }
    },
    stopScheme(schemeId) {
      this.currentSchemeId = schemeId
      this.stopSchemeDialog = true
    },
    stop() {
      for (const site of this.currentScheme.sites) {
        site.platformWebSocket.close()
        site.plazaWebSocket.close()
        site.roomWebSocket.close()
      }
      this.deleteOperation(this.tab)
      this.deleteWebSocketLog(this.currentSchemeId)
      this.stopSchemeDialog = false
    }
  }
}
</script>
<style scoped>
.v-window,
.window__container,
.v-window-item {
  height: 100%;
}
.table {
  overflow: auto;
  border-collapse: collapse;
  border-spacing: 0;
}
table thead tr,
table tbody tr {
  text-align: left;
  display: table;
  width: 100%;
  table-layout: fixed;
}
</style>
