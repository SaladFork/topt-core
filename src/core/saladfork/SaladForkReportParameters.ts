import { TimeTracking } from "../InvididualGenerator";
import { TrackedPlayer } from "../objects/TrackedPlayer";

import { Outfit } from '../census/OutfitAPI'
import { TEvent } from "../events/index";
import { BaseExchange } from "../objects";

export class SaladForkReportParameters {
    public players: TrackedPlayer[] = [];
    public events: TEvent[] = [];
    public captures: BaseExchange[] = [];
    public outfits: Outfit[] = [];
    public timeTracking: TimeTracking = { startTime: 0, endTime: 0, running: false };
    public settings: SaladForkReportSettings = new SaladForkReportSettings();
}

export class SaladForkReportSettings {
    public title: string = 'SaladFork Ops Report';
    public displayOutfitTags: boolean = false;
}
