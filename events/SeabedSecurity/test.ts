/**
 * Mock implementation of the readline function from Codingame.
 */
function readline(): string {
    return '13.12';
}

//#region Game Classes
/**
 * Represents the game data including the maximum number of turns,
 * the number of turns left, creatures, scores, and drones.
 */
class GameData {
    private readonly MAX_TURNS: number = 200;
    private readonly FIRST_TURN_RESPONSE_TIME: number = 1000;
    private readonly TURN_RESPONSE_TIME: number = 50;
    public turnsLeft: number = 0;
    public creatures: Creature[] = [];
    public myScore: number = 0;
    public foeScore: number = 0;
    public myDrones: Drone[] = [];
    public foeDrones: Drone[] = [];
}

/**
 * Fish move 200u each turn, in a randomly chosen direction at the beginning of the game.
 * Each fish moves within a habitat zone based on its type.
 * If it reaches the edge of its habitat zone, it will rebound off the edge.
 * If a fish comes within 600u of another, it will begin to swim in the opposite direction to the nearest fish.
 */
class Creature {
    private readonly MAX_TRAVEL_DISTANCE_PER_TURN: number = 200;
    private readonly PERSONAL_SPACE: number = 600;
    public id: number = 0;
    public color: CreatureColor = CreatureColor.Unknown;
    public type: CreatureType = CreatureType.Unknown;
    public posX: number | undefined;
    public posY: number | undefined;
    public speedX: number | undefined;
    public speedY: number | undefined;
    public scanned: boolean = false;
    public scannedBy: number | undefined;
    public savedByMe: boolean = false;
    public savedByFoe: boolean = false;

    constructor(id: number) {
        this.id = id;
    }

    public clearPositionalData(): void {
        this.posX = undefined;
        this.posY = undefined;
        this.speedX = undefined;
        this.speedY = undefined;
    }

    public get isVisible(): boolean {
        return this.posX !== undefined && this.posY !== undefined;
    }
}

/**
 * Drones move towards the given point, with a maximum distance per turn of 600u.
 * If the motors are not activated in a turn, the drone will sink by 300u.
 * At the end of the turn, fish within a radius of 800u will be automatically scanned.
 * If you have increased the power of your light, this radius becomes 2000u, but the battery drains by 5 points.
 * If the powerful light is not activated, the battery recharges by 1.
 * The battery has a capacity of 30 and is fully charged at the beginning of the game.
 * If the drone is near the surface (y ≤ 500u), the scans will be automatically saved, and points will be awarded.
 */
class Drone {
    private readonly MAX_TRAVEL_DISTANCE_PER_TURN: number = 600;
    private readonly MOTOR_OFF_SINKRATE: number = 300;
    private readonly LIGHT_OFF_SCANNER_RANGE: number = 800;
    private readonly LIGHT_ON_SCANNER_RANGE: number = 2000;
    private readonly BATTERY_MAX_CAPACITY: number = 30;
    private static readonly cuteAdjectives = ["Fluffy", "Sparkly", "Cheery", "Bubbly", "Cozy", "Cuddly"];
    private static readonly cuteNouns = ["Bunny", "Kitten", "Panda", "Butterfly", "Daisy", "Peach"];
    public id: number = 0;
    public posX: number = 0;
    public posY: number = 0;
    public emergency: number = 0;
    public battery: number = 0;
    public creatureScanMemory: number[] = [];
    private readonly DRONE_NAME: string;

    constructor(id: number) {
        this.id = id;
        this.DRONE_NAME = this.generateCuteName();
    }

    private generateCuteName(): string {
        const randomAdjective = Drone.cuteAdjectives[Math.floor(Math.random() * Drone.cuteAdjectives.length)];
        const randomNoun = Drone.cuteNouns[Math.floor(Math.random() * Drone.cuteNouns.length)];

        return `${randomAdjective}${randomNoun} (Id:${this.id})`;
    }

    get name(): string {
        return this.DRONE_NAME;
    }

    public moveToClosestUnscannedCreature(creatures: Creature[]) {
        if (creatures.length <= 0) {
            return `WAIT ${this.battery > 15 ? '1' : '0'}`
        }

        let closestCreature = creatures[0];


        let minDistance = this.distance(this.posX, this.posY, closestCreature.posX!, closestCreature.posY!);

        creatures.forEach((c: Creature) => {
            const dist = this.distance(this.posX, this.posY, c.posX!, c.posY!);
            if (dist < minDistance) {
                minDistance = dist;
                closestCreature = c;
            }
        });

        const creatureInRange = minDistance < this.LIGHT_ON_SCANNER_RANGE;

        return `MOVE ${closestCreature.posX} ${closestCreature.posY} ${creatureInRange ? '1' : '0'}`

    }

    public distance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
}
//#endregion

//#region Enums
/**
 * Represents the type of a creature.
 */
enum CreatureType {
    Unknown = -1,
    Squid = 0,
    Fish = 1,
    Crab = 2,
}

/**
 * Represents the color of a creature.
 */
enum CreatureColor {
    Unknown = -1,
    Pink = 0,
    Yellow = 1,
    Green = 2,
    Blue = 3,
}
//#endregion

//#region Utils
/**
 * This class is used to buffer the output, so we can flush it all at once
 */
class OutputBuffer {
    private buffer: string[] = [];

    public addLine(line: string): void {
        this.buffer.push(line);
    }

    public flush(): void {
        console.log(this.buffer.join('\n'));
        this.buffer = [];
    }
}
//#endregion

class GameRunner {
    public game = new GameData();
    public outputBuffer = new OutputBuffer();

    private handleScoreInput(): void {
        this.game.myScore = parseInt(readline());
        this.game.foeScore = parseInt(readline());
    }

    private handleSavedScansInput(foe: boolean = false): void {
        const scanCount: number = parseInt(readline());
        for (let i = 0; i < scanCount; i++) {
            const creatureId: number = parseInt(readline());
            let creature: Creature | undefined = this.findCreatureById(creatureId);

            if (!creature) {
                creature = this.createCreatureWithId(creatureId);
                this.game.creatures.push(creature);
            }

            if (foe) {
                creature.savedByFoe = true;
            } else {
                creature.savedByMe = true;
            }
        }
    }

    private handleDronesInput(foe: boolean = false): void {
        const droneCount: number = parseInt(readline());
        for (let i = 0; i < droneCount; i++) {
            var inputs: string[] = readline().split(' ');
            const droneId: number = parseInt(inputs[0]);
            let drone: Drone | undefined = foe
                ? this.game.foeDrones.find(d => d.id === droneId)
                : this.game.myDrones.find(d => d.id === droneId);

            if (!drone) {
                drone = new Drone(droneId);
                this.game.myDrones.push(drone);
            }

            console.error(`Processing ${drone.name} (${foe ? 'foe' : 'my'})`)

            drone.posX = parseInt(inputs[1]);
            drone.posY = parseInt(inputs[2]);
            drone.emergency = parseInt(inputs[3]);
            drone.battery = parseInt(inputs[4]);
        }
    }

    private handleDronesScanInput(): void {
        const scanCount: number = parseInt(readline());
        for (let i = 0; i < scanCount; i++) {
            var inputs: string[] = readline().split(' ');
            const creatureId: number = parseInt(inputs[0]);
            const droneId = parseInt(inputs[1]);
            const drone = this.game.myDrones.find(d => d.id === droneId);
            // TODO: somehow this memory needs to be cleared if the drone is within 500u of the surface
            drone?.creatureScanMemory.push(creatureId);
        }
    }

    private handleVisibleCreaturesInput(): void {
        const creatureCount: number = parseInt(readline());
        const visibleCreatureIds: number[] = [];
        for (let i = 0; i < creatureCount; i++) {
            var inputs: string[] = readline().split(' ');
            const creatureId: number = parseInt(inputs[0]);
            visibleCreatureIds.push(creatureId);
            let creature = this.findCreatureById(creatureId);

            if (!creature) {
                creature = this.createCreatureWithId(creatureId);
                this.game.creatures.push(creature);
            }
            creature.posX = parseInt(inputs[1]);
            creature.posY = parseInt(inputs[2]);
            creature.speedX = parseInt(inputs[3]);
            creature.speedY = parseInt(inputs[4]);
        }

        this.game.creatures.forEach((c: Creature) => {
            if (!visibleCreatureIds.includes(c.id)) {
                c.clearPositionalData();
            }
        });
    }

    private findCreatureById(id: number): Creature | undefined {
        return this.game.creatures.find((c: Creature): boolean => c.id === id);
    }

    private createCreatureWithId(id: number): Creature {
        const creature = new Creature(id);
        return creature;
    }

    private handleRadarBlipsInput(): void {
        // TODO: implement
        const radarBlipCount: number = parseInt(readline());
        for (let i = 0; i < radarBlipCount; i++) {
            var inputs: string[] = readline().split(' ');
            const droneId: number = parseInt(inputs[0]);
            const creatureId: number = parseInt(inputs[1]);
            const radar: string = inputs[2];
        }
    }

    /**
     * This method is called once, at the beginning of the game
     */
    public handleInitialInput(): void {
        const creatureCount: number = parseInt(readline());
        for (let i = 0; i < creatureCount; i++) {
            var inputs: string[] = readline().split(' ');
            const creatureId = parseInt(inputs[0]);
            const creature = this.createCreatureWithId(creatureId);
            creature.color = parseInt(inputs[1]);
            creature.type = parseInt(inputs[2]);
            this.game.creatures.push(creature);
        }
    }

    /**
     * This method is called for each turn
     */
    public run(): void {
        // handle all input
        this.handleScoreInput();
        this.handleSavedScansInput();
        this.handleSavedScansInput(true);
        this.handleDronesInput();
        this.handleDronesInput(true);
        this.handleDronesScanInput();
        this.handleVisibleCreaturesInput();
        this.handleRadarBlipsInput();

        // decide what to do
        // TODO: think if we can do something with this data
        this.game.turnsLeft--;

        const unscannedVisibleCreatures = this.game.creatures.filter((c) => !c.scanned && c.isVisible);
        this.game.myDrones.forEach((drone: Drone): void => {
            const move = drone.moveToClosestUnscannedCreature(unscannedVisibleCreatures);
            this.outputBuffer.addLine(move);
        });

        // flush output
        this.outputBuffer.flush();
    }
}

const runner = new GameRunner();
runner.handleInitialInput();

while (true) {
    runner.run()
}
