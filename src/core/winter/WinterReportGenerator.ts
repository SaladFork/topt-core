import { ApiResponse } from "../census/ApiWrapper";

import { WinterReport } from "./WinterReport";
import { WinterMetric, WinterMetricEntry } from "./WinterMetric";
import { WinterReportParameters } from "./WinterReportParameters";

import StatMap from "../StatMap";
import { PsEvent } from "../PsEvent";
import { TrackedPlayer } from "../objects/TrackedPlayer";
import { Vehicles } from "../census/VehicleAPI";
import { WeaponAPI, Weapon } from "../census/WeaponAPI";
import { PsLoadout, PsLoadouts } from "../census/PsLoadout";

import {
    TEvent, TEventType,
    TExpEvent, TKillEvent, TDeathEvent, TTeamkillEvent,
    TCaptureEvent, TDefendEvent,
    TVehicleKillEvent,
    TEventHandler
} from "../events/index";

import EventReporter, { Streak } from "../EventReporter";

import { Logger } from "../Loggers";
const log = Logger.getLogger("WinterReportGenerator");

export class WinterMetricIndex {
    public static KILLS: number = 0;
    public static KD: number = 1;
    public static KPM: number = 2;
    public static REVIVES: number = 3;
    public static HEALS: number = 4;
    public static RESUPPLIES: number = 5;
    public static REPAIRS: number = 6;
    public static SHIELDS: number = 7;
}

export class WinterReportGenerator {

    public static async generate(parameters: WinterReportParameters): Promise<WinterReport> {
        parameters.events = parameters.events.sort((a, b) => a.timestamp - b.timestamp);

        const report: WinterReport = new WinterReport();
        report.start = new Date(parameters.events[0].timestamp);
        report.end = new Date(parameters.events[parameters.events.length - 1].timestamp);

        report.players = [...parameters.players.filter(iter => iter.events.length > 0)];

        report.essential.length = 7;
        report.essential[WinterMetricIndex.KILLS] = this.kills(parameters);
        report.essential[WinterMetricIndex.KD] = this.kds(parameters);
        report.essential[WinterMetricIndex.HEALS] = this.heals(parameters);
        report.essential[WinterMetricIndex.REVIVES] = this.revives(parameters);
        report.essential[WinterMetricIndex.REPAIRS] = this.repairs(parameters);
        report.essential[WinterMetricIndex.RESUPPLIES] = this.resupplies(parameters);
        report.essential[WinterMetricIndex.SHIELDS] = this.shieldRepairs(parameters);
        report.essential[WinterMetricIndex.KPM] = this.kpm(parameters);
        log.debug(`Loaded ${report.essential.length} essential metrics`);

        report.fun.push(this.mostRevived(parameters));
        report.fun.push(this.mostTransportAssists(parameters));
        report.fun.push(this.mostReconAssists(parameters));
        //report.fun.push(this.mostConcAssists(parameters));
        //report.fun.push(this.mostEMPAssist(parameters));
        //report.fun.push(this.mostFlashAssists(parameters));
        report.fun.push(this.mostSaviors(parameters));
        report.fun.push(this.mostAssists(parameters));
        report.fun.push(this.mostUniqueRevives(parameters));
        report.fun.push(this.longestKillStreak(parameters));
        report.fun.push(this.highestHSR(parameters));
        report.fun.push(this.getDifferentWeapons(parameters));

        if (parameters.settings.includeVehicles == true) {
            report.fun.push(this.mostESFSKills(parameters));
            report.fun.push(this.mostValkKills(parameters));
            report.fun.push(this.mostLibKills(parameters));
            report.fun.push(this.mostGalaxyKills(parameters));

            report.fun.push(this.mostHarasserKills(parameters));
            report.fun.push(this.mostSunderersKilled(parameters));
            report.fun.push(this.mostLightningKills(parameters));
            report.fun.push(this.mostMBTKills(parameters));
        }

        report.fun.push(this.mostRoadkills(parameters));
        report.fun.push(this.mostUsefulRevives(parameters));
        report.fun.push(this.highestAverageLifeExpectance(parameters));
        report.fun.push(this.mostC4Kills(parameters));
        report.fun.push(this.mostPercentRevive(parameters));
        report.fun.push(this.mostDrawfireAssists(parameters));
        report.fun.push(this.mostRouterKills(parameters));
        report.fun.push(this.mostBeaconKills(parameters));
        report.fun.push(this.mostMAXKills(parameters));
        report.fun.push(this.mostSundySpawns(parameters));
        report.fun.push(this.mostRouterSpawns(parameters));
        report.fun.push(this.longestHealStreak(parameters));

        report.fun.push(await this.mostKnifeKills(parameters));
        report.fun.push(await this.mostGrenadeKills(parameters));
        report.fun.push(await this.mostPistolKills(parameters));

        if (parameters.settings.funMetricCount != -1) {
            // Shuffle array
            for (let i = report.fun.length - 1; i > 0; i--) {
                const elem = Math.floor(Math.random() * (i + 1));
                [report.fun[i], report.fun[elem]] = [report.fun[elem], report.fun[i]];
            }

            report.fun = report.fun.slice(0, parameters.settings.funMetricCount);
        }

        log.debug(`Loaded ${report.fun.length} fun metrics`);

        return report;
    }

    private static revives(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.revive, PsEvent.squadRevive], {
            name: "Revives",
            funName: "Necromancer",
            description: "Most revives",
            entries: []
        });
    }

    private static heals(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.heal, PsEvent.squadHeal], {
            name: "Heals",
            funName: "Green Wizard",
            description: "Most heals",
            entries: []
        });
    }

    private static repairs(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.maxRepair, PsEvent.squadMaxRepair], {
            name: "MAX Repairs",
            funName: "Welder",
            description: "Most MAX repairs",
            entries: []
        });
    }

    private static resupplies(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.resupply, PsEvent.squadResupply], {
            name: "Resupply",
            funName: "Ammo printer",
            description: "Most resupplies",
            entries: []
        });
    }

    private static kills(parameters: WinterReportParameters): WinterMetric {
        return this.value(parameters, (player: TrackedPlayer) => player.events.filter(iter => iter.type == "kill").length, {
            name: "Kills",
            funName: "Kills",
            description: "Most kills",
            entries: []
        });
    }

    private static shieldRepairs(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.shieldRepair, PsEvent.squadShieldRepair], {
            name: "Shield Repairs",
            funName: "Shield Battery",
            description: "Most shield repairs",
            entries: []
        }, true);
    }

    private static kds(parameters: WinterReportParameters): WinterMetric {
        return this.value(
            parameters,
            (player: TrackedPlayer) => (player.stats.get(PsEvent.kill) > 24) ? player.stats.get(PsEvent.kill) / player.stats.get(PsEvent.death, 1) : 0,
            {
                name: "K/D",
                funName: "K/D",
                description: "Highest K/D",
                entries: []
            },
            (value: number) => value.toFixed(2)
        );
    }

    private static kpm(parameters: WinterReportParameters): WinterMetric {
        return this.value(
            parameters,
            (player: TrackedPlayer) => {
                if (player.stats.get(PsEvent.kill) < 25) {
                    return 0;
                }
                return player.events.filter(iter => iter.type == "kill").length / (player.secondsOnline / 60);
            },
            {
                name: "KPM",
                funName: "Speed Gunner",
                description: "Highest KPM",
                entries: []
            },
            (value: number) => value.toFixed(2)
        )
    }

    private static mostRevived(parameters: WinterReportParameters): WinterMetric {
        return this.value(
            parameters,
            ((player: TrackedPlayer) => player.events.filter(iter => iter.type == "death" && iter.revived == true).length),
            {
                name: "Revived",
                funName: "Zombie",
                description: "Revived the most",
                entries: []
            }
        );
    }

    private static mostTransportAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.transportAssists], {
            name: "Transport assists",
            funName: "Logistics Specialists",
            description: "Most transport assists",
            entries: []
        });
    }

    private static mostReconAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.motionDetect, PsEvent.squadMotionDetect], {
            name: "Recon detections",
            funName: "Flies on the Wall",
            description: "Most recon detection ticks",
            entries: []
        });
    }

    private static mostDrawfireAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.drawfire], {
            name: "Drawfire Assists",
            funName: "Professional Distraction",
            description: "Most drawfire assists",
            entries: []
        });
    }

    private static longestHealStreak(parameters: WinterReportParameters): WinterMetric {
        return this.value(
            parameters,
            ((player: TrackedPlayer) => {
                const streaks: Streak[] = EventReporter.medicHealStreaks(player.events, player.characterID);
                if (streaks.length == 0) { return 0; }

                let max: number = 0;
                let maxStreak: Streak = streaks[0]; // Will always have one, length check above
                for (const streak of streaks) {
                    if (streak.amount > max) {
                        max = streak.amount;
                        maxStreak = streak;
                    }
                }

                log.debug(`Longest heal streak of ${player.name} started ${maxStreak.start} for ${maxStreak.amount} seconds`);

                return maxStreak.amount;
            }),
            {
                name: "Longest heal streak",
                funName: "Long time healer",
                description: "Longest theoretical time with AOE heal, assuming combat surgeon 5",
                entries: []
            },
            ((display: number) => {
                return `${display.toFixed(2)} seconds`;
            })
        );
    }

    private static mostConcAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.concAssist, PsEvent.squadConcAssist], {
            name: "Conced killers",
            funName: "Concussive Maintenance",
            description: "Most kills on concussed players",
            entries: []
        });
    }

    private static mostFlashAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.flashAssist, PsEvent.squadFlashAssist], {
            name: "Flashed killers",
            funName: "Darklight",
            description: "Most kills on flashed players",
            entries: []
        });
    }

    private static mostEMPAssist(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.empAssist, PsEvent.squadEmpAssist], {
            name: "EMPed killers",
            funName: "Sparky Sparky Boom",
            description: "Most kills on EMPed players",
            entries: []
        });
    }

    private static mostSaviors(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.savior], {
            name: "Savior",
            funName: "Savior",
            description: "Most savior kills",
            entries: []
        });
    }

    private static mostAssists(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.killAssist], {
            name: "Kill assists",
            funName: "Wingmen",
            description: "Players with the most kill assists",
            entries: []
        });
    }

    private static mostRouterKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.routerKill], {
            name: "Router kills",
            funName: "Connectivity Issues",
            description: "Players with the most router kills",
            entries: []
        });
    }

    public static mostBeaconKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.beaconKill], {
            name: "Beacon kills",
            funName: "Bacon Fryer",
            description: "Players with the most beacon kills",
            entries: []
        });
    }

    public static mostRouterSpawns(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["1410"], {
            name: "Router spawns",
            funName: "Network Provider",
            description: "Players with the most router spawns",
            entries: []
        });
    }

    private static mostSundySpawns(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["233"], {
            name: "Sundy spawns",
            funName: "Cat herder",
            description: "Players with the most sundy spawns",
            entries: []
        });
    }

    private static mostUniqueRevives(parameters: WinterReportParameters): WinterMetric {
        return this.value(parameters, ((player: TrackedPlayer) => {
            const ev: TExpEvent[] = player.events.filter(iter => iter.type == "exp"
                && (iter.expID == PsEvent.revive || iter.expID == PsEvent.squadRevive)) as TExpEvent[];

            return ev.map(iter => iter.targetID).filter((value, index, array) => array.indexOf(value) == index).length;
        }), {
            name: "Most unique revives",
            funName: "Spread the love",
            description: "Most unique revives",
            entries: []
        });
    }

    private static mostMAXKills(parameters: WinterReportParameters): WinterMetric {
        return this.value(parameters, ((player: TrackedPlayer) => {
            return player.events.filter(iter => iter.type == "kill"
                && (iter.targetLoadoutID == "7" || iter.targetLoadoutID == "14" || iter.targetLoadoutID == "21")).length;
        }), {
            name: "Most MAX kills",
            funName: "Wheelchair flipper",
            description: "Players with most MAX kills",
            entries: []
        });
    }

    private static longestKillStreak(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "Kill streaks";
        metric.funName = "Big fish";
        metric.description = "Longest kill streak";

        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            let currentStreak: number = 0;
            let longestStreak: number = 0;

            for (const ev of player.events) {
                if (ev.type != "kill" && ev.type != "death") {
                    continue;
                }

                if (ev.type == "kill") {
                    ++currentStreak;
                } else if (ev.type == "death" && ev.revivedEvent == null) {
                    if (currentStreak > longestStreak) {
                        longestStreak = currentStreak;
                        amounts.set(player.name, longestStreak);
                    }
                    currentStreak = 0;
                }
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static highestHSR(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "HSR";
        metric.funName = "Head poppers";
        metric.description = "Highest headshot ratio";

        const map: StatMap = new StatMap();

        for (const player of parameters.players) {
            const kills: number = player.events.filter(iter => iter.type == "kill").length || 1;
            const hsKills: number = player.events.filter(iter => iter.type == "kill" && iter.isHeadshot == true).length || 1;

            if (player.secondsOnline < 10) {
                continue;
            }

            if (kills == 1 || hsKills == 1 || kills < 25) {
                continue;
            }

            map.set(player.name, hsKills / kills);
        }

        metric.entries = this.statMapToEntires(parameters, map, (iter: number) => `${(iter * 100).toFixed(2)}%`);

        return metric;
    }

    private static getDifferentWeapons(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "Different weapons";
        metric.funName = "Diverse Skillset";
        metric.description = "Most amount of unique weapons";

        const stats: StatMap = new StatMap();

        for (const player of parameters.players) {
            const set: Set<string> = new Set();

            for (const ev of player.events) {
                if (ev.type != "kill") {
                    continue;
                }

                set.add(ev.weaponID);
            }

            stats.set(player.name, set.size);
        }

        metric.entries = this.statMapToEntires(parameters, stats);

        return metric;
    }

    private static mostESFSKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["64", "66", "67", "1565"], {
            name: "ESFs destroyed",
            funName: "Fly Swatter",
            description: "Most ESFs destroyed",
            entries: []
        });
    }

    private static mostValkKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["501"], {
            name: "Valks destroyed",
            funName: "Valhalla wrecker",
            description: "Most valks destroyed",
            entries: []
        });
    }

    private static mostLibKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["61"], {
            name: "Libs destroyed",
            funName: "Gunships crashed",
            description: "Most libs destroyed",
            entries: []
        });
    }

    private static mostGalaxyKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["60"], {
            name: "Galaxies destroyed",
            funName: "Quasar tsunami",
            description: "Most galaxies destroyed",
            entries: []
        });
    }

    private static mostMBTKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["63", "65", "69", "1635"], {
            name: "MBTs destroyed",
            funName: "Heavy Hitter",
            description: "Most MBTs destroyed",
            entries: []
        });
    }

    private static mostHarasserKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["301"], {
            name: "Harassers destroyed",
            funName: "Rasser Harasser",
            description: "Most harassers destroyed",
            entries: []
        });
    }

    private static mostLightningKills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["62"], {
            name: "Lightnings destroyed",
            funName: "Thunder Struck",
            description: "Most lightnings destroyed",
            entries: []
        });
    }

    private static mostSunderersKilled(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, ["68"], {
            name: "Sunderers killed",
            funName: "Bus Bully",
            description: "Most sundies destroyed",
            entries: []
        });
    }

    private static mostRoadkills(parameters: WinterReportParameters): WinterMetric {
        return this.metric(parameters, [PsEvent.roadkill], {
            name: "Roadkills",
            funName: "Road rage",
            description: "Most roadkills",
            entries: []
        });
    }

    private static mostUsefulRevives(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "Kills after revives";
        metric.funName = "Rise of the Undead";
        metric.description = "Most kills 10 seconds after being revived";

        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            const revives: TEvent[] = player.events.filter(iter => iter.type == "death" && iter.revivedEvent != null);

            for (const ev of revives) {
                const kills: TEvent[] = player.events.filter(iter => {
                    return iter.type == "kill" && iter.timestamp >= ev.timestamp && iter.timestamp < ev.timestamp + 10000;
                });

                if (kills.length == 0) { continue; }

                amounts.increment(player.name, kills.length);
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static mostPercentRevive(parameters: WinterReportParameters): WinterMetric {
        return this.value(
            parameters,
            (player: TrackedPlayer) => {
                const revived: number = player.events.filter(iter => iter.type == "death" && iter.revived == true).length;
                const killed: number = player.events.filter(iter => iter.type == "death").length;
                return revived / killed;
            },
            {
                name: "Percent revived",
                funName: "Makes me strong",
                description: "Highest percentage of revived deaths to respawns",
                entries: []
            },
            (value: number) => `${(value * 100).toFixed(2)}%`
        );
    }

    private static highestAverageLifeExpectance(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "Longest life expectance";
        metric.funName = "Elders";
        metric.description = "Longest average life expectance";

        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            if (player.events.length == 0) {
                continue;
            }

            const expectances: number[] = [];

            let start: number = player.events[0].timestamp;

            for (const ev of player.events) {
                if (ev.type == "death" && ev.revived == false) {
                    expectances.push((ev.timestamp - start) / 1000);
                    start = ev.timestamp;
                }
            }

            if (expectances.length == 0) {
                continue;
            }

            const total: number = expectances.reduce((acc, val) => { return acc += val; }, 0);
            const avg: number = total / expectances.length;

            amounts.set(player.name, avg);
        }

        metric.entries = this.statMapToEntires(parameters, amounts, (value: number) => {
            let mins: number = 0;
            let seconds: number = value;

            if (value > 60) {
                mins = Math.floor(seconds / 60);
                seconds = seconds % 60;

                return `${mins.toFixed(0)} mins ${seconds.toFixed(0)} seconds`;
            }

            return `${value.toFixed(1)} seconds`;
        });

        return metric;
    }

    private static shortestLife(parameters: WinterReportParameters): WinterMetric {
        const metric: WinterMetric = new WinterMetric();
        metric.name = "Shortest life expectance";
        metric.funName = "Not elders";
        metric.description = "Shortest average life expectance";

        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            if (player.events.length == 0) {
                continue;
            }

            const expectances: number[] = [];

            let start: number = player.events[0].timestamp;

            for (const ev of player.events) {
                if (ev.type == "death" && ev.revived == false) {
                    expectances.push((ev.timestamp - start) / 1000);
                    start = ev.timestamp;
                }
            }

            if (expectances.length == 0) {
                continue;
            }

            const total: number = expectances.reduce((acc, val) => { return acc += val; }, 0);
            const avg: number = total / expectances.length;

            amounts.set(player.name, avg);
        }

        metric.entries = this.statMapToEntires(parameters, amounts, (value: number) => {
            let mins: number = 0;
            let seconds: number = value;

            if (value > 60) {
                mins = Math.floor(seconds / 60);
                seconds = seconds % 60;

                return `${mins.toFixed(0)} mins ${seconds.toFixed(0)} seconds`;
            }

            return `${value.toFixed(1)} seconds`;
        });

        return metric;
    }

    private static mostKnifeKills(parameters: WinterReportParameters): Promise<WinterMetric> {
        return this.weaponType(parameters, "Knife", {
            name: "Knife kills",
            funName: "Slasher",
            description: "Most knife kills",
            entries: []
        });
    }

    private static mostC4Kills(parameters: WinterReportParameters): WinterMetric {
        return this.weapon(parameters, ["432", "800623"], {
            name: "C4 kills",
            funName: "Explosive Tedencies",
            description: "Most C-4 kills",
            entries: []
        });
    }

    private static mostGrenadeKills(parameters: WinterReportParameters): Promise<WinterMetric> {
        return this.weaponType(parameters, "Grenade", {
            name: "Grenade kills",
            funName: "Hot Potato",
            description: "Most grenade kills",
            entries: []
        });
    }

    private static mostPistolKills(parameters: WinterReportParameters): Promise<WinterMetric> {
        return this.weaponType(parameters, "Pistol", {
            name: "Pistol kills",
            funName: "The Cowboy",
            description: "Most pistol kills",
            entries: []
        });
    }

    private static async weaponType(parameters: WinterReportParameters, type: string, metric: WinterMetric): Promise<WinterMetric> {
        const wepIDs: Set<string> = new Set();

        for (const player of parameters.players) {
            const IDs: string[] = (player.events.filter(iter => iter.type == "kill") as TKillEvent[])
                .map(iter => iter.weaponID);

            for (const id of IDs) {
                wepIDs.add(id);
            }
        }

        const amounts: StatMap = new StatMap();
        const weapons: Weapon[] = await WeaponAPI.getByIDs(Array.from(wepIDs.keys()));

        for (const player of parameters.players) {
            const kills: TKillEvent[] = player.events.filter(iter => iter.type == "kill") as TKillEvent[];

            for (const kill of kills) {
                const weapon: Weapon | undefined = weapons.find(iter => iter.ID == kill.weaponID);
                if (weapon == undefined) {
                    continue;
                }

                if (weapon.type == type) {
                    amounts.increment(player.name);
                }
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static weapon(parameters: WinterReportParameters, ids: string[], metric: WinterMetric): WinterMetric {
        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            for (const ev of player.events) {
                if (ev.type == "kill") {
                    if (ids.indexOf(ev.weaponID) > -1) {
                        amounts.increment(player.name);
                    }
                }
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static vehicle(parameters: WinterReportParameters, vehicles: string[], metric: WinterMetric): WinterMetric {
        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            for (const ev of player.events) {
                if (ev.type != "vehicle") {
                    continue;
                }

                const loadout: PsLoadout | undefined = PsLoadouts.get(ev.loadoutID);
                if (loadout != undefined) {
                    if (loadout.faction == "VS" && (ev.vehicleID == Vehicles.scythe || ev.vehicleID == Vehicles.bastionScythe || ev.vehicleID == Vehicles.magrider)) {
                        continue;
                    }
                    if (loadout.faction == "TR" && (ev.vehicleID == Vehicles.mosquito || ev.vehicleID == Vehicles.bastionMosquite || ev.vehicleID == Vehicles.prowler)) {
                        continue;
                    }
                    if (loadout.faction == "NC" && (ev.vehicleID == Vehicles.reaver || ev.vehicleID == Vehicles.bastionReaver || ev.vehicleID == Vehicles.vanguard)) {
                        continue;
                    }
                }

                if (vehicles.indexOf(ev.vehicleID) > -1) {
                    amounts.increment(player.name);
                }
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static metric(parameters: WinterReportParameters, events: string[], metric: WinterMetric, debug?: boolean): WinterMetric {
        const amounts: StatMap = new StatMap();

        for (const player of parameters.players) {
            const evs: TEvent[] = player.events.filter(iter => iter.type == "exp" && events.indexOf(iter.expID) > -1);
            if (evs.length > 0) {
                amounts.set(player.name, evs.length);
                if (debug == true) {
                    log.debug(`${player.name} got ${evs.length}`);
                }
            }
        }

        metric.entries = this.statMapToEntires(parameters, amounts);

        return metric;
    }

    private static value(
        parameters: WinterReportParameters,
        accessor: (player: TrackedPlayer) => number,
        metric: WinterMetric,
        display: ((_: number) => string) | null = null): WinterMetric {

        const map: StatMap = new StatMap();

        for (const player of parameters.players) {
            map.set(player.name, accessor(player));
        }

        metric.entries = this.statMapToEntires(parameters, map, display);

        return metric;
    }

    private static statMapToEntires(
        parameters: WinterReportParameters,
        map: StatMap,
        display: ((_: number) => string) | null = null): WinterMetricEntry[] {

        return Array.from(map.getMap().entries()).map((iter: [string, number]) => {
            const tag = parameters.players.find(i => i.name.toLowerCase() == iter[0].toLowerCase())?.outfitTag ?? "";
            return {
                name: iter[0],
                outfitTag: tag,
                value: iter[1],
                display: display != null ? display(iter[1]) : null
            };
        }).filter(iter => iter.value)
            .sort((a, b) => b.value - a.value)
            .slice(0, parameters.settings.topNPlayers == -1 ? undefined : parameters.settings.topNPlayers);
    }

}
