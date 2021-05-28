export class SaladForkMetric {
  public name: string = "";
  public entries: SaladForkMetricEntry[] = [];
}

export class SaladForkMetricEntry {
  public name: string = "";
  public value: number = 0;
  public display?: string | null = null;
  public prefix?: string = "";
}
