import { SaladForkMetric } from "./SaladForkMetric";

import { TrackedPlayer } from "../objects/TrackedPlayer";
import { Outfit } from "../census/OutfitAPI";

export class SaladForkReport {
    public start: Date = new Date();
    public end: Date = new Date();

    public summary: SaladForkMetric[] = [];
    public leaderboards: { [title: string]: SaladForkMetric[] } = {};

    public players: TrackedPlayer[] = [];
    public outfits: Outfit[] = [];
}
