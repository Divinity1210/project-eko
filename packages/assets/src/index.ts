import { VehicleClass } from '@project-eko/contracts';

/**
 * 3D PROCEDURAL ASSET DESCRIPTIONS & MATERIAL BLUEPRINTS
 * High-performance lightweight procedural meshes for the Marina/CMS vertical slice.
 */

export interface AssetMeshBlueprint {
  id: string;
  name: string;
  category: 'landmark' | 'building' | 'vehicle' | 'road' | 'prop';
  polyCountApprox: number;
  primaryColor: string;
  secondaryColor?: string;
  metallic: number;
  roughness: number;
}

export const VERTICAL_SLICE_ASSETS: Record<string, AssetMeshBlueprint> = {
  // LANDMARKS
  tbs_ceremonial_monument: {
    id: 'tbs_ceremonial_monument',
    name: 'Tafawa Balewa Square Arched Gate & Stands',
    category: 'landmark',
    polyCountApprox: 1850,
    primaryColor: '#D8D4C8', // Sandstone concrete
    secondaryColor: '#05472A', // National green accent
    metallic: 0.1,
    roughness: 0.85,
  },
  cms_bus_terminal_shelter: {
    id: 'cms_bus_terminal_shelter',
    name: 'CMS Multi-Bay Bus Canopy',
    category: 'landmark',
    polyCountApprox: 1200,
    primaryColor: '#3A4454', // Steel canopy
    secondaryColor: '#F4B41A', // Yellow guide stripes
    metallic: 0.6,
    roughness: 0.4,
  },
  marina_blue_line_elevated_tracks: {
    id: 'marina_blue_line_elevated_tracks',
    name: 'Marina Rail Bridge Pillars & Pylons',
    category: 'landmark',
    polyCountApprox: 1400,
    primaryColor: '#2B547E', // Blue Line steel blue
    secondaryColor: '#7E8894', // Concrete piers
    metallic: 0.4,
    roughness: 0.6,
  },

  // BUILDINGS & FACADES
  broad_street_corporate_tower_1: {
    id: 'broad_street_corporate_tower_1',
    name: 'Broad Street Commercial Bank High-Rise',
    category: 'building',
    polyCountApprox: 850,
    primaryColor: '#1A2C3D', // Reflective blue glass
    secondaryColor: '#E2E8F0', // Aluminum mullions
    metallic: 0.85,
    roughness: 0.15,
  },
  broad_street_corporate_tower_2: {
    id: 'broad_street_corporate_tower_2',
    name: 'Old Marina Concrete Commercial Building',
    category: 'building',
    polyCountApprox: 620,
    primaryColor: '#B0A898', // Weathered concrete
    metallic: 0.05,
    roughness: 0.9,
  },

  // VEHICLES
  vehicle_compact_sedan: {
    id: 'vehicle_compact_sedan',
    name: 'Kano Motors Arrow 1.8 (Sedan)',
    category: 'vehicle',
    polyCountApprox: 2200,
    primaryColor: '#C0C0C0', // Metallic silver
    secondaryColor: '#111111',
    metallic: 0.8,
    roughness: 0.25,
  },
  vehicle_danfo_minibus: {
    id: 'vehicle_danfo_minibus',
    name: 'Eko Cruiser 14 (Yellow Danfo)',
    category: 'vehicle',
    polyCountApprox: 2600,
    primaryColor: '#FFD700', // Iconic Lagos Bright Yellow
    secondaryColor: '#1A1A1A', // Bold Dual Black Side Stripes
    metallic: 0.35,
    roughness: 0.45,
  },
  vehicle_okada_motorcycle: {
    id: 'vehicle_okada_motorcycle',
    name: 'Lagos Boxer 125 (Okada Bike)',
    category: 'vehicle',
    polyCountApprox: 1100,
    primaryColor: '#D90429', // Vivid Red tank
    secondaryColor: '#2B2D42', // Black frame & engine
    metallic: 0.7,
    roughness: 0.3,
  },
};
