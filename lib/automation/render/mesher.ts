// Turns a sparse voxel grid into one BufferGeometry per chunk. Only faces that touch air are
// emitted, so buried voxels cost nothing (the hollow cull the reference does by hand). Each vertex
// gets classic voxel ambient occlusion, and the quads flip their diagonal to avoid AO seams.
import * as THREE from "three";
import { CHUNK, VoxelGrid } from "./grid";
import { cellHash } from "./noise";

/** Registry of block colors. Ids are small integers stored in the grid. */
export class BlockRegistry {
  private ids = new Map<number, number>();
  private next: number;
  readonly colors: THREE.Color[] = [];

  constructor(firstId: number) {
    this.next = firstId;
  }

  /** Returns the block id for a hex color, registering it on first use. */
  id(hex: number): number {
    let id = this.ids.get(hex);
    if (id === undefined) {
      id = this.next++;
      this.ids.set(hex, id);
      this.colors[id] = new THREE.Color(hex);
    }
    return id;
  }

  /** Registers a fixed id, for the terrain palette. */
  define(id: number, hex: number): void {
    this.colors[id] = new THREE.Color(hex);
  }

  color(id: number): THREE.Color | undefined {
    return this.colors[id];
  }
}

// Each face: normal axis, sign, and the two tangent axes ordered so t1 x t2 points along the normal.
const AO_SHADE = [0.5, 0.68, 0.84, 1];

interface Buffers {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

/** Builds the geometry for one chunk. Positions are in world units, so the mesh sits at the origin. */
export function meshChunk(grid: VoxelGrid, key: string, blocks: BlockRegistry): THREE.BufferGeometry | null {
  const data = grid.getChunk(key);
  if (!data) return null;
  const [cx, cy, cz] = VoxelGrid.parseKey(key);
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const z0 = cz * CHUNK;
  const cell = grid.cell;
  const buf: Buffers = { positions: [], normals: [], colors: [], indices: [] };
  const solid = (i: number, j: number, k: number) => grid.get(i, j, k) !== 0;
  const n = [0, 0, 0];
  const t1 = [0, 0, 0];
  const t2 = [0, 0, 0];
  const base = [0, 0, 0];

  for (let lz = 0; lz < CHUNK; lz++) {
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = data[lx + (ly << 4) + (lz << 8)];
        if (id === 0) continue;
        const gi = x0 + lx;
        const gj = y0 + ly;
        const gk = z0 + lz;
        const color = blocks.color(id);
        if (!color) continue;
        const jitter = 1 + (cellHash(gi, gj, gk) - 0.5) * 0.14;
        base[0] = gi;
        base[1] = gj;
        base[2] = gk;

        for (let face = 0; face < 6; face++) {
          const axis = face >> 1; // 0 = x, 1 = y, 2 = z
          const sg = face & 1 ? -1 : 1;
          n[0] = n[1] = n[2] = 0;
          n[axis] = sg;
          const nb = [gi + n[0], gj + n[1], gk + n[2]];
          if (solid(nb[0], nb[1], nb[2])) continue;

          // Tangent axes in right-handed order around the normal.
          const a1 = (axis + 1) % 3;
          const a2 = (axis + 2) % 3;
          t1[0] = t1[1] = t1[2] = 0;
          t2[0] = t2[1] = t2[2] = 0;
          t1[a1] = 1;
          t2[a2] = 1;

          // Corner order: counter-clockwise seen from outside the face.
          const corners: [number, number][] = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
          const ao: number[] = [];
          const vStart = buf.positions.length / 3;

          for (const [cu, cv] of corners) {
            // Vertex position on the face plane.
            const p = [gi, gj, gk];
            p[axis] += sg > 0 ? 1 : 0;
            p[a1] += cu;
            p[a2] += cv;
            buf.positions.push(p[0] * cell, p[1] * cell, p[2] * cell);
            buf.normals.push(n[0], n[1], n[2]);

            // Ambient occlusion from the two edge neighbours and the corner between them.
            const s1 = cu ? 1 : -1;
            const s2 = cv ? 1 : -1;
            const side1 = solid(nb[0] + t1[0] * s1, nb[1] + t1[1] * s1, nb[2] + t1[2] * s1) ? 1 : 0;
            const side2 = solid(nb[0] + t2[0] * s2, nb[1] + t2[1] * s2, nb[2] + t2[2] * s2) ? 1 : 0;
            const corner = solid(
              nb[0] + t1[0] * s1 + t2[0] * s2,
              nb[1] + t1[1] * s1 + t2[1] * s2,
              nb[2] + t1[2] * s1 + t2[2] * s2,
            )
              ? 1
              : 0;
            const level = side1 && side2 ? 0 : 3 - (side1 + side2 + corner);
            ao.push(level);
            const shade = AO_SHADE[level] * jitter;
            buf.colors.push(color.r * shade, color.g * shade, color.b * shade);
          }

          // Split along the diagonal with the smaller AO difference to avoid dark seams.
          if (ao[0] + ao[2] > ao[1] + ao[3]) {
            buf.indices.push(vStart + 0, vStart + 1, vStart + 3, vStart + 1, vStart + 2, vStart + 3);
          } else {
            buf.indices.push(vStart + 0, vStart + 1, vStart + 2, vStart + 0, vStart + 2, vStart + 3);
          }
        }
      }
    }
  }

  if (buf.indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices.length > 65535 ? new THREE.Uint32BufferAttribute(buf.indices, 1) : new THREE.Uint16BufferAttribute(buf.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Owns one mesh per chunk and rebuilds only the dirty ones. */
export class ChunkMesher {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private readonly material: THREE.Material;
  private readonly blocks: BlockRegistry;
  private readonly grid: VoxelGrid;

  constructor(grid: VoxelGrid, blocks: BlockRegistry, material: THREE.Material) {
    this.grid = grid;
    this.blocks = blocks;
    this.material = material;
  }

  /** Rebuilds up to `max` dirty chunks. Returns how many were rebuilt. */
  update(max = Infinity): number {
    let done = 0;
    for (const key of this.grid.dirty) {
      if (done >= max) break;
      this.grid.dirty.delete(key);
      done++;
      const old = this.meshes.get(key);
      if (old) {
        this.group.remove(old);
        old.geometry.dispose();
        this.meshes.delete(key);
      }
      const geo = meshChunk(this.grid, key, this.blocks);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes.set(key, mesh);
    }
    return done;
  }

  get chunkCount(): number {
    return this.meshes.size;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    this.meshes.clear();
    this.group.clear();
  }
}
