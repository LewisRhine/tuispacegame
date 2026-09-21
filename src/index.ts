import {BoxRenderable, ConsolePosition, createCliRenderer, InputRenderable, TextRenderable} from "@opentui/core"
import {alerts, enemyShip, player, playerInput} from "./gameState.ts";

let attackTimer: ReturnType<typeof setTimeout>

const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    consoleOptions: {
        position: ConsolePosition.BOTTOM,
        sizePercent: 30,
    },
})

const panel = new BoxRenderable(renderer, {
    width: "100%",
    height: 9,
    alignItems: "center",
    justifyContent: "center",
})
const content = new BoxRenderable(renderer, {
    width: "100%",
    height: 7,
    padding: 1,
    flexDirection: "column",
    gap: 1,
    alignItems: "center",
})
const nameInput = new InputRenderable(renderer, {
    width: 25,
    placeholder: "Name",
})

nameInput.on("enter", (value: string) => {
    playerInput(value)
    nameInput.value = ''
})


const playerDisplay = new TextRenderable(renderer, {})
const enemyDisplay = new TextRenderable(renderer, {})
const alertDisplay = new TextRenderable(renderer, {})

content.add(playerDisplay)
content.add(enemyDisplay)
content.add(nameInput)
content.add(alertDisplay)
panel.add(content)
renderer.root.add(panel)
renderer.keyInput.on("keypress", (key) => {
    if (key.ctrl && key.name === "t") {
        renderer.console.visible ? renderer.console.hide() : renderer.console.show()
    }
})
nameInput.focus()
renderer.console.show()
renderer.once('destroy', () => {
    clearTimeout(attackTimer)
})

enemyShip.sub(() => {
    if (enemyShip.attackCount < 0) {
        if (player.systems.shields > 0) {
            player.systems.shields -= enemyShip.systems.weapons
        } else {
            player.hall -= enemyShip.systems.weapons
        }
        enemyShip.attackCount = 100
        return
    }

    attackTimer = setTimeout(() => {
        enemyShip.attackCount--
    }, 500)
})


player.sub(() => {
    playerDisplay.content = player.systemStatus
})


enemyShip.sub(() => {
    enemyDisplay.content = `hall: ${enemyShip.hall}, shields: ${enemyShip.systems.shields}, next attack ${enemyShip.attackCount}`
})

alerts.sub(() => {
    alertDisplay.content = alerts.alert
})


