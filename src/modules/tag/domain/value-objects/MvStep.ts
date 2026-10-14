export class MvStep {
  constructor(
    public readonly order: number,
    public readonly sql: string,
    public readonly stepResultTable: string,
    public readonly mvName: string,
    public readonly tagId?: string,
    public readonly version?: number
  ) {}

  isLast(totalSteps: number): boolean {
    return this.order === totalSteps;
  }

  getVariableReplacements(): Map<string, string> {
    const replacements = new Map<string, string>();
    
    if (this.tagId) {
      replacements.set('{tagId}', this.tagId);
    }
    if (this.version !== undefined) {
      replacements.set('{version}', String(this.version));
    }

    return replacements;
  }

  applyVariableReplacements(sql: string): string {
    const replacements = this.getVariableReplacements();
    let result = sql;

    replacements.forEach((value, key) => {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return result;
  }
}
