export function sliceRange(input: number[], start: number, end: number): number[] {
 if(start < 0 || end < 0) throw new Error('negative');
 return input.slice(start,end + 1);
}
