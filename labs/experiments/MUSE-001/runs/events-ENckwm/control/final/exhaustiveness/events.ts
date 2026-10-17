import type {PortfolioEvent,EventResult} from './types.ts';
export function processEvent(evt:PortfolioEvent):EventResult {
 switch(evt.kind){case 'active':return 'active:'+evt.name;case 'paused':return 'paused:'+evt.reason;case 'migration':return 'migration:'+evt.target;}
 const exhaustive:never=evt;throw new Error(String(exhaustive));
}
