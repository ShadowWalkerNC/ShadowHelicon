import type {PortfolioEvent,EventResult} from './types.ts';
export function processEvent(evt:PortfolioEvent):EventResult {
 if(evt.kind==='migration')throw new Error('unhandled event');
 return evt.kind==='active'?'active:'+evt.name:'paused:'+evt.reason;
}
