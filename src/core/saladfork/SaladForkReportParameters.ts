import { TimeTracking } from "../InvididualGenerator";
import { TrackedPlayer } from "../objects/TrackedPlayer";

import { TEvent } from "../events/index";

export class SaladForkReportParameters {
    public players: TrackedPlayer[] = [];
    public events: TEvent[] = [];
    public timeTracking: TimeTracking = { startTime: 0, endTime: 0, running: false };
}
