/**
 * PROJECT EKO — CANONICAL 3D HUMANOID GLB GENERATOR
 * Generates IP-clean (Class B In-House Provenance) glTF 2.0 binary (.glb)
 * rigged humanoid character archetypes in apps/game/assets/characters/.
 *
 * Canonical Coordinate Convention:
 *   +Y = Up (Soles of feet at Y = 0.0)
 *   +Z = Character Forward (Face & Chest facing +Z)
 *   +X = Character Left (Right-handed coordinate system)
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'apps', 'game', 'assets', 'characters');
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Helper to append a tapered cylinder / limb segment to vertex arrays
 */
function addTaperedLimb(positions, normals, colors, joints, weights, opts) {
  const {
    cx, yBottom, yTop, cz,
    rBottomX, rBottomZ, rTopX, rTopZ,
    radSegs = 12, heightSegs = 4,
    color = [0.24, 0.15, 0.11],
    boneA = 0, boneB = 0
  } = opts;

  const indices = [];
  const baseVertex = positions.length / 3;

  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs;
    const y = yBottom + (yTop - yBottom) * v;
    const rx = rBottomX + (rTopX - rBottomX) * v;
    const rz = rBottomZ + (rTopZ - rBottomZ) * v;

    // Smooth skin weight blend between boneA (top) and boneB (bottom)
    const wA = 1.0 - v * 0.5;
    const wB = 1.0 - wA;

    for (let ix = 0; ix <= radSegs; ix++) {
      const u = (ix / radSegs) * Math.PI * 2;
      const nx = Math.sin(u);
      const nz = Math.cos(u);
      const px = cx + nx * rx;
      const pz = cz + nz * rz;

      positions.push(px, y, pz);
      normals.push(nx, 0.08, nz);
      // Subtle vertical ambient occlusion gradient
      const ao = 0.78 + 0.22 * v;
      colors.push(color[0] * ao, color[1] * ao, color[2] * ao);
      joints.push(boneA, boneB, 0, 0);
      weights.push(wA, wB, 0, 0);
    }
  }

  const ringStride = radSegs + 1;
  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ix = 0; ix < radSegs; ix++) {
      const a = baseVertex + iy * ringStride + ix;
      const b = baseVertex + (iy + 1) * ringStride + ix;
      const c = baseVertex + (iy + 1) * ringStride + (ix + 1);
      const d = baseVertex + iy * ringStride + (ix + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  return indices;
}

function buildHumanoidGLBBuffer(archetype) {
  const positions = [];
  const normals = [];
  const colors = [];
  const joints = [];
  const weights = [];
  const allIndices = [];

  const s = archetype.scale || { shoulderW: 1.0, waistW: 1.0, hipW: 1.0, height: 1.0 };
  const skin = archetype.skinColor || [0.28, 0.17, 0.12];
  const topCol = archetype.topColor || [0.02, 0.53, 0.32];
  const botCol = archetype.bottomColor || [0.08, 0.11, 0.18];
  const shoeCol = [0.95, 0.96, 0.98];

  // Pelvis & Lower Torso (Bone 1: Hips, Bone 2: Spine)
  allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
    cx: 0, yBottom: 0.88 * s.height, yTop: 1.15 * s.height, cz: 0,
    rBottomX: 0.18 * s.hipW, rBottomZ: 0.13 * s.hipW,
    rTopX: 0.16 * s.waistW, rTopZ: 0.12 * s.waistW,
    color: topCol, boneA: 1, boneB: 2
  }));

  // Upper Torso & Chest (Bone 2: Spine, Bone 3: Neck)
  allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
    cx: 0, yBottom: 1.15 * s.height, yTop: 1.50 * s.height, cz: 0,
    rBottomX: 0.16 * s.waistW, rBottomZ: 0.12 * s.waistW,
    rTopX: 0.22 * s.shoulderW, rTopZ: 0.14 * s.shoulderW,
    color: topCol, boneA: 2, boneB: 2
  }));

  // Neck (Bone 3)
  allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
    cx: 0, yBottom: 1.48 * s.height, yTop: 1.60 * s.height, cz: 0,
    rBottomX: 0.065, rBottomZ: 0.065, rTopX: 0.058, rTopZ: 0.058,
    color: skin, boneA: 3, boneB: 4
  }));

  // Sculpted Cranium & Jaw (Bone 4: Head)
  allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
    cx: 0, yBottom: 1.59 * s.height, yTop: 1.84 * s.height, cz: 0.01,
    rBottomX: 0.082, rBottomZ: 0.092, rTopX: 0.108, rTopZ: 0.118,
    radSegs: 14, heightSegs: 6,
    color: skin, boneA: 4, boneB: 4
  }));

  // Left & Right Upper Arms + Forearms (Bones 5,6 and 7,8)
  [-1, 1].forEach((side) => {
    const shBone = side < 0 ? 5 : 7;
    const elBone = side < 0 ? 6 : 8;
    const sx = side * 0.24 * s.shoulderW;

    allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
      cx: sx, yBottom: 1.18 * s.height, yTop: 1.46 * s.height, cz: 0,
      rBottomX: 0.048, rBottomZ: 0.048, rTopX: 0.062, rTopZ: 0.062,
      color: topCol, boneA: shBone, boneB: elBone
    }));

    allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
      cx: sx, yBottom: 0.90 * s.height, yTop: 1.18 * s.height, cz: 0.01,
      rBottomX: 0.038, rBottomZ: 0.038, rTopX: 0.046, rTopZ: 0.046,
      color: skin, boneA: elBone, boneB: elBone
    }));
  });

  // Left & Right Thighs, Calves & Feet (Bones 9,10,11 and 12,13,14)
  [-1, 1].forEach((side) => {
    const hipBone = side < 0 ? 9 : 12;
    const kneeBone = side < 0 ? 10 : 13;
    const ankleBone = side < 0 ? 11 : 14;
    const lx = side * 0.105 * s.hipW;

    // Thigh
    allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
      cx: lx, yBottom: 0.48 * s.height, yTop: 0.90 * s.height, cz: 0,
      rBottomX: 0.065, rBottomZ: 0.068, rTopX: 0.088 * s.hipW, rTopZ: 0.092 * s.hipW,
      color: botCol, boneA: hipBone, boneB: kneeBone
    }));

    // Calf
    allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
      cx: lx, yBottom: 0.09 * s.height, yTop: 0.48 * s.height, cz: 0,
      rBottomX: 0.045, rBottomZ: 0.048, rTopX: 0.064, rTopZ: 0.066,
      color: botCol, boneA: kneeBone, boneB: ankleBone
    }));

    // Foot (Facing +Z)
    allIndices.push(...addTaperedLimb(positions, normals, colors, joints, weights, {
      cx: lx, yBottom: 0.0, yTop: 0.09 * s.height, cz: 0.045,
      rBottomX: 0.056, rBottomZ: 0.115, rTopX: 0.050, rTopZ: 0.095,
      color: shoeCol, boneA: ankleBone, boneB: ankleBone
    }));
  });

  const posArray = new Float32Array(positions);
  const normArray = new Float32Array(normals);
  const colArray = new Float32Array(colors);
  const jointArray = new Uint16Array(joints);
  const weightArray = new Float32Array(weights);
  const indexArray = new Uint16Array(allIndices);

  // Compute bounding box for POSITION accessor
  const minPos = [Infinity, Infinity, Infinity];
  const maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posArray.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (posArray[i + k] < minPos[k]) minPos[k] = posArray[i + k];
      if (posArray[i + k] > maxPos[k]) maxPos[k] = posArray[i + k];
    }
  }

  // Pack binary buffer aligned to 4-byte boundaries
  function pad4(buf) {
    const rem = buf.length % 4;
    return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem)]);
  }

  const bPos = pad4(Buffer.from(posArray.buffer));
  const bNorm = pad4(Buffer.from(normArray.buffer));
  const bCol = pad4(Buffer.from(colArray.buffer));
  const bJoint = pad4(Buffer.from(jointArray.buffer));
  const bWeight = pad4(Buffer.from(weightArray.buffer));
  const bIdx = pad4(Buffer.from(indexArray.buffer));

  const binChunk = Buffer.concat([bPos, bNorm, bCol, bJoint, bWeight, bIdx]);

  let offset = 0;
  const bufferViews = [];
  function addView(buf, target) {
    const view = { buffer: 0, byteOffset: offset, byteLength: buf.length };
    if (target) view.target = target;
    bufferViews.push(view);
    offset += buf.length;
    return bufferViews.length - 1;
  }

  const vPos = addView(bPos, 34962);
  const vNorm = addView(bNorm, 34962);
  const vCol = addView(bCol, 34962);
  const vJoint = addView(bJoint, 34962);
  const vWeight = addView(bWeight, 34962);
  const vIdx = addView(bIdx, 34963);

  const vertCount = posArray.length / 3;
  const shY = 1.40 * s.height;
  const hipY = 0.92 * s.height;
  const shHalfX = 0.195 * s.shoulderW;
  const hipHalfX = 0.095 * s.hipW;

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Project Eko Anatomical Humanoid Rig Generator v2.0',
      copyright: 'Class B In-House Original Asset — Project Eko (Zero Third-Party IP)'
    },
    scene: 0,
    scenes: [{ name: archetype.id, nodes: [0] }],
    nodes: [
      { name: archetype.id + '_MeshNode', mesh: 0, skin: 0, children: [1], extras: { forwardAxis: '+Z', boneCount: 15, archetype: archetype.id } },
      { name: 'Root', translation: [0, 0, 0], children: [2] },
      { name: 'Hips', translation: [0, hipY, 0], children: [3, 10, 13] },
      { name: 'Spine', translation: [0, 0.18 * s.height, 0], children: [4, 6, 8] },
      { name: 'Neck', translation: [0, 0.36 * s.height, 0], children: [5] },
      { name: 'Head', translation: [0, 0.08 * s.height, 0] },
      { name: 'ShoulderL', translation: [shHalfX, shY - hipY - 0.18 * s.height, 0], children: [7] },
      { name: 'ElbowL', translation: [0, -0.26 * s.height, 0] },
      { name: 'ShoulderR', translation: [-shHalfX, shY - hipY - 0.18 * s.height, 0], children: [9] },
      { name: 'ElbowR', translation: [0, -0.26 * s.height, 0] },
      { name: 'HipL', translation: [hipHalfX, 0, 0], children: [11] },
      { name: 'KneeL', translation: [0, -0.42 * s.height, 0], children: [12] },
      { name: 'AnkleL', translation: [0, -0.41 * s.height, 0] },
      { name: 'HipR', translation: [-hipHalfX, 0, 0], children: [14] },
      { name: 'KneeR', translation: [0, -0.42 * s.height, 0], children: [15] },
      { name: 'AnkleR', translation: [0, -0.41 * s.height, 0] }
    ],
    skins: [
      {
        name: archetype.id + '_Armature',
        skeleton: 1,
        joints: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      }
    ],
    meshes: [
      {
        name: archetype.id + '_Mesh',
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              COLOR_0: 2,
              JOINTS_0: 3,
              WEIGHTS_0: 4
            },
            indices: 5,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        name: archetype.id + '_PBR',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.08,
          roughnessFactor: 0.68
        }
      }
    ],
    accessors: [
      { bufferView: vPos, componentType: 5126, count: vertCount, type: 'VEC3', min: minPos, max: maxPos },
      { bufferView: vNorm, componentType: 5126, count: vertCount, type: 'VEC3' },
      { bufferView: vCol, componentType: 5126, count: vertCount, type: 'VEC3' },
      { bufferView: vJoint, componentType: 5123, count: vertCount, type: 'VEC4' },
      { bufferView: vWeight, componentType: 5126, count: vertCount, type: 'VEC4' },
      { bufferView: vIdx, componentType: 5123, count: indexArray.length, type: 'SCALAR' }
    ],
    bufferViews,
    buffers: [{ byteLength: binChunk.length }]
  };

  let jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  while (jsonBuf.length % 4 !== 0) {
    jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')]);
  }

  const totalByteLength = 12 + 8 + jsonBuf.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalByteLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return {
    glb: Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binChunk]),
    vertexCount: vertCount,
    triangleCount: indexArray.length / 3
  };
}

const ARCHETYPES = [
  {
    id: 'eko_humanoid_female',
    file: 'eko_humanoid_female.glb',
    description: 'Proportionate Nigerian Female Citizen Rig (15-Bone Skeleton, +Z Forward)',
    scale: { shoulderW: 0.92, waistW: 0.84, hipW: 1.06, height: 0.97 },
    skinColor: [0.31, 0.19, 0.14],
    topColor: [0.0, 0.53, 0.32],
    bottomColor: [0.06, 0.09, 0.16]
  },
  {
    id: 'eko_humanoid_male',
    file: 'eko_humanoid_male.glb',
    description: 'Proportionate Nigerian Male Citizen Rig (15-Bone Skeleton, +Z Forward)',
    scale: { shoulderW: 1.06, waistW: 0.94, hipW: 0.95, height: 1.02 },
    skinColor: [0.24, 0.15, 0.11],
    topColor: [0.12, 0.23, 0.54],
    bottomColor: [0.12, 0.16, 0.23]
  },
  {
    id: 'eko_humanoid_athletic',
    file: 'eko_humanoid_athletic.glb',
    description: 'Athletic Lagos Transport & Hustle Citizen Rig (15-Bone Skeleton, +Z Forward)',
    scale: { shoulderW: 1.12, waistW: 0.88, hipW: 0.94, height: 1.03 },
    skinColor: [0.22, 0.13, 0.09],
    topColor: [0.92, 0.35, 0.05],
    bottomColor: [0.10, 0.12, 0.18]
  },
  {
    id: 'eko_humanoid_elder',
    file: 'eko_humanoid_elder.glb',
    description: 'Distinguished Lagos Elder & Market Merchant Rig (15-Bone Skeleton, +Z Forward)',
    scale: { shoulderW: 1.02, waistW: 1.08, hipW: 1.04, height: 0.96 },
    skinColor: [0.27, 0.16, 0.12],
    topColor: [0.96, 0.62, 0.04],
    bottomColor: [0.45, 0.22, 0.06]
  }
];

const manifest = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  ipClassification: 'Class B — In-House Original Procedural & Rigged GLB Assets',
  licence: 'Project Eko Proprietary / First-Party Original (Zero Unlicensed Third-Party Content)',
  canonicalAxes: { forward: '+Z', up: '+Y', left: '+X' },
  skeletonBones: [
    'Root', 'Hips', 'Spine', 'Neck', 'Head',
    'ShoulderL', 'ElbowL', 'ShoulderR', 'ElbowR',
    'HipL', 'KneeL', 'AnkleL', 'HipR', 'KneeR', 'AnkleR'
  ],
  models: []
};

ARCHETYPES.forEach((arch) => {
  const res = buildHumanoidGLBBuffer(arch);
  const outPath = path.join(OUT_DIR, arch.file);
  fs.writeFileSync(outPath, res.glb);
  manifest.models.push({
    id: arch.id,
    uri: `/assets/characters/${arch.file}`,
    description: arch.description,
    bytes: res.glb.length,
    vertices: res.vertexCount,
    triangles: res.triangleCount,
    scale: arch.scale
  });
  console.log(`Generated ${arch.file}: ${res.glb.length} bytes (${res.vertexCount} verts, ${res.triangleCount} tris)`);
});

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote apps/game/assets/characters/manifest.json');
