export function calculateBackoff(attempt:number,baseMs:number,maxMs:number,jitterRatio:number):number {
 if(![attempt,baseMs,maxMs,jitterRatio].every(Number.isFinite)||!Number.isInteger(attempt)||attempt<0||baseMs<0||maxMs<0||jitterRatio<0||jitterRatio>1) throw new RangeError('invalid input');
 return Math.min(maxMs,baseMs*2**attempt)*(1+jitterRatio);
}
