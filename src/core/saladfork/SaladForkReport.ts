import { SaladForkMetric } from "./SaladForkMetric";

import { TrackedPlayer } from "../objects/TrackedPlayer";

export class SaladForkReport {
    public start: Date = new Date();
    public end: Date = new Date();

    public summary: SaladForkMetric[] = [];
    public leaderboards: { [title: string]: SaladForkMetric[] } = {};

    public players: TrackedPlayer[] = [];
}
