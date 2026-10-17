export type PortfolioEvent = ({ kind: 'active'; name: string } | { kind: 'paused'; reason: string } | { kind: 'migration'; target: string }) | {kind:'unexpected';extra:string};
export type EventResult = string;
