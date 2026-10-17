import type {PortfolioEvent as Input,EventResult as Output} from './types.ts';
function assertNever(value:never):never {throw new Error(String(value));}
export function processEvent(input:Input):Output {
 switch(input.kind){case 'active':return 'active:'+input.name;case 'paused':return 'paused:'+input.reason;case 'migration':return 'migration:'+input.target;default:return assertNever(input);}
}