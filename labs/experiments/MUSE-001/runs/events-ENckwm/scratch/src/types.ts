/* any as ordinary prose */ export type
 PortfolioEvent
 = { kind: 'active'; name: string } | { kind: 'paused'; reason: string } | { kind: 'migration'; target: string };
export type EventResult = string;
