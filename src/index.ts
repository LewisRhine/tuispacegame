import {BoxRenderable, ConsolePosition, createCliRenderer, InputRenderable, TextRenderable} from "@opentui/core"
import {newState} from "./state.ts";


const enemyShip = newState({
    hall: 10,
    attackCount: 100,
    systems: {
        weapons: 3,
        shields: 5,
        lifeSupport: 5
    },

    agro: () => {
        enemyShip.sub(() => {
            if (enemyShip.attackCount < 0) {
                console.log("fire")
                if (player.systems.shields > 0) {
                    player.systems.shields -= enemyShip.systems.weapons
                } else {
                    player.hall -= enemyShip.systems.weapons
                }
                enemyShip.attackCount = 100
                return
            }

            setTimeout(() => {
                enemyShip.attackCount--
            }, 100)

        })
    }
})


type Targets = 'weapons' | 'shields' | 'lifeSupport' | null

const player = newState({
    target: null as Targets,
    hall: 10,
    systems: {
        weapons: 3,
        shields: 0,
        lifeSupport: 5
    },


    input: (value: string) => {
        const leftSide = value.split(':')[0];
        const rightSide = value.split(':')[1];

        if (leftSide === 'target') {
            if (rightSide === 's') player.target = 'shields'
        }
        if (leftSide === 'a') {
            if (rightSide === 's') player.systems.shields = 5
        }

        if (value === 'fire') {
            if (player.target === 'shields') {
                enemyShip.systems.shields -= player.systems.weapons;
                if (enemyShip.systems.shields <= 0) {
                    player.target = null
                }
            }
        }
    }
})


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
    width: 38,
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
    player.input(value)
    nameInput.value = ''
})

const playerDisplay = new TextRenderable(renderer, {})
const enemyDisplay = new TextRenderable(renderer, {})

content.add(playerDisplay)
content.add(enemyDisplay)
content.add(nameInput)


panel.add(content)
renderer.root.add(panel)
renderer.console.show()
enemyShip.agro()

player.sub(() => {
    playerDisplay.content = `hall: ${player.hall}, shields: ${player.systems.shields}, target ${player.target}`
})
enemyShip.sub(() => {
    enemyDisplay.content = `hall: ${enemyShip.hall}, shields: ${enemyShip.systems.shields}, next attack ${enemyShip.attackCount}`
})

