export function calculateBackoff(attempt:number,baseMs:number,maxMs:number,jitterRatio:number):number {
 if(![attempt,baseMs,maxMs,jitterRatio].every(Number.isFinite)||!Number.isInteger(attempt)||attempt<0||baseMs<0||maxMs<0||jitterRatio<0||jitterRatio>1) throw new RangeError('invalid input');
 if(baseMs===0||maxMs===0)return 0;
 const result=Math.min(maxMs,baseMs*2**attempt)*(1+jitterRatio);if(!Number.isFinite(result))throw new RangeError('overflow');return result;
}
