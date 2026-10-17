export function sliceRange(input: number[], start: number, end: number): number[] {
 return input.slice(Math.max(0,start),Math.max(0,end));
}
