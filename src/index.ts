import {BoxRenderable, ConsolePosition, createCliRenderer, InputRenderable, TextRenderable} from "@opentui/core"
import {newState} from "./state.ts";


const nameState = newState({
    target: undefined as Enemy
})


interface Enemy {
    id: string
    health: number
}

interface EnemyState {
    enemies: Map<string, Enemy>;
}

const enemyState = newState<EnemyState>({
    enemies: new Map([
        ["1", {id: "1", health: 10}],
        ["2", {id: "2", health: 5}]
    ]),
});


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
    const leftSide: string = value.split(':')[0];
    const rightSide: string = value.split(':')[1];

    if (leftSide === 'target') {
        if (enemyState.enemies.has(rightSide)) {
            nameState.target = enemyState.enemies.get(rightSide)
        }
    }

    if (value === 'fire') {
        if (enemyState.enemies.has(nameState.target)) enemyState.enemies.get(nameState.target).health--
    }

    nameInput.value = ''
})

const nameDisplay = new TextRenderable(renderer, {})
const targetDisplay = new TextRenderable(renderer, {})
content.add(targetDisplay)
content.add(nameDisplay)
content.add(nameInput)


panel.add(content)
renderer.root.add(panel)
renderer.console.show()

function updateTarget() {
    nameDisplay.content = nameState.target ? `${nameState.target.id}: ${nameState.target.health}` : ''
}

nameState.sub(() => {
    targetDisplay.content = `target ${nameState.target}`
    updateTarget()
})

enemyState.sub(() => {

    // if (!!nameState.target) {
    //     if (enemyState.enemies.has(nameState.target)) {
    //         const enemy = enemyState.enemies.get(nameState.target)
    //         nameDisplay.content = `${enemy.id}: ${enemy.health}`
    //     }
    // }
})

