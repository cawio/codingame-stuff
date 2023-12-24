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
    public foeDrones: Map<number, Drone> = new Map();
    public myDrones: Map<number, Drone> = new Map();
    public creatures: Map<number, Creature> = new Map();
    public turnsLeft: number = this.MAX_TURNS;
    public myScore: number = 0;
    public foeScore: number = 0;
}

/**
 * Fish move 200u each turn, in a randomly chosen direction at the beginning of the game.
 * Each fish moves within a habitat zone based on its type.
 * If it reaches the edge of its habitat zone, it will rebound off the edge.
 * If a fish comes within 600u of another, it will begin to swim in the opposite direction to the nearest fish.
 */
class Creature {
    public readonly MAX_TRAVEL_DISTANCE_PER_TURN: number = 200;
    public readonly PERSONAL_SPACE: number = 600;
    public id: number = 0;
    public color: CreatureColor = CreatureColor.Unknown;
    public type: CreatureType = CreatureType.Unknown;
    public posX: number | undefined;
    public posY: number | undefined;
    public speedX: number | undefined;
    public speedY: number | undefined;
    public scanned: boolean = false;
    public saved: boolean = false;

    constructor(id: number) {
        this.id = id;
    }

    public clearPositionalData(): void {
        this.posX = undefined;
        this.posY = undefined;
        this.speedX = undefined;
        this.speedY = undefined;
    }

    public get visible(): boolean {
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
    private static readonly cuteAdjectives = ["Fluffy", "Sparkly", "Cheery", "Bubbly", "Cozy", "Cuddly"];
    private static readonly cuteNouns = ["Bunny", "Kitten", "Panda", "Butterfly", "Daisy", "Peach"];
    private readonly MAX_TRAVEL_DISTANCE_PER_TURN: number = 600;
    private readonly MOTOR_OFF_SINKRATE: number = 300;
    private readonly LIGHT_OFF_SCANNER_RANGE: number = 800;
    private readonly LIGHT_ON_SCANNER_RANGE: number = 2000;
    private readonly BATTERY_MAX_CAPACITY: number = 30;
    private readonly SCAN_SAVE_RANGE: number = 500;
    private readonly DRONE_NAME: string;
    public id: number = 0;
    public posX: number = 0;
    public posY: number = 0;
    public emergency: number = 0;
    public battery: number = 0;
    public memory: Set<number> = new Set();
    public radarBlips: Map<number, RadarBlip> = new Map();

    constructor(id: number) {
        this.id = id;
        this.DRONE_NAME = this.generateCuteName();
    }

    private generateCuteName(): string {
        const randomAdjective = Drone.cuteAdjectives[Math.floor(Math.random() * Drone.cuteAdjectives.length)];
        const randomNoun = Drone.cuteNouns[Math.floor(Math.random() * Drone.cuteNouns.length)];

        return `${randomAdjective}${randomNoun} (Id:${this.id})`;
    }

    public getRadarBlipForCreature(creatureId: number): RadarBlip {
        if (!this.radarBlips.has(creatureId)) {
            this.radarBlips.set(creatureId, { droneId: this.id, creatureId: creatureId, direction: 'TL' });
        }

        return this.radarBlips.get(creatureId)!;
    }

    get name(): string {
        return this.DRONE_NAME;
    }

    public think(creatures: Map<number, Creature>): string {
        if (this.memory.size >= 3) {
            return this.saveCreatures(creatures);
        }

        return this.findCreatureToMoveTo(creatures);
    }

    public findCreatureToMoveTo(creatures: Map<number, Creature>): string {
        let lightCommand: string = this.determineLightStatus();
        const visibleUnscannedCreatures = [...creatures.values()].filter((creature: Creature) => creature.visible && !creature.scanned);
        if (visibleUnscannedCreatures.length > 0) {
            return `${this.interceptCreature(visibleUnscannedCreatures)} ${lightCommand}`;
        }

        const unscannedCreature = [...creatures.values()].find((creature: Creature) => !creature.scanned);
        if (unscannedCreature) {
            return `${this.moveToRadarBlip(unscannedCreature.id)} ${lightCommand}`;
        }

        return `WAIT ${lightCommand}`;
    }

    private interceptCreature(creatures: Creature[]): string {
        const closestCreature = creatures.reduce((prev: Creature, current: Creature) => {
            if (prev === undefined) {
                return current;
            }

            const prevDistance = this.distance(this.posX, this.posY, prev.posX!, prev.posY!);
            const currentDistance = this.distance(this.posX, this.posY, current.posX!, current.posY!);

            return prevDistance < currentDistance ? prev : current;
        });

        return `MOVE ${closestCreature.posX} ${closestCreature.posY}`;

    }

    private saveCreatures(creatures: Map<number, Creature>): string {
        if (this.posY > this.SCAN_SAVE_RANGE) {
            return `MOVE ${this.posX} ${this.SCAN_SAVE_RANGE}`;
        }

        this.memory.forEach((creatureId: number) => {
            const creature = creatures.get(creatureId);
            if (creature) {
                creature.saved = true;
            }
        });

        this.memory.clear();

        return `WAIT`;
    }

    private distance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private moveToRadarBlip(creatureId: number): string {
        const blip = this.getRadarBlipForCreature(creatureId);
        console.error(`blip.direction = ${blip.direction}`)
        switch (blip.direction) {
            case 'TL':
                return `MOVE ${this.posX - this.MAX_TRAVEL_DISTANCE_PER_TURN} ${this.posY - this.MAX_TRAVEL_DISTANCE_PER_TURN}`;
            case 'TR':
                return `MOVE ${this.posX + this.MAX_TRAVEL_DISTANCE_PER_TURN} ${this.posY - this.MAX_TRAVEL_DISTANCE_PER_TURN}`;
            case 'BL':
                return `MOVE ${this.posX - this.MAX_TRAVEL_DISTANCE_PER_TURN} ${this.posY + this.MAX_TRAVEL_DISTANCE_PER_TURN}`;
            case 'BR':
                return `MOVE ${this.posX + this.MAX_TRAVEL_DISTANCE_PER_TURN} ${this.posY + this.MAX_TRAVEL_DISTANCE_PER_TURN}`;
            default:
                return 'WAIT';
        }
    }

    private determineLightStatus(): string {
        return this.battery > 5 ? '1' : '0';
    }
}

type RadarIndication = 'TL' | 'TR' | 'BL' | 'BR';

interface RadarBlip {
    droneId: number;
    creatureId: number;
    direction: RadarIndication;
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

/**
 * Represents the state of a drone.
 */
enum DroneState {
    Unknown = -1,
    Moving = 0,
    Scanning = 1,
    Saving = 2,
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
    public turnStartTime: number = 0;

    private handleScoreInput(): void {
        this.game.myScore = parseInt(readline());
        this.game.foeScore = parseInt(readline());
    }

    private handleSavedScansInput(foe: boolean = false): void {
        const scanCount = parseInt(readline());
        for (let i = 0; i < scanCount; i++) {
            const creatureId = parseInt(readline());
            let creature = this.findCreatureById(creatureId);

            if (foe) {
                // TODO: maybe we could use this data somehow
                continue;
            }

            creature.saved = true;
        }
    }

    private handleDronesInput(foe: boolean = false): void {
        const droneCount = parseInt(readline());
        for (let i = 0; i < droneCount; i++) {
            var inputs = readline().split(' ');
            const droneId = parseInt(inputs[0]);
            let drone = foe
                ? this.findDroneById(droneId, foe)
                : this.findDroneById(droneId);


            if (foe && !this.game.foeDrones.has(drone.id)) {
                this.game.foeDrones.set(drone.id, drone);
            }

            if (!foe && !this.game.myDrones.has(drone.id)) {
                this.game.myDrones.set(drone.id, drone);
            }

            drone.posX = parseInt(inputs[1]);
            drone.posY = parseInt(inputs[2]);
            drone.emergency = parseInt(inputs[3]);
            drone.battery = parseInt(inputs[4]);
        }
    }

    private handleDronesScanInput(): void {
        const scanCount = parseInt(readline());
        for (let i = 0; i < scanCount; i++) {
            var inputs = readline().split(' ');

            const creatureId = parseInt(inputs[1]);
            const creature = this.findCreatureById(creatureId);
            creature.scanned = true;

            const droneId = parseInt(inputs[0]);
            const drone = this.findDroneById(droneId);
            drone.memory.add(creatureId);
        }
    }

    private handleVisibleCreaturesInput(): void {
        const creatureCount = parseInt(readline());
        const visibleCreatureIds: number[] = [];
        for (let i = 0; i < creatureCount; i++) {
            var inputs = readline().split(' ');
            const creatureId = parseInt(inputs[0]);
            visibleCreatureIds.push(creatureId);
            const creature = this.findCreatureById(creatureId);
            creature.posX = parseInt(inputs[1]);
            creature.posY = parseInt(inputs[2]);
            creature.speedX = parseInt(inputs[3]);
            creature.speedY = parseInt(inputs[4]);
        }

        // TODO: i don't like this
        this.game.creatures.forEach((creature: Creature, creatureId: number) => {
            if (!visibleCreatureIds.includes(creatureId)) {
                creature.clearPositionalData();
            }
        });
    }

    private findCreatureById(id: number): Creature {
        return this.game.creatures.get(id) ?? new Creature(id);
    }

    private findDroneById(id: number, foe: boolean = false): Drone {
        if (foe) {
            return this.game.foeDrones.get(id) ?? new Drone(id);
        }

        return this.game.myDrones.get(id) ?? new Drone(id);
    }

    private createCreatureWithId(id: number): Creature {
        const creature = new Creature(id);
        return creature;
    }

    private handleRadarBlipsInput(): void {
        const radarBlipCount = parseInt(readline());
        for (let i = 0; i < radarBlipCount; i++) {
            var inputs = readline().split(' ');
            const droneId = parseInt(inputs[0]);
            const creatureId = parseInt(inputs[1]);
            const radar = inputs[2];
            const drone = this.findDroneById(droneId);
            const blip = drone.getRadarBlipForCreature(creatureId);
            blip.direction = radar as RadarIndication;
        }
    }

    /**
     * This method is called once, at the beginning of the game
     */
    public handleInitialInput(): void {
        this.turnStartTime = Date.now();
        const creatureCount = parseInt(readline());
        for (let i = 0; i < creatureCount; i++) {
            var inputs = readline().split(' ');
            const creatureId = parseInt(inputs[0]);
            const creature = this.createCreatureWithId(creatureId);
            creature.color = parseInt(inputs[1]);
            creature.type = parseInt(inputs[2]);
            this.game.creatures.set(creature.id, creature);
        }
    }

    /**
     * This method is called for each turn
     */
    public run(): void {
        this.turnStartTime = Date.now();
        this.handleScoreInput();
        this.handleSavedScansInput();
        this.handleSavedScansInput(true);
        this.handleDronesInput();
        this.handleDronesInput(true);
        this.handleDronesScanInput();
        this.handleVisibleCreaturesInput();
        this.handleRadarBlipsInput();

        // TODO: think if we can do something with this data
        this.game.turnsLeft--;

        this.game.myDrones.forEach((drone: Drone): void => {
            const move = drone.think(this.game.creatures);
            this.outputBuffer.addLine(move);
        });

        this.outputBuffer.flush();

        console.error(`Turn took ${Date.now() - this.turnStartTime}ms`);
    }
}

const runner = new GameRunner();
runner.handleInitialInput();

while (true) {
    runner.run()
}
