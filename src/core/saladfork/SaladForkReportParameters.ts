import { TimeTracking } from "../InvididualGenerator";
import { TrackedPlayer } from "../objects/TrackedPlayer";

import { Outfit } from '../census/OutfitAPI'
import { TCaptureEvent, TEvent } from "../events/index";
import { BaseExchange } from "../objects";

export class SaladForkReportParameters {
    public players: TrackedPlayer[] = [];
    public events: TEvent[] = [];
    public captures: BaseExchange[] = [];
    public outfits: Outfit[] = [];
    public timeTracking: TimeTracking = { startTime: 0, endTime: 0, running: false };
}
