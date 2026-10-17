export type PortfolioEvent = { kind: 'unexpected'; extra: string } | { kind: 'active'; name: string } | { kind: 'paused'; reason: string } | { kind: 'migration'; target: string };
export type EventResult = string;
