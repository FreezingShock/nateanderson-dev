// Sparse voxel grid stored in 16x16x16 chunks. Coordinates are integer cell indices; a cell
// (i, j, k) covers [i, i+1) * cell in world units on each axis.

export const CHUNK = 16;

export class VoxelGrid {
  readonly cell: number;
  private readonly chunks = new Map<string, Uint8Array>();
  /** Keys of chunks whose mesh needs rebuilding. */
  readonly dirty = new Set<string>();

  constructor(cell: number) {
    this.cell = cell;
  }

  static chunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  get(i: number, j: number, k: number): number {
    const chunk = this.chunks.get(VoxelGrid.chunkKey(Math.floor(i / CHUNK), Math.floor(j / CHUNK), Math.floor(k / CHUNK)));
    if (!chunk) return 0;
    return chunk[(i & 15) + ((j & 15) << 4) + ((k & 15) << 8)];
  }

  set(i: number, j: number, k: number, id: number): void {
    const cx = Math.floor(i / CHUNK);
    const cy = Math.floor(j / CHUNK);
    const cz = Math.floor(k / CHUNK);
    const key = VoxelGrid.chunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      if (id === 0) return;
      chunk = new Uint8Array(CHUNK * CHUNK * CHUNK);
      this.chunks.set(key, chunk);
    }
    const lx = i & 15;
    const ly = j & 15;
    const lz = k & 15;
    const at = lx + (ly << 4) + (lz << 8);
    if (chunk[at] === id) return;
    chunk[at] = id;
    this.dirty.add(key);
    // A face or ambient occlusion sample on a chunk edge reads the neighbour, so mark it too.
    if (lx === 0) this.dirty.add(VoxelGrid.chunkKey(cx - 1, cy, cz));
    if (lx === 15) this.dirty.add(VoxelGrid.chunkKey(cx + 1, cy, cz));
    if (ly === 0) this.dirty.add(VoxelGrid.chunkKey(cx, cy - 1, cz));
    if (ly === 15) this.dirty.add(VoxelGrid.chunkKey(cx, cy + 1, cz));
    if (lz === 0) this.dirty.add(VoxelGrid.chunkKey(cx, cy, cz - 1));
    if (lz === 15) this.dirty.add(VoxelGrid.chunkKey(cx, cy, cz + 1));
  }

  getChunk(key: string): Uint8Array | undefined {
    return this.chunks.get(key);
  }

  /** Chunk keys that currently hold any data. */
  keys(): string[] {
    return [...this.chunks.keys()];
  }

  /** Parses a chunk key back into its chunk coordinates. */
  static parseKey(key: string): [number, number, number] {
    const [cx, cy, cz] = key.split(",").map(Number);
    return [cx, cy, cz];
  }
}
