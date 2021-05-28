import { SaladForkReport } from './SaladForkReport'
import { SaladForkMetric, SaladForkMetricEntry } from './SaladForkMetric'
import { SaladForkReportParameters } from './SaladForkReportParameters'

import { Logger } from '../Loggers'
import { PsEvent } from '../PsEvent'
import { TrackedPlayer } from '../objects/TrackedPlayer'
import { PsLoadouts } from '../census/PsLoadout'
import { Vehicles } from '../census/VehicleAPI'
import { TEvent, TKillEvent } from 'core/events'
import { WeaponAPI, Weapon } from '../census/WeaponAPI'
import { FacilityAPI, Facility } from '../census/FacilityAPI'
import StatMap from '../StatMap'
import { FacilityCapture } from '../InvididualGenerator'

const log = Logger.getLogger('SaladForkReportGenerator')

export class SaladForkReportGenerator {
  public static async generate(
    parameters: SaladForkReportParameters
  ): Promise<SaladForkReport> {
    parameters.events = parameters.events.sort(
      (a, b) => a.timestamp - b.timestamp
    )

    const report: SaladForkReport = new SaladForkReport()

    report.start = new Date(parameters.events[0].timestamp)
    report.end = new Date(
      parameters.events[parameters.events.length - 1].timestamp
    )

    report.players = [
      ...parameters.players.filter(iter => iter.events.length > 0)
    ]

    // FIXME: Want to sort alphabetically but CML first, doesn't work
    report.outfits = [...parameters.outfits].sort((b, a) =>
      a.tag === 'CML' ? 1 : b.tag === 'CML' ? -1 : a > b ? -1 : b > a ? 1 : 0
    )

    report.summary.push(this.killStats(parameters))
    report.summary.push(await this.basesTagged(parameters))

    // Most picked-on enemies (by kills)
    // report.leaderboards.push(this.topVictims(parameters))

    // Logistics
    report.leaderboards.Logistics = []
    report.leaderboards.Logistics.push(this.squadBeaconSpawns(parameters))
    report.leaderboards.Logistics.push(this.sundererSpawns(parameters))
    report.leaderboards.Logistics.push(this.routerSpawns(parameters))
    report.leaderboards.Logistics.push(this.transportAssists(parameters))

    // Support
    report.leaderboards.Support = []
    report.leaderboards.Support.push(this.revives(parameters))
    report.leaderboards.Support.push(this.healsAndShieldRepair(parameters))
    report.leaderboards.Support.push(this.repairs(parameters))
    report.leaderboards.Support.push(this.resupplies(parameters))
    report.leaderboards.Support.push(this.recon(parameters))

    // PvP
    report.leaderboards.PvP = []
    report.leaderboards.PvP.push(this.kills(parameters))
    report.leaderboards.PvP.push(this.killsAndAssists(parameters))
    report.leaderboards.PvP.push(this.killStreak(parameters))
    report.leaderboards.PvP.push(this.kdr(parameters))
    report.leaderboards.PvP.push(this.kadr(parameters))
    report.leaderboards.PvP.push(this.hsr(parameters))
    report.leaderboards.PvP.push(this.reviveRate(parameters))
    report.leaderboards.PvP.push(this.roadKills(parameters))
    report.leaderboards.PvP.push(this.vehicleKills(parameters))
    report.leaderboards.PvP.push(await this.knifeKills(parameters))
    report.leaderboards.PvP.push(await this.pistolKills(parameters))
    report.leaderboards.PvP.push(await this.grenadeKills(parameters))
    report.leaderboards.PvP.push(this.c4Kills(parameters))
    report.leaderboards.PvP.push(this.maxKills(parameters))

    // Misc
    report.leaderboards.Miscellaneous = []
    report.leaderboards.Miscellaneous.push(this.topScore(parameters))
    report.leaderboards.Miscellaneous.push(this.teamKills(parameters))
    report.leaderboards.Miscellaneous.push(this.teamKilled(parameters))
    report.leaderboards.Miscellaneous.push(this.lifeExpectancy(parameters))

    return report
  }

  private static killStats(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    const allKillEvents: TKillEvent[] = parameters.events.filter(
      event => event.type === 'kill'
    ) as TKillEvent[]

    const isKillOfFaction = (event: TKillEvent, faction: string) => {
      const loadout = PsLoadouts.get(event.targetLoadoutID)
      return loadout !== undefined && loadout.faction === faction
    }

    return {
      name: `${allKillEvents.length} Total Kills`,
      entries: [
        {
          name: 'TR Kills',
          value: allKillEvents.filter(e => isKillOfFaction(e, 'TR')).length
        },
        {
          name: 'VS Kills',
          value: allKillEvents.filter(e => isKillOfFaction(e, 'VS')).length
        },
        {
          name: 'NC Kills',
          value: allKillEvents.filter(e => isKillOfFaction(e, 'NC')).length
        }
      ]
    }
  }

  private static async basesTagged(
    parameters: SaladForkReportParameters
  ): Promise<SaladForkMetric> {
    const outfitIds = parameters.outfits.map(o => o.ID)
    const captures = parameters.captures.filter(
      capture =>
        outfitIds.includes(capture.outfitID) &&
        capture.factionID !== capture.previousFaction
    )
    const facilityIds = captures
      .map(c => c.facilityID)
      .filter((value, index, arr) => arr.indexOf(value) === index)

    const facilities: Facility[] = await FacilityAPI.getByIDs(facilityIds)

    return {
      name: `${captures.length} ${
        captures.length === 1 ? 'Base' : 'Bases'
      } Tagged`,
      entries: captures.map(capture => {
        const facility = facilities.find(f => f.ID === capture.facilityID)
        const facilityName = facility?.name || 'Unknown'
        const zoneName = facility
          ? { 2: 'Indar', 4: 'Hossin', 6: 'Amerish', 8: 'Esamir' }[
              facility?.zoneID
            ]
          : 'Unknown'
        const outfitTag = parameters.outfits.find(
          o => o.ID === capture.outfitID
        )?.tag

        return {
          name: `${
            outfitTag ? `[${outfitTag}]` : ''
          } ${zoneName} - ${facilityName}`,
          value: parseInt(capture.previousFaction, 10),
          display:
            { 1: 'from VS', 2: 'from NC', 3: 'from TR', 4: 'from NS' }[
              capture.previousFaction
            ] || ''
        }
      })
    }
  }

  private static sundererSpawns(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Sunderer Spawns',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.sundySpawn])
    }
  }

  private static routerSpawns(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Router Spawns',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.routerSpawn])
    }
  }

  private static squadBeaconSpawns(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Galaxy/Beacon Spawns',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.squadSpawn])
    }
  }

  private static transportAssists(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Transport Assists',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.transportAssists])
    }
  }

  private static revives(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    // Total: 49
    return {
      name: 'Revives',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.revive])
    }
  }

  private static healsAndShieldRepair(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Heals and Shield Repairs',
      entries: this.sumOfStatsByPlayer(parameters, [
        PsEvent.heal,
        PsEvent.shieldRepair
      ])
    }
  }

  private static repairs(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    // Vehicle, Maxes
    return {
      name: 'Vehicle and Max Repairs',
      entries: this.sumOfStatsByPlayer(parameters, [
        PsEvent.vehicleRepair,
        PsEvent.maxRepair
      ])
    }
  }

  private static resupplies(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Resupplies',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.resupply])
    }
  }

  private static recon(parameters: SaladForkReportParameters): SaladForkMetric {
    return {
      name: 'Recon (Darts, Motion, Radar)',
      entries: this.sumOfStatsByPlayer(parameters, [
        PsEvent.motionDetect,
        PsEvent.radarDetect
      ])
    }
  }

  private static kills(parameters: SaladForkReportParameters): SaladForkMetric {
    return {
      name: 'Kills',
      entries: this.scoreEachPlayerBy(parameters, player =>
        player.stats.get(PsEvent.kill)
      )
    }
  }

  private static killsAndAssists(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Kills + Assists',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.stats.get(PsEvent.kill) + player.stats.get(PsEvent.killAssist)
      )
    }
  }

  private static kdr(parameters: SaladForkReportParameters): SaladForkMetric {
    return {
      name: 'K/D Ratio',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.stats.get(PsEvent.kill) > 10
            ? player.stats.get(PsEvent.kill) /
              player.stats.get(PsEvent.death, 1)
            : 0,
        (value: number) => value.toFixed(2)
      )
    }
  }

  private static kadr(parameters: SaladForkReportParameters): SaladForkMetric {
    return {
      name: 'K+A/D Ratio',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.stats.get(PsEvent.kill) > 10
            ? (player.stats.get(PsEvent.kill) +
                player.stats.get(PsEvent.killAssist)) /
              player.stats.get(PsEvent.death, 1)
            : 0,
        (value: number) => value.toFixed(2)
      )
    }
  }

  private static hsr(parameters: SaladForkReportParameters): SaladForkMetric {
    return {
      name: 'Headshot Rate',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.stats.get(PsEvent.kill) < 10
            ? 0
            : player.stats.get(PsEvent.headshot) /
              player.stats.get(PsEvent.kill, 1),
        (value: number) => `${(value * 100).toFixed(2)}%`
      )
    }
  }

  private static reviveRate(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: '% Deaths Revived',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.stats.get(PsEvent.revived) /
          (player.stats.get(PsEvent.death) + player.stats.get(PsEvent.revived)),
        (value: number) => `${(value * 100).toFixed(2)}%`
      )
    }
  }

  private static killStreak(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Longest Kill Streak',
      entries: this.scoreEachPlayerBy(parameters, player => {
        let currentStreak: number = 0
        let longestStreak: number = 0

        player.events.forEach((event: TEvent) => {
          if (event.type !== 'kill' && event.type !== 'death') return
          if (event.type === 'kill') currentStreak++
          if (event.type === 'death' && !event.revived) {
            if (currentStreak > longestStreak) longestStreak = currentStreak
            currentStreak = 0
          }
        })

        return longestStreak
      })
    }
  }

  private static roadKills(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Roadkills',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.roadkill])
    }
  }

  private static vehicleKills(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Vehicle Kills',
      entries: this.scoreEachPlayerBy(parameters, player =>
        player.events.reduce((sum, event) => {
          if (event.type !== 'vehicle') return sum
          const loadout = PsLoadouts.get(event.loadoutID)
          if (!loadout) return sum
          // If we're the same faction as what we killed, don't count it.
          if (
            (loadout.faction == 'VS' &&
              (event.vehicleID == Vehicles.scythe ||
                event.vehicleID == Vehicles.bastionScythe ||
                event.vehicleID == Vehicles.magrider)) ||
            (loadout.faction == 'TR' &&
              (event.vehicleID == Vehicles.mosquito ||
                event.vehicleID == Vehicles.bastionMosquite ||
                event.vehicleID == Vehicles.prowler)) ||
            (loadout.faction == 'NC' &&
              (event.vehicleID == Vehicles.reaver ||
                event.vehicleID == Vehicles.bastionReaver ||
                event.vehicleID == Vehicles.vanguard))
          ) {
            return sum
          }
          return sum + 1
        }, 0)
      )
    }
  }

  private static maxKills(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'MAX Kills',
      entries: this.scoreEachPlayerBy(
        parameters,
        player =>
          player.events.filter(
            event =>
              event.type === 'kill' &&
              (event.targetLoadoutID == '7' ||
                event.targetLoadoutID == '14' ||
                event.targetLoadoutID == '21')
          ).length
      )
    }
  }

  private static lifeExpectancy(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Life Expectancy',
      entries: this.scoreEachPlayerBy(
        parameters,
        player => {
          if (player.events.length === 0) return 0

          let startMs: number = player.events[0].timestamp

          const lifespans: number[] = []

          player.events.forEach(event => {
            if (event.type === 'death' && !event.revived) {
              lifespans.push((event.timestamp - startMs) / 1000)
              startMs = event.timestamp
            }
          })

          if (lifespans.length < 2) return 0

          const total: number = lifespans.reduce(
            (sum, lifespan) => sum + lifespan,
            0
          )
          const average: number = total / lifespans.length

          return average
        },
        lifespanInSeconds => {
          if (lifespanInSeconds < 60) return `${lifespanInSeconds}s`
          return `${Math.floor(lifespanInSeconds / 60).toFixed(0)}m ${(
            lifespanInSeconds % 60
          ).toFixed(0)}s`
        }
      )
    }
  }

  private static async knifeKills(
    parameters: SaladForkReportParameters
  ): Promise<SaladForkMetric> {
    return {
      name: 'Kills with Knives',
      entries: await this.countOfKillsWithWeaponType(parameters, 'Knife')
    }
  }

  private static async grenadeKills(
    parameters: SaladForkReportParameters
  ): Promise<SaladForkMetric> {
    return {
      name: 'Kills with Grenades',
      entries: await this.countOfKillsWithWeaponType(parameters, 'Grenade')
    }
  }

  private static async pistolKills(
    parameters: SaladForkReportParameters
  ): Promise<SaladForkMetric> {
    return {
      name: 'Kills with Pistols',
      entries: await this.countOfKillsWithWeaponType(parameters, 'Pistol')
    }
  }

  private static c4Kills(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    const c4Ids = ['432', '800623']
    return {
      name: 'Kills with C-4',
      entries: this.countOfKillsWithWeapons(parameters, c4Ids)
    }
  }

  private static topScore(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Top Score',
      entries: this.scoreEachPlayerBy(parameters, player => player.score)
    }
  }

  private static teamKills(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Teamkills',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.teamkill])
    }
  }

  private static teamKilled(
    parameters: SaladForkReportParameters
  ): SaladForkMetric {
    return {
      name: 'Teamkilled',
      entries: this.sumOfStatsByPlayer(parameters, [PsEvent.teamkilled])
    }
  }

  // Note that this uses `player.stats` which remaps some events to map others,
  // e.g. `squadRevive` also increments `revive`
  private static sumOfStatsByPlayer(
    parameters: SaladForkReportParameters,
    stats: string[]
  ): SaladForkMetricEntry[] {
    const sum = (data: number[]) => data.reduce((a, b) => a + b, 0)

    return this.scoreEachPlayerBy(parameters, player =>
      sum(stats.map(stat => player.stats.get(stat)))
    )
  }

  private static countOfKillsWithWeapons(
    parameters: SaladForkReportParameters,
    weaponIds: string[]
  ) {
    return this.countOfMatchingEventsByPlayer(
      parameters,
      event => event.type === 'kill' && weaponIds.includes(event.weaponID)
    )
  }

  private static async countOfKillsWithWeaponType(
    parameters: SaladForkReportParameters,
    weaponType: string
  ) {
    const weaponIdsUsed: Set<string> = new Set()
    const killEvents: TKillEvent[] = parameters.events.filter(
      event => event.type === 'kill'
    ) as TKillEvent[]
    killEvents.forEach(event => weaponIdsUsed.add(event.weaponID))

    const weapons: Weapon[] = await WeaponAPI.getByIDs(
      Array.from(weaponIdsUsed.keys())
    )

    return this.countOfMatchingEventsByPlayer(
      parameters,
      event =>
        event.type === 'kill' &&
        weapons.find(w => w.ID === event.weaponID)?.type === weaponType
    )
  }

  private static countOfMatchingEventsByPlayer(
    parameters: SaladForkReportParameters,
    match: (_: TEvent) => boolean
  ) {
    return this.scoreEachPlayerBy(
      parameters,
      player => player.events.filter(match).length
    )
  }

  private static scoreEachPlayerBy(
    parameters: SaladForkReportParameters,
    scoreBy: (_: TrackedPlayer) => number,
    display: ((_: number) => string) | null = null
  ) {
    const counts: StatMap = new StatMap()

    for (const player of parameters.players) {
      const score = scoreBy(player)
      if (score > 0) counts.set(player.name, score)
    }

    return this.entriesToLeaderboard(
      Array.from(counts.getMap().entries()).map(
        ([playerName, count]: [string, number]) => ({
          name: playerName,
          outfitTag:
            parameters.players.find(
              i => i.name.toLowerCase() == playerName.toLowerCase()
            )?.outfitTag ?? '',
          value: count,
          display: display ? display(count) : null
        })
      )
    )
  }

  private static entriesToLeaderboard(
    entries: SaladForkMetricEntry[]
  ): SaladForkMetricEntry[] {
    const sortedEntries = entries
      .filter(e => e.value)
      .sort((a, b) => b.value - a.value)

    // Get the unique top 3 values
    const topValues = sortedEntries
      .map(e => e.value)
      .filter((v, i, self) => self.indexOf(v) === i)
      .slice(0, 3)

    return sortedEntries
      .filter(e => topValues.includes(e.value))
      .map(e => ({
        ...e,
        prefix:
          e === sortedEntries.find(e => e.value === topValues[0])
            ? '🥇'
            : e === sortedEntries.find(e => e.value === topValues[1])
            ? '🥈'
            : e === sortedEntries.find(e => e.value === topValues[2])
            ? '🥉'
            : ''
      }))
  }
}
