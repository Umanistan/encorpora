import "./styles.css"
import type { GameModule, HostApi, StackConfig } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { createJuiceSqueeze } from "./game"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __juiceSqueeze?: { dispose: () => void }
  __corpanHostActive?: boolean
}

type InitialState = {
  stackConfig?: StackConfig
}

const GAME_ID = "juice_squeeze"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__juiceSqueeze) {
        scope.__juiceSqueeze.dispose()
        scope.__juiceSqueeze = undefined
      }
      const instance = createJuiceSqueeze(container, hostApi, initialState)
      scope.__juiceSqueeze = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__juiceSqueeze = undefined
        },
      }
    },
  }
}

const mountForDev = () => {
  const scope = globalThis as GlobalScope
  if (scope.__corpanHostActive) {
    return
  }
  const root = document.getElementById("corpan-game-root")
  if (!root) {
    return
  }

  const hostApi: HostApi = createMockHostApi()
  if (scope.__juiceSqueeze) {
    scope.__juiceSqueeze.dispose()
    scope.__juiceSqueeze = undefined
  }
  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) {
    return
  }
  module.mount(root, hostApi, { stackConfig: hostApi.getStackConfig() } as InitialState)
}

registerGame()
mountForDev()

