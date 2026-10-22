import {
  VehicleClass,
  VehiclePhysicsProfile,
  VehicleControlInput,
  VehicleState,
  WorldVector3,
} from '@project-eko/contracts';

/**
 * THREE CANONICAL VEHICLE PROFILES
 * Tuned for tactile responsiveness, weight distinction, and realistic Lagos road interactions.
 */
export const VEHICLE_PROFILES: Record<VehicleClass, VehiclePhysicsProfile> = {
  compact_sedan: {
    vehicleClass: 'compact_sedan',
    manufacturer: 'Adera',
    displayName: 'Adera Compact 1.6',
    massKg: 1280,
    centerOfGravityHeight: 0.52,
    engineMaxPowerKw: 104,
    enginePeakTorqueNm: 174,
    peakRpm: 4800,
    idleRpm: 850,
    maxRpm: 6800,
    gearRatios: [3.4, 2.1, 1.45, 1.05, 0.82],
    finalDriveRatio: 3.9,
    brakeForceMax: 4800,
    handbrakeForceMax: 3200,
    steeringAngleMaxRad: 0.62, // ~35 degrees
    suspensionStiffness: 28000,
    suspensionDamping: 2400,
    suspensionRestLength: 0.35,
    tyreGripCoefficient: 0.95,
    aerodynamicDragCoefficient: 0.31,
    fuelCapacityLiters: 50,
    fuelConsumptionBaseRate: 0.00045, // Liters per tick at full throttle
  },
  danfo_minibus: {
    vehicleClass: 'danfo_minibus',
    manufacturer: 'Apex Transit',
    displayName: 'Apex Danfo 14 (Lagos Yellow)',
    massKg: 1950, // Base mass + passenger load
    centerOfGravityHeight: 0.88, // High roll center!
    engineMaxPowerKw: 88,
    enginePeakTorqueNm: 210,
    peakRpm: 3800,
    idleRpm: 800,
    maxRpm: 5200,
    gearRatios: [4.1, 2.4, 1.55, 1.0, 0.78],
    finalDriveRatio: 4.4,
    brakeForceMax: 5400,
    handbrakeForceMax: 2600,
    steeringAngleMaxRad: 0.55, // ~31 degrees
    suspensionStiffness: 42000,
    suspensionDamping: 3200,
    suspensionRestLength: 0.42,
    tyreGripCoefficient: 0.84, // Harder commercial tyres
    aerodynamicDragCoefficient: 0.46,
    fuelCapacityLiters: 65,
    fuelConsumptionBaseRate: 0.00078,
  },
  okada_motorcycle: {
    vehicleClass: 'okada_motorcycle',
    manufacturer: 'Koro',
    displayName: 'Koro 125 (Commuter Bike)',
    massKg: 125,
    centerOfGravityHeight: 0.45,
    engineMaxPowerKw: 8.5,
    enginePeakTorqueNm: 10.2,
    peakRpm: 5500,
    idleRpm: 1100,
    maxRpm: 8500,
    gearRatios: [3.8, 2.2, 1.4, 1.0],
    finalDriveRatio: 3.2,
    brakeForceMax: 1200,
    handbrakeForceMax: 800,
    steeringAngleMaxRad: 0.78, // ~45 degrees, extreme agility
    suspensionStiffness: 12000,
    suspensionDamping: 1100,
    suspensionRestLength: 0.22,
    tyreGripCoefficient: 0.88,
    aerodynamicDragCoefficient: 0.38,
    fuelCapacityLiters: 11,
    fuelConsumptionBaseRate: 0.00015,
  },
  luxury_suv: {
    vehicleClass: 'luxury_suv',
    manufacturer: 'Ovation',
    displayName: 'Ovation V8 Executive',
    massKg: 2450,
    centerOfGravityHeight: 0.72,
    engineMaxPowerKw: 280,
    enginePeakTorqueNm: 550,
    peakRpm: 4200,
    idleRpm: 750,
    maxRpm: 6200,
    gearRatios: [4.8, 3.1, 2.0, 1.4, 1.0, 0.75],
    finalDriveRatio: 3.7,
    brakeForceMax: 6800,
    handbrakeForceMax: 3800,
    steeringAngleMaxRad: 0.58,
    suspensionStiffness: 36000,
    suspensionDamping: 3100,
    suspensionRestLength: 0.40,
    tyreGripCoefficient: 0.98,
    aerodynamicDragCoefficient: 0.39,
    fuelCapacityLiters: 90,
    fuelConsumptionBaseRate: 0.00095,
  },
  keke_tricycle: {
    vehicleClass: 'keke_tricycle',
    manufacturer: 'Koro',
    displayName: 'Koro Keke 200',
    massKg: 420,
    centerOfGravityHeight: 0.65,
    engineMaxPowerKw: 12,
    enginePeakTorqueNm: 18,
    peakRpm: 5000,
    idleRpm: 950,
    maxRpm: 7000,
    gearRatios: [3.9, 2.3, 1.5, 1.0],
    finalDriveRatio: 4.1,
    brakeForceMax: 2200,
    handbrakeForceMax: 1400,
    steeringAngleMaxRad: 0.72,
    suspensionStiffness: 16000,
    suspensionDamping: 1400,
    suspensionRestLength: 0.28,
    tyreGripCoefficient: 0.82,
    aerodynamicDragCoefficient: 0.52,
    fuelCapacityLiters: 15,
    fuelConsumptionBaseRate: 0.00028,
  },
  brt_bus: {
    vehicleClass: 'brt_bus',
    manufacturer: 'Apex Transit',
    displayName: 'Apex Metro 80 (High-Capacity BRT)',
    massKg: 14500,
    centerOfGravityHeight: 1.15,
    engineMaxPowerKw: 260,
    enginePeakTorqueNm: 1250,
    peakRpm: 2200,
    idleRpm: 600,
    maxRpm: 2800,
    gearRatios: [5.2, 3.4, 2.1, 1.4, 1.0, 0.72],
    finalDriveRatio: 5.1,
    brakeForceMax: 16000,
    handbrakeForceMax: 8000,
    steeringAngleMaxRad: 0.48,
    suspensionStiffness: 85000,
    suspensionDamping: 6500,
    suspensionRestLength: 0.55,
    tyreGripCoefficient: 0.90,
    aerodynamicDragCoefficient: 0.65,
    fuelCapacityLiters: 280,
    fuelConsumptionBaseRate: 0.0022,
  },
};

export interface SurfaceEnvironment {
  frictionCoefficient: number; // 1.0 = dry asphalt, 0.6 = rain, 0.35 = flood
  bumpRoughness: number;       // 0.0 = smooth, 0.5 = potholes
  isWaterlogged: boolean;
}

export const DEFAULT_SURFACE: SurfaceEnvironment = {
  frictionCoefficient: 0.95,
  bumpRoughness: 0.05,
  isWaterlogged: false,
};

/**
 * VEHICLE DYNAMICS STEPPER
 * Computes 60Hz kinematics update: powertrain, Pacejka tyre friction,
 * weight transfer roll/pitch, collision resistance, damage wear, and fuel consumption.
 */
export function stepVehiclePhysics(
  currentState: VehicleState,
  inputs: VehicleControlInput,
  surface: SurfaceEnvironment,
  dtSeconds: number = 1 / 60
): VehicleState {
  const profile = VEHICLE_PROFILES[currentState.vehicleClass] || VEHICLE_PROFILES.compact_sedan;
  const next = JSON.parse(JSON.stringify(currentState)) as VehicleState;

  // 1. Immobilized / Out of Fuel Check
  if (next.damage.isImmobilized || next.fuelLiters <= 0) {
    inputs.throttle = 0;
  }

  // 2. Heading Vector & Speed
  const headingAngle = next.rotation.y;
  const forwardX = -Math.sin(headingAngle);
  const forwardZ = -Math.cos(headingAngle);
  const rightX = Math.cos(headingAngle);
  const rightZ = -Math.sin(headingAngle);

  // Velocity projection into local forward and lateral directions
  const currentSpeed = Math.sqrt(next.velocity.x * next.velocity.x + next.velocity.z * next.velocity.z);
  const isMovingForward = next.velocity.x * forwardX + next.velocity.z * forwardZ >= 0;
  const signedSpeed = isMovingForward ? currentSpeed : -currentSpeed;

  // 3. Powertrain & Engine Torque
  const gearIdx = Math.max(0, Math.min(profile.gearRatios.length - 1, inputs.gear - 1));
  const gearRatio = inputs.reverse ? -profile.gearRatios[0] : (inputs.gear > 0 ? profile.gearRatios[gearIdx] : 0);
  const totalRatio = gearRatio * profile.finalDriveRatio;

  // Compute RPM from wheel speed
  const wheelRadius = 0.32; // standard wheel radius in meters
  const wheelAngularVel = signedSpeed / wheelRadius;
  const engineRpm = Math.max(
    profile.idleRpm,
    Math.min(profile.maxRpm, Math.abs(wheelAngularVel * totalRatio * (60 / (2 * Math.PI))))
  );
  next.rpm = engineRpm;

  // Engine drive force
  let driveForce = 0;
  if (inputs.throttle > 0 && totalRatio !== 0) {
    const rpmFactor = 1 - Math.pow((engineRpm - profile.peakRpm) / profile.maxRpm, 2);
    const engineTorque = profile.enginePeakTorqueNm * Math.max(0.2, rpmFactor) * inputs.throttle;
    const wheelTorque = engineTorque * totalRatio;
    driveForce = (wheelTorque / wheelRadius) * (inputs.reverse ? -1 : 1);
  }

  // 4. Braking & Handbrake Forces
  let brakingForce = 0;
  if (inputs.brake > 0) {
    brakingForce = profile.brakeForceMax * inputs.brake;
  }
  if (inputs.handbrake) {
    brakingForce += profile.handbrakeForceMax;
  }

  // 5. Pacejka Tyre Grip & Surface Friction
  const effectiveGrip = profile.tyreGripCoefficient * surface.frictionCoefficient * (next.damage.tyreTreadPercent / 100);
  const maxTractionForce = profile.massKg * 9.81 * effectiveGrip;

  // Clamp longitudinal force by traction circle
  let netLongitudinalForce = driveForce;
  if (signedSpeed > 0.1) {
    netLongitudinalForce -= brakingForce;
  } else if (signedSpeed < -0.1) {
    netLongitudinalForce += brakingForce;
  } else if (brakingForce > 0) {
    netLongitudinalForce = 0;
  }

  // Aerodynamic Drag & Rolling Resistance
  const airDrag = 0.5 * 1.225 * profile.aerodynamicDragCoefficient * 2.2 * Math.pow(signedSpeed, 2) * Math.sign(signedSpeed);
  const rollingResistance = profile.massKg * 9.81 * 0.015 * Math.sign(signedSpeed);
  netLongitudinalForce -= (airDrag + rollingResistance);

  netLongitudinalForce = Math.max(-maxTractionForce, Math.min(maxTractionForce, netLongitudinalForce));
  const longitudinalAccel = netLongitudinalForce / profile.massKg;

  // 6. Steering & Lateral Dynamics (Yaw & Body Roll)
  const steerAngle = inputs.steer * profile.steeringAngleMaxRad;
  const speedRatio = Math.min(1.0, currentSpeed / 25.0); // Steering sensitivity falls at high speed
  const yawRate = (signedSpeed / 2.6) * Math.tan(steerAngle) * (1.0 - speedRatio * 0.45);
  next.rotation.y += yawRate * dtSeconds;

  // High center-of-gravity body roll (Danfo hazard)
  const lateralG = Math.abs(currentSpeed * yawRate) / 9.81;
  const rollAngle = (profile.centerOfGravityHeight / 1.2) * lateralG * Math.sign(inputs.steer) * 0.18;
  next.rotation.z = rollAngle;

  // 7. Integrate Velocity & Position
  const newSignedSpeed = signedSpeed + longitudinalAccel * dtSeconds;
  const finalForwardX = -Math.sin(next.rotation.y);
  const finalForwardZ = -Math.cos(next.rotation.y);

  next.velocity.x = finalForwardX * newSignedSpeed;
  next.velocity.z = finalForwardZ * newSignedSpeed;

  next.position.x += next.velocity.x * dtSeconds;
  next.position.z += next.velocity.z * dtSeconds;
  next.speedKmh = Math.abs(newSignedSpeed) * 3.6;

  // Pothole bump response
  if (surface.bumpRoughness > 0.1 && currentSpeed > 5) {
    next.position.y = Math.sin(Date.now() * 0.03) * (surface.bumpRoughness * 0.08);
  } else {
    next.position.y = 0;
  }

  // 8. Fuel Consumption & Mechanical Degradation
  const fuelBurn = (profile.fuelConsumptionBaseRate * inputs.throttle + 0.00005) * dtSeconds * 60;
  next.fuelLiters = Math.max(0, next.fuelLiters - fuelBurn);

  // Wear: tyre tread degrades slowly, faster when slipping/braking
  const slipWear = inputs.handbrake ? 0.002 : (Math.abs(longitudinalAccel) > 4 ? 0.0008 : 0.00005);
  next.damage.tyreTreadPercent = Math.max(10, next.damage.tyreTreadPercent - slipWear * dtSeconds);

  return next;
}
