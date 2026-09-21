import {newState} from "./state.ts";


export const enemyShip = newState({
    hall: 10,
    attackCount: 100,
    systems: {
        weapons: 3,
        shields: 5,
        lifeSupport: 5
    }
})

type Targets = 'weapons' | 'shields' | 'lifeSupport' | null

export const player = newState({
    target: null as Targets,
    hall: 10,
    systems: {
        weapons: 3,
        shields: 0,
        lifeSupport: 5
    },

    get systemStatus() {
        return `hall: ${this.hall}, shields: ${this.systems.shields}, target ${this.target}`
    }
})

export function playerInput(value: string) {
    const leftSide = value.split(':')[0];
    const rightSide = value.split(':')[1];

    if (leftSide === 'target') {
        if (rightSide === 's') player.target = 'shields'
    }
    if (leftSide === 'a') {
        if (!rightSide) alerts.alert = 'No system!'
        if (rightSide === 's') player.systems.shields = 5
    }

    if (value === 'fire') {
        if (!player.target) alerts.alert = 'No target selected!'

        if (player.target === 'shields') {
            enemyShip.systems.shields -= player.systems.weapons;
            if (enemyShip.systems.shields <= 0) {
                player.target = null
            }
        }
    }
}


export const alerts = newState({
    alert: '',
})

let oldAlert = alerts.alert
let clearAlert: ReturnType<typeof setTimeout>
alerts.sub(() => {
    if (alerts.alert === oldAlert) return

    clearTimeout(clearAlert)
    clearAlert = setTimeout(() => alerts.alert = '', 1000)
})