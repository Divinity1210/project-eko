import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import { TelemetryEvidencePackager } from '@project-eko/telemetry';
import { globalEconomyLedger } from '@project-eko/economy';

const DATA_DIR = process.env.PROJECT_EKO_DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'm4_7_persistent_store.json');

export interface CanonicalStarterProfile {
  profileId: string;
  title: string;
  subtitle: string;
  starterHomeId: string;
  starterHomeName: string;
  openingBalanceGN: number;
  recommendedCareerId: string;
  recommendedCareerName: string;
  initialLifeGoalId: string;
  initialLifeGoalLabel: string;
  entryOpportunities: string[];
  startingInventory: string[];
  summaryExplanation: string;
}

export const CANONICAL_STARTER_PROFILES: Record<string, CanonicalStarterProfile> = {
  profile_new_arrival: {
    profileId: 'profile_new_arrival',
    title: 'New Arrival in Lagos',
    subtitle: 'Fresh off the bus at CMS with hustle ambition and zero vehicle required',
    starterHomeId: 'home_tier0_shared_room',
    starterHomeName: 'Tier 0 — Shared Compound Room (Yaba/Surulere Edge)',
    openingBalanceGN: 5000,
    recommendedCareerId: 'career_mobility_transport',
    recommendedCareerName: 'Mobility & Transport Operations',
    initialLifeGoalId: 'goal_first_danfo',
    initialLifeGoalLabel: 'Earn & lease your first 14-seater Yellow Danfo',
    entryOpportunities: ['job_entry_foot_courier', 'job_entry_bus_stop_caller', 'job_entry_depot_cleaner'],
    startingInventory: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_table_lamp', 'item_wall_mirror'],
    summaryExplanation: 'Starts with a Tier 0 Shared Compound Room (7-day rent grace), ₦5,000 Game Naira opening citizen grant, essential starter furniture, and immediate eligibility for Foot Courier and Bus-Stop Assistant shifts.',
  },
  profile_early_career: {
    profileId: 'profile_early_career',
    title: 'Young Worker / Early Career',
    subtitle: 'Focused on market trade, retail operations, and steady cashflow',
    starterHomeId: 'home_tier2_self_con_studio',
    starterHomeName: 'Tier 2 — Compact Self-Contained Studio (Surulere)',
    openingBalanceGN: 5000,
    recommendedCareerId: 'career_commerce_market',
    recommendedCareerName: 'Commerce, Market & Retail Trade',
    initialLifeGoalId: 'goal_first_shop',
    initialLifeGoalLabel: 'Open your first neighbourhood retail kiosk',
    entryOpportunities: ['job_entry_shop_assistant', 'job_entry_foot_courier', 'job_entry_civic_greeter'],
    startingInventory: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_table_lamp', 'item_wall_mirror'],
    summaryExplanation: 'Starts with a Compact Self-Contained Studio, ₦5,000 Game Naira opening citizen grant, and direct access to Balogun Market Shop-Floor Assistant and Foot Courier work.',
  },
  profile_student_learner: {
    profileId: 'profile_student_learner',
    title: 'Student / Skill Learner',
    subtitle: 'Building technical, civic, and business skills while working flexible shifts',
    starterHomeId: 'home_tier0_shared_room',
    starterHomeName: 'Tier 0 — Shared Compound Room (Yaba Tech Corridor)',
    openingBalanceGN: 5000,
    recommendedCareerId: 'career_civic_community',
    recommendedCareerName: 'Civic, Education & Community Services',
    initialLifeGoalId: 'goal_self_con_upgrade',
    initialLifeGoalLabel: 'Upgrade to a Self-Contained Studio & complete Level 2 Skills',
    entryOpportunities: ['job_entry_civic_greeter', 'job_entry_workshop_apprentice', 'job_entry_foot_courier'],
    startingInventory: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_table_lamp', 'item_wall_mirror'],
    summaryExplanation: 'Starts in the Yaba Tech Corridor with ₦5,000 Game Naira, low household overhead, and immediate access to Workshop Apprentice and Civic Greeter stipends.',
  },
  profile_skilled_trade: {
    profileId: 'profile_skilled_trade',
    title: 'Skilled Trade Starter',
    subtitle: 'Hands-on technician fixing vehicles, generators, and neighbourhood utilities',
    starterHomeId: 'home_tier1_improved_room',
    starterHomeName: 'Tier 1 — Improved Courtyard Room (Surulere)',
    openingBalanceGN: 5000,
    recommendedCareerId: 'career_skilled_trades_utilities',
    recommendedCareerName: 'Skilled Trades, Mechanics & Utilities',
    initialLifeGoalId: 'goal_reliable_daily_car',
    initialLifeGoalLabel: 'Build a certified roadside mechanic & utility service bay',
    entryOpportunities: ['job_entry_workshop_apprentice', 'job_entry_depot_cleaner', 'job_entry_foot_courier'],
    startingInventory: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_table_lamp', 'item_wall_mirror'],
    summaryExplanation: 'Starts in an Improved Courtyard Room with ₦5,000 Game Naira and direct entry into Roadside Workshop Apprentice and Depot Yard Maintenance shifts.',
  },
  profile_creator_remote: {
    profileId: 'profile_creator_remote',
    title: 'Creative / Remote Hustler',
    subtitle: 'Digital media, Yaba studio gigs, and modern Lagos creative enterprise',
    starterHomeId: 'home_tier1_improved_room',
    starterHomeName: 'Tier 1 — Improved Courtyard Room (Yaba Creative Hub)',
    openingBalanceGN: 5000,
    recommendedCareerId: 'career_creative_media_culture',
    recommendedCareerName: 'Creative Media, Tech & Culture',
    initialLifeGoalId: 'goal_first_digital_studio',
    initialLifeGoalLabel: 'Equip a home creative studio & unlock media contracts',
    entryOpportunities: ['job_entry_civic_greeter', 'job_entry_shop_assistant', 'job_entry_foot_courier'],
    startingInventory: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_table_lamp', 'item_wall_mirror'],
    summaryExplanation: 'Starts in the Yaba Creative Hub with ₦5,000 Game Naira and entry-level digital/community runner opportunities that require no vehicle.',
  },
};

export interface CanonicalObjective {
  objectiveId: string;
  stepNumber: number;
  name: string;
  description: string;
  whyItMatters: string;
  prerequisites: string[];
  triggeringEvents: string[];
  progressRequirements: {
    targetCount: number;
    unit: string;
  };
  completionCriteria: string;
  rewardDefinition: {
    xp: number;
    reputation: number;
    bonusGN: number;
    skillReward?: { skillId: string; points: number };
  };
  optionalBranch: {
    hasAlternative: boolean;
    alternativeObjectiveIds: string[];
    description: string;
  };
  destinationOrTarget: {
    zoneId: string;
    targetType: 'UI_PANEL' | 'WORLD_LOCATION' | 'HOME_INTERIOR' | 'HOUSEHOLD_OBJECT' | 'NPC_OR_JOB' | 'SHOP';
    targetId: string;
    coordinates?: { x: number; y: number; z: number };
    actionFunction?: string;
  };
  contextualHelp: string;
  failureRecoveryHandling: {
    commonBlockers: string[];
    recoveryActionLabel: string;
    recoveryInstruction: string;
  };
  repeatability: 'ONCE' | 'DAILY' | 'REPEATABLE';
  accessibilitySettings: {
    touchFriendly: boolean;
    noVehicleRequired: boolean;
    lowMotionCompatible: boolean;
  };
  completionAnalyticsEvent: string;
}

export const ONBOARDING_OBJECTIVE_CHAIN: CanonicalObjective[] = [
  {
    objectiveId: 'obj_01_register_or_guest',
    stepNumber: 1,
    name: '1. Complete Registration or Guest Entry',
    description: 'Create your Project Eko account or begin an introductory guest session.',
    whyItMatters: 'Secures your persistent Lagos citizen ledger, starter home, and multiplayer identity.',
    prerequisites: [],
    triggeringEvents: ['AccountCreated'],
    progressRequirements: { targetCount: 1, unit: 'account_session' },
    completionCriteria: 'Authenticated session token issued by /api/v1/auth/register or /api/v1/auth/guest.',
    rewardDefinition: { xp: 25, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: true,
      alternativeObjectiveIds: ['guest_entry_promotion'],
      description: 'You may start as a guest and promote your account to a permanent profile at any time.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'm47-auth-modal',
      actionFunction: 'openAuthModal',
    },
    contextualHelp: 'Use Create Account to save your progress permanently across devices, or Start Guest Journey to try Lagos first.',
    failureRecoveryHandling: {
      commonBlockers: ['Username already taken', 'Password shorter than 8 characters'],
      recoveryActionLabel: 'Choose Unique Handle',
      recoveryInstruction: 'Pick a unique display handle (3–24 characters) or use Log In if you already registered.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'SignupCompleted',
  },
  {
    objectiveId: 'obj_02_create_character',
    stepNumber: 2,
    name: '2. Create Your Lagos Character',
    description: 'Customize your appearance and verify your unique citizen display name.',
    whyItMatters: 'Your avatar and display name identify you in your home, on the street, and in live multiplayer zones.',
    prerequisites: ['obj_01_register_or_guest'],
    triggeringEvents: ['ProfileCreated'],
    progressRequirements: { targetCount: 1, unit: 'character_profile' },
    completionCriteria: 'Character appearance and moderated unique display name saved.',
    rewardDefinition: { xp: 30, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'All outfit presets and colours are included at zero cost.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'm47-char-creator',
      actionFunction: 'openCharacterCreator',
    },
    contextualHelp: 'Select your body style, skin tone, hair, and starter attire, then confirm your display name.',
    failureRecoveryHandling: {
      commonBlockers: ['Display name already in use or blocked by moderation'],
      recoveryActionLabel: 'Try Suggested Name',
      recoveryInstruction: 'Add a Lagos neighbourhood tag or number to make your display name unique.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'CharacterCreationCompleted',
  },
  {
    objectiveId: 'obj_03_claim_starter_profile',
    stepNumber: 3,
    name: '3. Claim Your Starter Profile & ₦5,000 GN Grant',
    description: 'Select one of the 5 canonical Lagos starter profiles and receive your ₦5,000 GN opening grant.',
    whyItMatters: 'Assigns your starter home lease (with 7-day grace), ₦5,000 GN wallet balance, and initial career path.',
    prerequisites: ['obj_02_create_character'],
    triggeringEvents: ['StarterHomeClaimed'],
    progressRequirements: { targetCount: 1, unit: 'starter_profile' },
    completionCriteria: 'Canonical starter profile initialized and ₦5,000 GN minted in ledger.',
    rewardDefinition: { xp: 40, reputation: 3, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: true,
      alternativeObjectiveIds: [
        'profile_new_arrival',
        'profile_early_career',
        'profile_student_learner',
        'profile_skilled_trade',
        'profile_creator_remote',
      ],
      description: 'Choose any of the 5 canonical starter profiles matching your preferred career path.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'm47-profile-selector',
      actionFunction: 'openCharacterCreator',
    },
    contextualHelp: 'Every starter profile includes a walkable 3D home, ₦5,000 GN, and immediate no-vehicle job access.',
    failureRecoveryHandling: {
      commonBlockers: ['Unsure which profile to pick'],
      recoveryActionLabel: 'Select New Arrival (Recommended)',
      recoveryInstruction: 'You are never locked out of other careers—your choice simply sets your initial recommendation.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'CharacterCreationCompleted',
  },
  {
    objectiveId: 'obj_04_enter_starter_home',
    stepNumber: 4,
    name: '4. Discover & Enter Your 3D Starter Home',
    description: 'Step through the front door into your walkable 3D starter apartment.',
    whyItMatters: 'Your home is where you rest, cook, freshen up, dress, and arrange furniture.',
    prerequisites: ['obj_03_claim_starter_profile'],
    triggeringEvents: ['HomeEntered'],
    progressRequirements: { targetCount: 1, unit: 'home_entry' },
    completionCriteria: 'Player transitions into 3D Home Exploration Mode.',
    rewardDefinition: { xp: 40, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Enter via the porch doorway or the Enter Starter Home action button.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'HOME_INTERIOR',
      targetId: 'starter_home_door',
      coordinates: { x: -78, y: 0, z: -170 },
      actionFunction: 'enterStarterHome3D',
    },
    contextualHelp: 'Walk up to your front porch door or use the primary Next Step button to enter your 3D home.',
    failureRecoveryHandling: {
      commonBlockers: ['Currently inside a vehicle or far from porch'],
      recoveryActionLabel: 'Fast-Travel to Porch & Enter',
      recoveryInstruction: 'Exit any vehicle first or tap the primary action in EkoGuide to step directly inside.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'StarterHomeEntered',
  },
  {
    objectiveId: 'obj_05_use_household_object',
    stepNumber: 5,
    name: '5. Use a Functional Household Object',
    description: 'Walk up to your Bed, Kettle, Washbasin, Lamp, or Mirror and interact with it.',
    whyItMatters: 'Using household objects restores Energy, Hunger, Hydration, Hygiene, Comfort, and Mood.',
    prerequisites: ['obj_04_enter_starter_home'],
    triggeringEvents: ['HouseholdObjectUsed'],
    progressRequirements: { targetCount: 1, unit: 'object_interaction' },
    completionCriteria: 'At least one starter household item interaction completed and persisted.',
    rewardDefinition: { xp: 50, reputation: 3, bonusGN: 0, skillReward: { skillId: 'skill_civic_discipline', points: 5 } },
    optionalBranch: {
      hasAlternative: true,
      alternativeObjectiveIds: ['item_bed_foam_single', 'item_electric_kettle', 'item_bathroom_basin', 'item_wall_mirror'],
      description: 'Interact with any placed furniture item inside your starter home.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'HOUSEHOLD_OBJECT',
      targetId: 'item_bed_foam_single',
      actionFunction: 'interactNearestHomeObject',
    },
    contextualHelp: 'Walk close to the Foam Bed, Electric Kettle, or Washbasin and use the context-aware Interact prompt.',
    failureRecoveryHandling: {
      commonBlockers: ['Not close enough to an item', 'Currently in Planner Mode instead of Exploration Mode'],
      recoveryActionLabel: 'Switch to Exploration & Use Item',
      recoveryInstruction: 'Ensure you are in 🚶 Explore Mode, walk within 2.5m of any furniture item, and trigger Interact.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstHouseholdInteraction',
  },
  {
    objectiveId: 'obj_06_inspect_household_needs',
    stepNumber: 6,
    name: '6. Inspect Your 8 Canonical Needs',
    description: 'Review your Energy, Hunger, Hydration, Hygiene, Comfort, Mood, Social, and Financial Stress bars.',
    whyItMatters: 'Keeping core needs healthy prevents fatigue penalties and unlocks peak shift performance.',
    prerequisites: ['obj_05_use_household_object'],
    triggeringEvents: ['NeedsInspected', 'HouseholdObjectUsed'],
    progressRequirements: { targetCount: 1, unit: 'needs_check' },
    completionCriteria: 'Needs HUD or EkoLife Home & Needs panel inspected.',
    rewardDefinition: { xp: 35, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Offline decay is permanently disabled so you are never punished for logging off.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'home-needs-strip',
      actionFunction: 'inspectHouseholdNeedsAction',
    },
    contextualHelp: 'Check the 8 Needs strip at the top of your Home view or open EkoLife → Home & Needs.',
    failureRecoveryHandling: {
      commonBlockers: ['Panel minimised'],
      recoveryActionLabel: 'Inspect Needs Now',
      recoveryInstruction: 'Tap Inspect Needs in the Next Step panel to highlight and verify your 8 need indicators.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstHouseholdInteraction',
  },
  {
    objectiveId: 'obj_07_open_jobshub',
    stepNumber: 7,
    name: '7. Open JobsHub & Browse Entry-Level Work',
    description: 'Open the JobsHub panel to inspect available no-vehicle shifts and their net pay.',
    whyItMatters: 'Every new citizen can earn honest Game Naira immediately without owning a vehicle.',
    prerequisites: ['obj_06_inspect_household_needs'],
    triggeringEvents: ['JobsHubOpened'],
    progressRequirements: { targetCount: 1, unit: 'jobshub_view' },
    completionCriteria: 'JobsHub viewed with eligibility and compensation breakdown displayed.',
    rewardDefinition: { xp: 35, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Accessible from the street HUD or EkoLife Hub.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'master-bible-modal',
      actionFunction: 'openJobsHubAction',
    },
    contextualHelp: 'Open JobsHub to compare Foot Courier, Shop-Floor Assistant, Bus-Stop Caller, and Workshop Apprentice roles.',
    failureRecoveryHandling: {
      commonBlockers: ['Still inside starter home'],
      recoveryActionLabel: 'Open JobsHub',
      recoveryInstruction: 'You can browse JobsHub from anywhere, then step outside to begin your shift.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstJobViewed',
  },
  {
    objectiveId: 'obj_08_select_no_vehicle_job',
    stepNumber: 8,
    name: '8. Accept a Qualifying No-Vehicle Job',
    description: 'Accept an eligible entry-level shift (such as CMS Foot Courier or Balogun Shop Assistant).',
    whyItMatters: 'Locks in your shift contract (₦550 Gross − ₦50 Cost = +₦500 GN Net) and sets your task checkpoints.',
    prerequisites: ['obj_07_open_jobshub'],
    triggeringEvents: ['JobAccepted'],
    progressRequirements: { targetCount: 1, unit: 'job_accepted' },
    completionCriteria: 'Authoritative shift session started via /api/v1/jobs/start.',
    rewardDefinition: { xp: 45, reputation: 3, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: true,
      alternativeObjectiveIds: [
        'job_entry_foot_courier',
        'job_entry_shop_assistant',
        'job_entry_bus_stop_caller',
        'job_entry_workshop_apprentice',
      ],
      description: 'Any of the 6 canonical entry-level no-vehicle jobs satisfies this objective.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'NPC_OR_JOB',
      targetId: 'job_entry_foot_courier',
      coordinates: { x: -88, y: 0, z: -182 },
      actionFunction: 'acceptEntryJobAction',
    },
    contextualHelp: 'Select Foot Courier (Deliver 3 parcels in Marina/CMS) or any entry-level job with zero vehicle requirement.',
    failureRecoveryHandling: {
      commonBlockers: ['Selected a Tier 2/3 job that requires a vehicle or higher skill level'],
      recoveryActionLabel: 'Accept No-Vehicle Foot Courier',
      recoveryInstruction: 'Filter for Entry-Level (No Vehicle Required) jobs—Foot Courier is 100% unlocked from Day 1.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstJobAccepted',
  },
  {
    objectiveId: 'obj_09_reach_task_location',
    stepNumber: 9,
    name: '9. Reach the Workplace / Task Location',
    description: 'Step outside into Marina/CMS and reach your shift dispatch checkpoint.',
    whyItMatters: 'Jobs require real presence at the workplace or route checkpoint—no menu-only money tapping.',
    prerequisites: ['obj_08_select_no_vehicle_job'],
    triggeringEvents: ['JobLocationReached', 'JobTaskCompleted'],
    progressRequirements: { targetCount: 1, unit: 'checkpoint_reached' },
    completionCriteria: 'First shift checkpoint verified in the 3D world.',
    rewardDefinition: { xp: 45, reputation: 3, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Follow the gold checkpoint beacon on the street.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'WORLD_LOCATION',
      targetId: 'checkpoint_marina_dispatch',
      coordinates: { x: -88, y: 0, z: -182 },
      actionFunction: 'navigateToActiveJobCheckpoint',
    },
    contextualHelp: 'If you are still inside your home, exit to the street and follow the waypoint marker to the dispatch point.',
    failureRecoveryHandling: {
      commonBlockers: ['Still inside 3D starter home'],
      recoveryActionLabel: 'Exit Home & Head to Checkpoint',
      recoveryInstruction: 'Exit your starter home to the street; the waypoint beacon will guide you straight to the checkpoint.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstJobAccepted',
  },
  {
    objectiveId: 'obj_10_complete_job_gameplay',
    stepNumber: 10,
    name: '10. Complete All Job Task Checkpoints',
    description: 'Perform the required checkpoint tasks (3/3 verified checkpoints) for your active shift.',
    whyItMatters: 'Generates the cryptographic checkpoint tokens required for server-authoritative wage settlement.',
    prerequisites: ['obj_09_reach_task_location'],
    triggeringEvents: ['JobTaskCompleted'],
    progressRequirements: { targetCount: 3, unit: 'checkpoints' },
    completionCriteria: 'All 3 shift checkpoints completed with server tokens.',
    rewardDefinition: { xp: 75, reputation: 5, bonusGN: 0, skillReward: { skillId: 'skill_route_knowledge', points: 10 } },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Complete each sequential checkpoint along the corridor.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'WORLD_LOCATION',
      targetId: 'active_job_checkpoint',
      coordinates: { x: -95, y: 0, z: -195 },
      actionFunction: 'performActiveJobCheckpointAction',
    },
    contextualHelp: 'Walk to each highlighted checkpoint marker and trigger the task action until all 3/3 steps are verified.',
    failureRecoveryHandling: {
      commonBlockers: ['Tried to claim payout before finishing 3/3 checkpoints'],
      recoveryActionLabel: 'Complete Next Checkpoint',
      recoveryInstruction: 'Finish the remaining checkpoint steps first; the server rejects incomplete shift submissions.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstJobCompleted',
  },
  {
    objectiveId: 'obj_11_receive_job_settlement',
    stepNumber: 11,
    name: '11. Receive Authoritative Game Naira Settlement',
    description: 'Submit your completed shift and verify your +₦500 GN net wage in the double-entry ledger.',
    whyItMatters: 'Proves your earnings are backed by balanced double-entry accounting in the Game Naira ledger.',
    prerequisites: ['obj_10_complete_job_gameplay'],
    triggeringEvents: ['JobSettlementPosted'],
    progressRequirements: { targetCount: 1, unit: 'ledger_settlement' },
    completionCriteria: 'Balanced double-entry ledger transaction posted via /api/v1/jobs/complete.',
    rewardDefinition: { xp: 80, reputation: 5, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Inspect the transaction receipt in EkoBank Ledger.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'UI_PANEL',
      targetId: 'job-settlement-claim',
      actionFunction: 'submitCompletedJobSettlementAction',
    },
    contextualHelp: 'Once all 3/3 checkpoints are complete, submit your shift to receive +₦500 GN net pay.',
    failureRecoveryHandling: {
      commonBlockers: ['Network interruption during submission'],
      recoveryActionLabel: 'Retry Idempotent Settlement',
      recoveryInstruction: 'Re-submit safely; idempotency keys ensure your shift is paid exactly once.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstSettlementReceived',
  },
  {
    objectiveId: 'obj_12_visit_shop',
    stepNumber: 12,
    name: '12. Visit the Household & Necessities Shop',
    description: 'Open the Lagos Household & Essentials Shop to browse items and valid Game Naira prices.',
    whyItMatters: 'Upgrading your home and buying daily essentials improves comfort, hygiene, and energy recovery.',
    prerequisites: ['obj_11_receive_job_settlement'],
    triggeringEvents: ['ShopVisited', 'ItemPurchased'],
    progressRequirements: { targetCount: 1, unit: 'shop_visit' },
    completionCriteria: 'Shop catalog opened with verified prices and affordability status.',
    rewardDefinition: { xp: 30, reputation: 2, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Browse affordable items starting from ₦600 GN (Wall Clock) or ₦750 GN (Standing Fan).',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'SHOP',
      targetId: 'home-shop-catalog',
      actionFunction: 'openHouseholdShopAction',
    },
    contextualHelp: 'Open the Household Shop to view prices, need boosts, and your live Game Naira balance.',
    failureRecoveryHandling: {
      commonBlockers: ['Looking at luxury items that exceed current balance'],
      recoveryActionLabel: 'View Affordable Starter Upgrades',
      recoveryInstruction: 'Check the Standing Fan (₦750 GN) or Wall Clock (₦600 GN)—both are easily affordable with your ₦5,500 GN balance.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstShopPurchase',
  },
  {
    objectiveId: 'obj_13_buy_affordable_item',
    stepNumber: 13,
    name: '13. Buy an Eligible Affordable Item',
    description: 'Purchase an affordable item (e.g. Standing Fan for ₦750 GN or Wall Clock for ₦600 GN).',
    whyItMatters: 'Debits your wallet in the authoritative ledger and adds the physical 3D asset to your inventory.',
    prerequisites: ['obj_12_visit_shop'],
    triggeringEvents: ['ItemPurchased'],
    progressRequirements: { targetCount: 1, unit: 'item_purchased' },
    completionCriteria: 'Item purchased via /api/v1/homes/furniture/buy and added to owned inventory.',
    rewardDefinition: { xp: 60, reputation: 4, bonusGN: 0, skillReward: { skillId: 'skill_financial_literacy', points: 8 } },
    optionalBranch: {
      hasAlternative: true,
      alternativeObjectiveIds: ['item_standing_fan', 'item_wall_clock', 'item_study_desk', 'item_storage_wardrobe'],
      description: 'Any affordable shop item purchase satisfies this step.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'SHOP',
      targetId: 'item_standing_fan',
      actionFunction: 'buyRecommendedStarterItemAction',
    },
    contextualHelp: 'Purchase the Standing Fan (₦750 GN) or Wall Clock (₦600 GN) to upgrade your starter home.',
    failureRecoveryHandling: {
      commonBlockers: ['Insufficient funds for a high-tier item', 'Item already owned'],
      recoveryActionLabel: 'Buy Affordable Unowned Item',
      recoveryInstruction: 'If an item is already owned, place it from your inventory or pick another affordable unowned item.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstShopPurchase',
  },
  {
    objectiveId: 'obj_14_place_and_use_item',
    stepNumber: 14,
    name: '14. Place & Use Your New Item at Home',
    description: 'Place your newly purchased item in a valid spot inside your 3D home and interact with it.',
    whyItMatters: 'Demonstrates collision-safe 3D furniture placement and functional need bonuses.',
    prerequisites: ['obj_13_buy_affordable_item'],
    triggeringEvents: ['ItemPlaced', 'HouseholdObjectUsed'],
    progressRequirements: { targetCount: 1, unit: 'item_placed_and_used' },
    completionCriteria: 'Purchased item placed within valid room bounds and interacted with.',
    rewardDefinition: { xp: 70, reputation: 4, bonusGN: 0 },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Use Home Planner Mode to reposition or rotate, then Explore Mode to interact.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'HOME_INTERIOR',
      targetId: 'home_planner_placement',
      actionFunction: 'placeAndUsePurchasedItemAction',
    },
    contextualHelp: 'Inside your 3D home, place your new item in a green valid floor slot and interact with it.',
    failureRecoveryHandling: {
      commonBlockers: ['Attempting to place furniture overlapping a wall or doorway'],
      recoveryActionLabel: 'Snap to Valid Floor Position',
      recoveryInstruction: 'Move the item until the footprint indicator turns green (away from walls and doors) and confirm placement.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'FirstHouseholdInteraction',
  },
  {
    objectiveId: 'obj_15_verify_persistent_progress',
    stepNumber: 15,
    name: '15. Return Home & Verify Persistent First-Day Progress',
    description: 'Confirm your saved home layout, updated Game Naira balance, and unlocked career progression.',
    whyItMatters: 'Completes your First-Day Onboarding Journey and unlocks full EkoGuide career & multiplayer goals.',
    prerequisites: ['obj_14_place_and_use_item'],
    triggeringEvents: ['HomeProgressVerified'],
    progressRequirements: { targetCount: 1, unit: 'persistence_verified' },
    completionCriteria: 'Home layout, ledger balance, and completed job count verified and persisted to server + client.',
    rewardDefinition: { xp: 100, reputation: 10, bonusGN: 250, skillReward: { skillId: 'skill_civic_discipline', points: 10 } },
    optionalBranch: {
      hasAlternative: false,
      alternativeObjectiveIds: [],
      description: 'Unlocks free career specialization, Multiplayer Co-op Danfo, and Arcade Hustle runs.',
    },
    destinationOrTarget: {
      zoneId: 'zone_marina_cms',
      targetType: 'HOME_INTERIOR',
      targetId: 'verify_home_persistence',
      actionFunction: 'verifyFirstDayPersistenceAction',
    },
    contextualHelp: 'Verify your home and wallet state to graduate from First-Day Onboarding and claim your +100 XP & +₦250 GN graduation bonus.',
    failureRecoveryHandling: {
      commonBlockers: ['Outside the home'],
      recoveryActionLabel: 'Return Home & Complete Onboarding',
      recoveryInstruction: 'Step inside your starter home and confirm your persistent state.',
    },
    repeatability: 'ONCE',
    accessibilitySettings: { touchFriendly: true, noVehicleRequired: true, lowMotionCompatible: true },
    completionAnalyticsEvent: 'OnboardingCompleted',
  },
];

export interface HustleFlowConfig {
  defaultMultiplier: number;
  arcadeScoreMaxCap: number;
  hustleCoinMaxCap: number;
  normalWageMultiplier: number;
  businessYieldMultiplier: number;
  realWorldRewardMultiplier: number;
  streakStepSize: number;
  multiplierIncrementPerStep: number;
  inactivityDecayWindowMs: number;
  decayStepAmount: number;
  minActionIntervalMs: number;
  collisionPenaltyDelta: number;
  missedStopPenaltyDelta: number;
  failedObjectiveResetTo: number;
}

export const DEFAULT_HUSTLE_FLOW_CONFIG: HustleFlowConfig = {
  defaultMultiplier: 1.0,
  arcadeScoreMaxCap: 3.0, // Provisional playtest assumption (documented)
  hustleCoinMaxCap: 2.0, // Provisional playtest assumption (documented)
  normalWageMultiplier: 1.0, // Strictly 1.0x — normal wages are never multiplied
  businessYieldMultiplier: 1.0, // Strictly 1.0x — business yields are never multiplied
  realWorldRewardMultiplier: 1.0, // Strictly 1.0x — real-world rewards are never multiplied
  streakStepSize: 2,
  multiplierIncrementPerStep: 0.25,
  inactivityDecayWindowMs: 12000,
  decayStepAmount: 0.25,
  minActionIntervalMs: 350,
  collisionPenaltyDelta: -0.5,
  missedStopPenaltyDelta: -0.25,
  failedObjectiveResetTo: 1.0,
};

export interface PlayerHustleFlowState {
  currentMultiplier: number;
  arcadeEffectiveMultiplier: number;
  hustleCoinEffectiveMultiplier: number;
  normalWageEffectiveMultiplier: number;
  currentQualifyingStreak: number;
  lastQualifyingAction: string | null;
  lastActionServerTimestamp: number;
  allowedTimeWindowMs: number;
  collisionCount: number;
  failurePenaltyCount: number;
  currentMode: 'STREET_EXPLORATION' | 'HOME_INTERIOR' | 'NORMAL_JOB' | 'ARCADE_DANFO_RUN' | 'COOP_DANFO';
  currentRewardCategory: 'NONE' | 'NORMAL_WAGE' | 'ARCADE_SCORE' | 'ARCADE_SCORE_AND_HUSTLE_COIN';
  multiplierCap: number;
  reasonForLastChange: string;
  recentQualifyingActions: Array<{ actionId: string; type: string; deltaStreak: number; multiplierAfter: number; timestamp: number }>;
  processedActionIds: string[];
  completedRunIds: string[];
  rejectedExploitAttempts: number;
}

export interface M47AccountRecord {
  accountId: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  isGuest: boolean;
  promotedFromGuestId: string | null;
  privacyConsentAccepted: boolean;
  privacyConsentTimestamp: number;
  createdAt: number;
  lastLoginAt: number;
  characterCreated: boolean;
  character: {
    displayName: string;
    appearance: {
      gender?: 'male' | 'female';
      styleSet?: 'casual' | 'casual2' | 'smart' | 'party';
      fabricStyle?: 'ankara' | 'asooke' | 'plain';
      bodyType: string;
      skinTone: string;
      hairStyle: string;
      outfitPreset: string;
      shoesStyle?: string;
      bagStyle?: string;
      topColor?: string;
      bottomColor?: string;
      hairColor?: string;
      shoeColor?: string;
      bagColor?: string;
      accentColor: string;
    };
    starterProfileId: string;
    starterHomeId: string;
    selectedCareerId: string;
    selectedLifeGoalId: string;
    createdAt: number;
  } | null;
  gameNairaBalance: number;
  hustleCoinsBalance: number;
  xp: number;
  level: number;
  reputation: number;
  completedJobsCount: number;
  ownedFurniture: string[];
  placedFurniture: Array<{ itemId: string; x: number; y: number; z: number; rotY: number }>;
  wearableEquipped: string | null;
  needs: Record<string, number>;
  skills: Record<string, number>;
  onboarding: {
    completedObjectiveIds: string[];
    objectiveProgress: Record<string, number>;
    processedEventIds: string[];
    tutorialSkipped: boolean;
    tutorialCompleted: boolean;
    currentZoneId: string;
    inHome: boolean;
    isDriving: boolean;
    ownedVehicles: string[];
    activeJobId: string | null;
    activeJobCheckpointsDone: number;
    activeJobShift?: null | {
      shiftId: string;
      jobId: string;
      title: string;
      currentStepIndex: number;
      totalSteps: number;
      checkpoints: any[];
      completedSteps: any[];
    };
    ownedOutfits?: string[];
    equippedOutfitId?: string;
    wardrobeOpened?: boolean;
    clothingEquipped?: boolean;
    firstPurchaseCompleted?: boolean;
    firstPurchasedItemUsedOrPlaced?: boolean;
    firstDayCompleted?: boolean;
    lastProgressionEvent?: { eventId: string; eventType: string; timestamp: number } | null;
    lastBlockedReason: string | null;
  };
  hustleFlow: PlayerHustleFlowState;
  ledgerEntries: Array<{
    entryId: string;
    idempotencyKey: string;
    description: string;
    amountGN: number;
    debitAccount: string;
    creditAccount: string;
    balanceAfterGN: number;
    timestamp: number;
  }>;
  legacyPlayerProfile?: Record<string, any>;
  legacyVehicleState?: { fuelLiters: number; condition: number };
  legacyBusinesses?: Array<Record<string, any>>;
  legacyEconomicFlags?: { fleetCollectedThisShift: boolean; businessCollectedThisShift: boolean };
  legacySupplyState?: { retailInventories: Array<Record<string, any>>; activeCargoBatches: Array<Record<string, any>> };
  legacyRewardPointsBalance?: number;
  legacyPropertyParcels?: Array<Record<string, any>>;
  legacyHouseholdState?: Record<string, any>;
  legacyProcessedIdempotencyKeys?: string[];
  legacyDanfoHustleState?: Record<string, any>;
  role?: 'PLAYER' | 'MODERATOR' | 'OPS_ADMIN';
  ageBand?: '18_PLUS' | '13_TO_17';
  adultVerified?: boolean;
  privacyConsentWithdrawnAt?: number | null;
  deletedAt?: number | null;
}

export interface AnalyticsFunnelEvent {
  analyticsId: string;
  accountId: string;
  eventName: string;
  metadata: Record<string, any>;
  timestamp: number;
}

export interface StaffModerationAuditLogEntry {
  auditId: string;
  actorAccountId: string;
  actorRole: string;
  action: string;
  targetId: string;
  reason: string;
  timestampIso: string;
}

interface M47PersistentStoreData {
  schemaVersion: number;
  accounts: Record<string, M47AccountRecord>;
  sessions: Record<string, { sessionToken: string; accountId: string; createdAt: number; expiresAt: number }>;
  recoveryTokens: Record<string, { token: string; accountId: string; expiresAt: number }>;
  coopSettlements: Record<string, {
    coopSessionId: string;
    idempotencyKey: string;
    driverAccountId: string;
    conductorAccountId: string;
    driverPayoutGN: number;
    conductorPayoutGN: number;
    netPoolGN: number;
    settledAt: number;
  }>;
  analyticsEvents: AnalyticsFunnelEvent[];
  firstActionTimestamps: Record<string, { signupStartedAt: number; firstMeaningfulActionAt: number | null }>;
  staffAuditLogs?: StaffModerationAuditLogEntry[];
  settledCoopCheckpointTokens?: string[];
  revokedTokens?: Record<string, number>;
}

const defaultStore: M47PersistentStoreData = {
  schemaVersion: 1,
  accounts: {},
  sessions: {},
  recoveryTokens: {},
  coopSettlements: {},
  analyticsEvents: [],
  firstActionTimestamps: {},
};

function loadStore(): M47PersistentStoreData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    return JSON.parse(JSON.stringify(defaultStore));
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`[M4.7 Store] Refusing to start with an unreadable account store at ${STORE_PATH}: ${String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[M4.7 Store] Refusing to start with an invalid account store at ${STORE_PATH}.`);
  }

  const restored = { ...defaultStore, ...parsed } as M47PersistentStoreData;
  if (restored.schemaVersion !== 1 ||
      !isRecord(restored.accounts) || !isRecord(restored.sessions) ||
      !isRecord(restored.recoveryTokens) || !isRecord(restored.coopSettlements) ||
      !Array.isArray(restored.analyticsEvents) || !isRecord(restored.firstActionTimestamps)) {
    throw new Error(`[M4.7 Store] Refusing to start with an unsupported or malformed account store at ${STORE_PATH}.`);
  }
  return restored;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const store: M47PersistentStoreData = loadStore();

function saveStore(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryPath = `${STORE_PATH}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, STORE_PATH);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw new Error(`[M4.7 Store] Failed to durably persist account state: ${String(error)}`);
  }
}

/** Return an account's legacy domain projection, initializing it from canonical M47 identity and wallet data. */
export function getLegacyPlayerProfile(account: M47AccountRecord): Record<string, any> {
  if (!account.legacyPlayerProfile) {
    account.legacyPlayerProfile = {
      playerId: account.accountId,
      username: account.username,
      avatarConfig: {
        outfit: account.character?.appearance.outfitPreset || 'green_ankara_bomber',
        skinTone: account.character?.appearance.skinTone || 'deep_bronze',
        hairStyle: account.character?.appearance.hairStyle || 'braided_fade',
      },
      reputationScore: account.reputation,
      driverRating: 4.9,
      gameNairaBalance: account.gameNairaBalance,
      currentZoneId: account.onboarding.currentZoneId || 'zone_marina_cms',
      currentVehicleId: account.onboarding.ownedVehicles[0] || 'adera_compact_16',
      activeMissionId: null,
      ownedVehicleIds: account.onboarding.ownedVehicles.length ? [...account.onboarding.ownedVehicles] : ['adera_compact_16'],
      licenses: { regularDriver: true, commercialDanfo: false, dispatchCourier: true, heavyTruck: false },
    };
    saveStore();
  }
  return account.legacyPlayerProfile;
}

export function getLegacyVehicleState(account: M47AccountRecord): { fuelLiters: number; condition: number } {
  if (!account.legacyVehicleState) {
    account.legacyVehicleState = { fuelLiters: 42.5, condition: 94 };
    saveStore();
  }
  return account.legacyVehicleState;
}

export function getLegacyBusinesses(account: M47AccountRecord, defaults: Array<Record<string, any>>): Array<Record<string, any>> {
  if (!account.legacyBusinesses) {
    account.legacyBusinesses = JSON.parse(JSON.stringify(defaults));
    saveStore();
  }
  return account.legacyBusinesses!;
}

export function getLegacyEconomicFlags(account: M47AccountRecord): { fleetCollectedThisShift: boolean; businessCollectedThisShift: boolean } {
  if (!account.legacyEconomicFlags) {
    account.legacyEconomicFlags = { fleetCollectedThisShift: false, businessCollectedThisShift: false };
    saveStore();
  }
  return account.legacyEconomicFlags;
}

export function getLegacySupplyState(
  account: M47AccountRecord,
  defaults: { retailInventories: Array<Record<string, any>>; activeCargoBatches: Array<Record<string, any>> }
): { retailInventories: Array<Record<string, any>>; activeCargoBatches: Array<Record<string, any>> } {
  if (!account.legacySupplyState) {
    account.legacySupplyState = JSON.parse(JSON.stringify(defaults));
    saveStore();
  }
  return account.legacySupplyState!;
}

export function getLegacyRewardPointsBalance(account: M47AccountRecord): number {
  if (account.legacyRewardPointsBalance === undefined) {
    account.legacyRewardPointsBalance = 2850;
    saveStore();
  }
  return account.legacyRewardPointsBalance;
}

export function setLegacyRewardPointsBalance(account: M47AccountRecord, balance: number): void {
  account.legacyRewardPointsBalance = balance;
  saveStore();
}

export function getLegacyPropertyParcels(account: M47AccountRecord, defaults: Array<Record<string, any>>): Array<Record<string, any>> {
  if (!account.legacyPropertyParcels) {
    account.legacyPropertyParcels = JSON.parse(JSON.stringify(defaults));
    saveStore();
  }
  return account.legacyPropertyParcels!;
}

export function setLegacyPropertyParcels(account: M47AccountRecord, parcels: Array<Record<string, any>>): void {
  account.legacyPropertyParcels = JSON.parse(JSON.stringify(parcels));
  saveStore();
}

export function getLegacyHouseholdState(account: M47AccountRecord, defaults: Record<string, any>): Record<string, any> {
  if (!account.legacyHouseholdState) {
    account.legacyHouseholdState = JSON.parse(JSON.stringify(defaults));
    for (const item of account.legacyHouseholdState!.ownedItems || []) {
      if (item.ownerId) item.ownerId = account.accountId;
    }
    saveStore();
  }
  return account.legacyHouseholdState!;
}

export function hasLegacyIdempotencyKey(account: M47AccountRecord, key: string): boolean {
  return (account.legacyProcessedIdempotencyKeys || []).includes(key);
}

export function recordLegacyIdempotencyKey(account: M47AccountRecord, key: string): void {
  if (!account.legacyProcessedIdempotencyKeys) account.legacyProcessedIdempotencyKeys = [];
  if (!account.legacyProcessedIdempotencyKeys.includes(key)) account.legacyProcessedIdempotencyKeys.push(key);
  saveStore();
}

export function getLegacyDanfoHustleState(account: M47AccountRecord, defaults: Record<string, any>): Record<string, any> {
  if (!account.legacyDanfoHustleState) {
    account.legacyDanfoHustleState = JSON.parse(JSON.stringify(defaults));
    saveStore();
  }
  return account.legacyDanfoHustleState!;
}

/** Persist mutations made through the legacy domain compatibility boundary. */
export function persistAccountStore(): void {
  saveStore();
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

const MODERATION_DISALLOWED_NAMES = ['admin_root', 'system_treasury', 'scam_official', 'slur_test'];

export function validateDisplayName(name: string, excludeAccountId?: string): { valid: boolean; error?: string } {
  const cleaned = String(name || '').trim();
  if (cleaned.length < 3 || cleaned.length > 24) {
    return { valid: false, error: 'Display name must be between 3 and 24 characters.' };
  }
  if (!/^[a-zA-Z0-9_ -]+$/.test(cleaned)) {
    return { valid: false, error: 'Display name may only contain letters, numbers, spaces, hyphens, and underscores.' };
  }
  const lower = cleaned.toLowerCase();
  for (const bad of MODERATION_DISALLOWED_NAMES) {
    if (lower.includes(bad)) {
      return { valid: false, error: 'Display name contains a reserved or moderated term.' };
    }
  }
  for (const acc of Object.values(store.accounts)) {
    if (acc.deletedAt) continue;
    if (acc.accountId === excludeAccountId) continue;
    if (acc.username.toLowerCase() === lower || (acc.character && acc.character.displayName.toLowerCase() === lower)) {
      return { valid: false, error: 'Display name is already taken by another citizen in Lagos.' };
    }
  }
  return { valid: true };
}

function createInitialHustleFlowState(): PlayerHustleFlowState {
  return {
    currentMultiplier: 1.0,
    arcadeEffectiveMultiplier: 1.0,
    hustleCoinEffectiveMultiplier: 1.0,
    normalWageEffectiveMultiplier: 1.0,
    currentQualifyingStreak: 0,
    lastQualifyingAction: null,
    lastActionServerTimestamp: Date.now(),
    allowedTimeWindowMs: DEFAULT_HUSTLE_FLOW_CONFIG.inactivityDecayWindowMs,
    collisionCount: 0,
    failurePenaltyCount: 0,
    currentMode: 'STREET_EXPLORATION',
    currentRewardCategory: 'NONE',
    multiplierCap: DEFAULT_HUSTLE_FLOW_CONFIG.arcadeScoreMaxCap,
    reasonForLastChange: 'Default 1.0x initialized',
    recentQualifyingActions: [],
    processedActionIds: [],
    completedRunIds: [],
    rejectedExploitAttempts: 0,
  };
}

function createAccountRecord(params: {
  accountId: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  isGuest: boolean;
  privacyConsentAccepted: boolean;
}): M47AccountRecord {
  const now = Date.now();
  return {
    accountId: params.accountId,
    username: params.username,
    email: params.email,
    passwordHash: params.passwordHash,
    passwordSalt: params.passwordSalt,
    isGuest: params.isGuest,
    promotedFromGuestId: null,
    privacyConsentAccepted: params.privacyConsentAccepted,
    privacyConsentTimestamp: now,
    createdAt: now,
    lastLoginAt: now,
    characterCreated: false,
    character: null,
    gameNairaBalance: 5000,
    hustleCoinsBalance: 0,
    xp: 25,
    level: 1,
    reputation: 52,
    completedJobsCount: 0,
    ownedFurniture: [
      'item_bed_foam_single',
      'item_electric_kettle',
      'item_bathroom_basin',
      'item_table_lamp',
      'item_wall_mirror',
    ],
    placedFurniture: [
      { itemId: 'item_bed_foam_single', x: -3.2, y: 0, z: -2.4, rotY: 0 },
      { itemId: 'item_electric_kettle', x: 3.1, y: 0.82, z: -2.6, rotY: 0 },
      { itemId: 'item_bathroom_basin', x: 3.2, y: 0, z: 2.3, rotY: Math.PI },
      { itemId: 'item_table_lamp', x: -1.2, y: 0.75, z: -2.7, rotY: 0 },
      { itemId: 'item_wall_mirror', x: -3.8, y: 1.3, z: 0.4, rotY: Math.PI / 2 },
    ],
    wearableEquipped: null,
    needs: {
      energy: 78,
      hunger: 74,
      hydration: 80,
      hygiene: 82,
      comfort: 75,
      mood: 80,
      social: 72,
      financial_stress: 18,
    },
    skills: {
      skill_driving_control: 10,
      skill_route_knowledge: 10,
      skill_customer_care: 10,
      skill_financial_literacy: 10,
      skill_negotiation_sales: 10,
      skill_mechanical_care: 10,
      skill_logistics_planning: 10,
      skill_civic_discipline: 15,
    },
    onboarding: {
      completedObjectiveIds: ['obj_01_register_or_guest'],
      objectiveProgress: { obj_01_register_or_guest: 1 },
      processedEventIds: [`ev_account_${params.accountId}`],
      tutorialSkipped: false,
      tutorialCompleted: false,
      currentZoneId: 'zone_marina_cms',
      inHome: false,
      isDriving: false,
      ownedVehicles: [],
      activeJobId: null,
      activeJobCheckpointsDone: 0,
      activeJobShift: null,
      ownedOutfits: ['outfit_street_hustler', 'outfit_sunday_senator'],
      equippedOutfitId: 'outfit_street_hustler',
      wardrobeOpened: false,
      clothingEquipped: false,
      firstPurchaseCompleted: false,
      firstPurchasedItemUsedOrPlaced: false,
      firstDayCompleted: false,
      lastProgressionEvent: { eventId: `ev_account_${params.accountId}`, eventType: 'AccountCreated', timestamp: now },
      lastBlockedReason: null,
    },
    hustleFlow: createInitialHustleFlowState(),
    ledgerEntries: [
      {
        entryId: `tx_open_${params.accountId}`,
        idempotencyKey: `idem_open_${params.accountId}`,
        description: 'Opening Lagos Citizen Starter Grant (₦5,000 GN)',
        amountGN: 5000,
        debitAccount: 'SYS_TREASURY_MINT',
        creditAccount: `WALLET_${params.accountId}`,
        balanceAfterGN: 5000,
        timestamp: now,
      },
    ],
  };
}

const MEANINGFUL_ACTION_EVENTS = new Set([
  'StarterHomeEntered',
  'FirstHouseholdInteraction',
  'FirstJobAccepted',
  'FirstJobCompleted',
  'FirstShopPurchase',
  'FirstMultiplayerInteraction',
]);

export function recordAnalyticsFunnelEvent(accountId: string, eventName: string, metadata: Record<string, any> = {}) {
  const now = Date.now();
  if (eventName === 'SignupStarted' && !store.firstActionTimestamps[accountId]) {
    store.firstActionTimestamps[accountId] = { signupStartedAt: now, firstMeaningfulActionAt: null };
  }
  if (MEANINGFUL_ACTION_EVENTS.has(eventName)) {
    if (!store.firstActionTimestamps[accountId]) {
      const acc = store.accounts[accountId];
      store.firstActionTimestamps[accountId] = {
        signupStartedAt: acc ? acc.createdAt : now - 5000,
        firstMeaningfulActionAt: now,
      };
    } else if (!store.firstActionTimestamps[accountId].firstMeaningfulActionAt) {
      store.firstActionTimestamps[accountId].firstMeaningfulActionAt = now;
    }
  }
  const ev: AnalyticsFunnelEvent = {
    analyticsId: `an_${now}_${Math.floor(Math.random() * 10000)}`,
    accountId,
    eventName,
    metadata,
    timestamp: now,
  };
  store.analyticsEvents.push(ev);
  if (store.analyticsEvents.length > 500) {
    store.analyticsEvents.splice(0, store.analyticsEvents.length - 500);
  }
  saveStore();
  return ev;
}

export function postAccountLedgerTransaction(
  acc: M47AccountRecord,
  params: {
    idempotencyKey: string;
    description: string;
    amountGN: number; // positive = credit to player, negative = debit from player
    counterpartyAccount: string;
  }
): { duplicate: boolean; entry: any; balanceAfterGN: number } {
  const existing = acc.ledgerEntries.find((e) => e.idempotencyKey === params.idempotencyKey);
  if (existing) {
    return { duplicate: true, entry: existing, balanceAfterGN: acc.gameNairaBalance };
  }
  const delta = Math.round(params.amountGN);
  acc.gameNairaBalance = Math.max(0, acc.gameNairaBalance + delta);
  const isCredit = delta >= 0;
  const absAmount = Math.abs(delta);
  const entry = {
    entryId: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    idempotencyKey: params.idempotencyKey,
    description: params.description,
    amountGN: delta,
    debitAccount: isCredit ? params.counterpartyAccount : `WALLET_${acc.accountId}`,
    creditAccount: isCredit ? `WALLET_${acc.accountId}` : params.counterpartyAccount,
    balanceAfterGN: acc.gameNairaBalance,
    timestamp: Date.now(),
  };
  acc.ledgerEntries.unshift(entry);
  saveStore();
  return { duplicate: false, entry, balanceAfterGN: acc.gameNairaBalance };
}

// ============================================================================
// PHASE 2: EKOGUIDE NEXT-BEST-ACTION ENGINE
// ============================================================================
export function evaluateNextBestAction(acc: M47AccountRecord, contextOverride: Record<string, any> = {}) {
  const onb = acc.onboarding;
  const effectiveInHome = typeof contextOverride.inHome === 'boolean' ? contextOverride.inHome : onb.inHome;
  const effectiveIsDriving = typeof contextOverride.isDriving === 'boolean' ? contextOverride.isDriving : onb.isDriving;
  if (typeof contextOverride.currentZoneId === 'string') onb.currentZoneId = contextOverride.currentZoneId;
  if (typeof contextOverride.activeJobId === 'string' || contextOverride.activeJobId === null) {
    onb.activeJobId = contextOverride.activeJobId;
  }
  if (typeof contextOverride.activeJobCheckpointsDone === 'number') {
    onb.activeJobCheckpointsDone = contextOverride.activeJobCheckpointsDone;
  }
  if (typeof contextOverride.blockedReason === 'string' || contextOverride.blockedReason === null) {
    onb.lastBlockedReason = contextOverride.blockedReason;
  }

  // 1. Check if player is currently driving: never cover the road with an unrelated home tutorial!
  if (effectiveIsDriving) {
    const drivingPrimary = {
      objectiveId: 'obj_dynamic_driving_focus',
      stepNumber: 0,
      name: 'Complete Active Driving / Route Segment Safely',
      description: 'Keep your eyes on the Lagos corridor, stop cleanly inside bus bays, and avoid collisions.',
      whyItMatters: 'Safe driving preserves vehicle condition and builds your Hustle Flow arcade score streak.',
      primaryActionLabel: 'Focus on Route Waypoint',
      actionFunction: 'focusDrivingRouteAction',
      progressText: 'In Motion (HUD Compact Mode)',
      isCompactDrivingMode: true,
      suppressHomeTutorials: true,
      blockerInfo: null,
    };
    return {
      primaryObjective: drivingPrimary,
      secondarySuggestions: [
        {
          objectiveId: 'sec_park_safely',
          title: 'Park at Next Bus Bay to Inspect EkoGuide',
          reason: 'Full home and shop tutorials pause automatically while driving.',
        },
      ],
      whatShouldIDoNextPanel: {
        currentPriority: drivingPrimary.name,
        whyItMatters: drivingPrimary.whyItMatters,
        immediateAlternatives: ['Complete current bus stop pickup', 'Exit vehicle when parked to resume street/home tasks'],
        availableOpportunities: ['Danfo Route Corridor', 'Cooperative Driver + Conductor Run'],
        relevantBlockers: [],
        careerPathAlignment: 'Advances Driving Control & Route Knowledge skills toward Fleet Operator status.',
      },
      onboardingChainProgress: {
        completedCount: onb.completedObjectiveIds.length,
        totalCount: ONBOARDING_OBJECTIVE_CHAIN.length,
        tutorialSkipped: onb.tutorialSkipped,
        tutorialCompleted: onb.tutorialCompleted,
      },
    };
  }

  // 2. Check if there is an active blocker (e.g., player attempted a locked vehicle job or unaffordable purchase)
  let blockerInfo: null | {
    blockedAction: string;
    reason: string;
    recoverySuggestion: string;
    recoveryActionLabel: string;
    recoveryActionFunction: string;
  } = null;

  if (onb.lastBlockedReason) {
    if (onb.lastBlockedReason.includes('VEHICLE') || onb.lastBlockedReason.includes('DANFO')) {
      blockerInfo = {
        blockedAction: 'Vehicle-Dependent Transport Route',
        reason: 'You do not currently own or lease a commercial vehicle.',
        recoverySuggestion: 'Start with a No-Vehicle Entry Job (CMS Foot Courier or Shop-Floor Assistant) paying +₦500 GN net per shift, or join another player\'s Danfo as Conductor.',
        recoveryActionLabel: 'Start No-Vehicle Foot Courier (+₦500 GN)',
        recoveryActionFunction: 'acceptEntryJobAction',
      };
    } else if (onb.lastBlockedReason.includes('FUNDS') || onb.lastBlockedReason.includes('UNAFFORDABLE')) {
      blockerInfo = {
        blockedAction: 'High-Cost Purchase',
        reason: `Item price exceeds your current balance of ₦${acc.gameNairaBalance.toLocaleString()} GN.`,
        recoverySuggestion: 'Complete a Foot Courier shift (+₦500 GN net) or choose an affordable starter upgrade like the Standing Fan (₦750 GN) or Wall Clock (₦600 GN).',
        recoveryActionLabel: 'Work Entry Shift (+₦500 GN)',
        recoveryActionFunction: 'acceptEntryJobAction',
      };
    } else {
      blockerInfo = {
        blockedAction: 'Unavailable Action',
        reason: onb.lastBlockedReason,
        recoverySuggestion: 'Follow the recommended Next Step below to satisfy the prerequisite first.',
        recoveryActionLabel: 'Follow Recommended Step',
        recoveryActionFunction: 'executePrimaryEkoGuideAction',
      };
    }
  }

  // 3. Check urgent player needs (Energy < 35, Hunger < 35, or Hygiene < 35)
  const lowEnergy = (acc.needs.energy ?? 80) < 35;
  const lowHunger = (acc.needs.hunger ?? 80) < 35;
  const lowHygiene = (acc.needs.hygiene ?? 80) < 35;
  if (lowEnergy || lowHunger || lowHygiene) {
    const needLabel = lowEnergy ? 'Energy (Rest on Bed)' : lowHunger ? 'Hunger (Use Kettle / Meal)' : 'Hygiene (Use Washbasin)';
    const urgentPrimary = {
      objectiveId: 'obj_dynamic_restore_needs',
      stepNumber: 0,
      name: `Restore Low ${needLabel}`,
      description: `Your ${needLabel.split(' ')[0]} is running low. Use your household objects at home to recover before your next shift.`,
      whyItMatters: 'Healthy needs prevent fatigue slowdowns and keep your citizen mood high.',
      primaryActionLabel: onb.inHome ? 'Use Household Object Now' : 'Return to Starter Home',
      actionFunction: onb.inHome ? 'interactNearestHomeObject' : 'enterStarterHome3D',
      progressText: 'Need Recovery Priority',
      isCompactDrivingMode: false,
      suppressHomeTutorials: false,
      blockerInfo,
    };
    return {
      primaryObjective: urgentPrimary,
      secondarySuggestions: [
        {
          objectiveId: 'sec_bukka_meal',
          title: 'Visit Mama Put Bukka Stall',
          reason: 'Quickly restores Hunger and Mood when working in Marina/CMS.',
        },
      ],
      whatShouldIDoNextPanel: {
        currentPriority: urgentPrimary.name,
        whyItMatters: urgentPrimary.whyItMatters,
        immediateAlternatives: ['Rest on Foam Bed (+28 Energy)', 'Boil water with Electric Kettle (+14 Hunger & +18 Hydration)'],
        availableOpportunities: ['Starter Home Recovery', 'Mama Put Bukka Meal'],
        relevantBlockers: blockerInfo ? [blockerInfo.reason] : [],
        careerPathAlignment: 'Sustaining daily wellbeing is the foundation of sustainable Lagos hustle.',
      },
      onboardingChainProgress: {
        completedCount: onb.completedObjectiveIds.length,
        totalCount: ONBOARDING_OBJECTIVE_CHAIN.length,
        tutorialSkipped: onb.tutorialSkipped,
        tutorialCompleted: onb.tutorialCompleted,
      },
    };
  }

  // 4. Onboarding Chain Evaluation (Steps 1..15) if not skipped and not completed
  if (!onb.tutorialSkipped && !onb.tutorialCompleted) {
    const nextStepObj =
      ONBOARDING_OBJECTIVE_CHAIN.find((o) => !onb.completedObjectiveIds.includes(o.objectiveId)) ||
      ONBOARDING_OBJECTIVE_CHAIN[ONBOARDING_OBJECTIVE_CHAIN.length - 1];

    const currentProgress = onb.objectiveProgress[nextStepObj.objectiveId] || 0;
    const targetCount = nextStepObj.progressRequirements.targetCount;

    // Context adaptation: if player is inside home and on step 4, mark or prefer step 5
    const secondarySuggestions: Array<{ objectiveId: string; title: string; reason: string }> = [];
    if (onb.inHome) {
      secondarySuggestions.push({
        objectiveId: 'sec_home_explore',
        title: 'Use Household Objects (Bed, Kettle, Basin, Mirror)',
        reason: 'You are currently inside your 3D starter home—test your furniture interactions.',
      });
    } else {
      secondarySuggestions.push({
        objectiveId: 'sec_no_vehicle_job',
        title: 'Run CMS Foot Courier Shift (+₦500 GN Net)',
        reason: 'Always available without owning a vehicle.',
      });
    }
    secondarySuggestions.push({
      objectiveId: 'sec_multiplayer_coop',
      title: 'Join Marina Multiplayer Zone / Co-op Danfo Crew',
      reason: 'Team up with another live player as Driver or Conductor.',
    });

    const profileDef =
      CANONICAL_STARTER_PROFILES[acc.character?.starterProfileId || 'profile_new_arrival'] ||
      CANONICAL_STARTER_PROFILES.profile_new_arrival;

    return {
      primaryObjective: {
        objectiveId: nextStepObj.objectiveId,
        stepNumber: nextStepObj.stepNumber,
        name: nextStepObj.name,
        description: nextStepObj.description,
        whyItMatters: nextStepObj.whyItMatters,
        primaryActionLabel: nextStepObj.failureRecoveryHandling.recoveryActionLabel,
        actionFunction: nextStepObj.destinationOrTarget.actionFunction || 'executePrimaryEkoGuideAction',
        destinationOrTarget: nextStepObj.destinationOrTarget,
        contextualHelp: nextStepObj.contextualHelp,
        progressCount: currentProgress,
        targetCount,
        progressText: `Step ${nextStepObj.stepNumber} of ${ONBOARDING_OBJECTIVE_CHAIN.length} (${currentProgress}/${targetCount})`,
        isCompactDrivingMode: false,
        suppressHomeTutorials: false,
        blockerInfo,
      },
      secondarySuggestions: secondarySuggestions.slice(0, 2),
      whatShouldIDoNextPanel: {
        currentPriority: `${nextStepObj.name}: ${nextStepObj.description}`,
        whyItMatters: nextStepObj.whyItMatters,
        immediateAlternatives: [
          nextStepObj.optionalBranch.description,
          'Work an entry-level no-vehicle shift in JobsHub (+₦500 GN)',
        ],
        availableOpportunities: [
          'CMS Foot Courier (No Vehicle Required • +₦500 GN Net)',
          'Balogun Shop-Floor Assistant (No Vehicle Required • +₦500 GN Net)',
          'Bus-Stop Passenger Assistant (No Vehicle Required • +₦450 GN Net)',
          'Cooperative Danfo Conductor Role (Multiplayer • 40% Net Route Pool)',
        ],
        relevantBlockers: blockerInfo
          ? [`${blockerInfo.blockedAction}: ${blockerInfo.reason} → ${blockerInfo.recoverySuggestion}`]
          : nextStepObj.failureRecoveryHandling.commonBlockers,
        careerPathAlignment: `Advances your chosen "${profileDef.recommendedCareerName}" path toward "${profileDef.initialLifeGoalLabel}".`,
      },
      onboardingChainProgress: {
        completedCount: onb.completedObjectiveIds.length,
        totalCount: ONBOARDING_OBJECTIVE_CHAIN.length,
        tutorialSkipped: onb.tutorialSkipped,
        tutorialCompleted: onb.tutorialCompleted,
      },
    };
  }

  // 5. Post-Onboarding Career & Life Goal Next-Best-Action
  const profileDef =
    CANONICAL_STARTER_PROFILES[acc.character?.starterProfileId || 'profile_new_arrival'] ||
    CANONICAL_STARTER_PROFILES.profile_new_arrival;

  const postPrimary = {
    objectiveId: 'obj_career_growth_next',
    stepNumber: 16,
    name: `Advance Goal: ${profileDef.initialLifeGoalLabel}`,
    description:
      acc.onboarding.ownedVehicles.length === 0
        ? 'Complete entry-level shifts or Co-op Conductor runs to build capital and skill XP—no vehicle required.'
        : 'Operate your commercial corridor or expand your neighbourhood business operations.',
    whyItMatters: `Builds your Game Naira savings (currently ₦${acc.gameNairaBalance.toLocaleString()} GN) and unlocks Tier 2 career opportunities.`,
    primaryActionLabel: acc.onboarding.ownedVehicles.length === 0 ? 'Start Entry-Level Shift (+₦500 GN)' : 'Open Career & Business Hub',
    actionFunction: 'openJobsHubAction',
    progressText: `Career Level ${acc.level} • ${acc.completedJobsCount} Shifts Completed`,
    isCompactDrivingMode: false,
    suppressHomeTutorials: false,
    blockerInfo,
  };

  return {
    primaryObjective: postPrimary,
    secondarySuggestions: [
      {
        objectiveId: 'sec_coop_danfo',
        title: 'Join Cooperative Danfo Route (Driver or Conductor)',
        reason: 'Earn 60%/40% net route pool with another authenticated player.',
      },
      {
        objectiveId: 'sec_upgrade_home',
        title: 'Upgrade Home Comfort in Household Shop',
        reason: 'Higher comfort boosts daily energy and mood resilience.',
      },
    ],
    whatShouldIDoNextPanel: {
      currentPriority: postPrimary.name,
      whyItMatters: postPrimary.whyItMatters,
      immediateAlternatives: [
        'Run a no-vehicle Foot Courier or Shop Assistant shift (+₦500 GN)',
        'Team up in a Multiplayer Crew for a Cooperative Danfo route',
      ],
      availableOpportunities: [
        '6 Entry-Level No-Vehicle Jobs',
        'Cooperative Danfo Route (CMS → Marina → Obalende)',
        'Neighbourhood Kiosk & Bukka Business Operations',
      ],
      relevantBlockers: blockerInfo ? [blockerInfo.reason] : [],
      careerPathAlignment: `Directly progresses your "${profileDef.recommendedCareerName}" track and "${profileDef.initialLifeGoalLabel}" goal.`,
    },
    onboardingChainProgress: {
      completedCount: onb.completedObjectiveIds.length,
      totalCount: ONBOARDING_OBJECTIVE_CHAIN.length,
      tutorialSkipped: onb.tutorialSkipped,
      tutorialCompleted: onb.tutorialCompleted,
    },
  };
}

// ============================================================================
// PHASE 3: IDEMPOTENT QUEST EVENT PROCESSOR
// ============================================================================
export function processProgressionEvent(
  acc: M47AccountRecord,
  eventPayload: {
    eventId: string;
    eventType: string;
    metadata?: Record<string, any>;
  }
) {
  const eventId = String(eventPayload.eventId || '').trim();
  const eventType = String(eventPayload.eventType || '').trim();
  if (!eventId || !eventType) {
    return { ok: false, error: 'MISSING_EVENT_ID_OR_TYPE' };
  }

  // Idempotency Check: never process the same eventId twice!
  if (acc.onboarding.processedEventIds.includes(eventId)) {
    return {
      ok: true,
      duplicateIgnored: true,
      eventId,
      eventType,
      guideState: evaluateNextBestAction(acc),
    };
  }

  acc.onboarding.processedEventIds.push(eventId);
  const meta = eventPayload.metadata || {};
  acc.onboarding.lastProgressionEvent = { eventId, eventType, timestamp: Date.now() };
  if (!acc.onboarding.ownedOutfits) {
    acc.onboarding.ownedOutfits = ['outfit_street_hustler', 'outfit_sunday_senator'];
  }

  // Canonical event alias normalization so both M4.7 Phase 1 event names and internal objective triggers work seamlessly
  const EVENT_ALIASES: Record<string, string> = {
    AccountRegistered: 'AccountCreated',
    CharacterCreated: 'ProfileCreated',
    CharacterProfileCompleted: 'ProfileCreated',
    InitialOutfitSelected: 'ProfileCreated',
    StarterProfileSelected: 'StarterHomeClaimed',
    StarterHomeAssigned: 'StarterHomeClaimed',
    ShiftCheckpointCompleted: 'JobLocationReached',
    JobCompleted: 'JobTaskCompleted',
    ClothingPurchased: 'ItemPurchased',
    FurniturePlaced: 'ItemPlaced',
    FirstDayCompleted: 'HomeProgressVerified',
  };
  const normalizedEventType = EVENT_ALIASES[eventType] || eventType;

  // Update contextual flags from trusted event metadata
  if (normalizedEventType === 'HomeEntered') {
    acc.onboarding.inHome = true;
    acc.onboarding.isDriving = false;
    recordAnalyticsFunnelEvent(acc.accountId, 'StarterHomeEntered', meta);
  } else if (normalizedEventType === 'HomeExited') {
    acc.onboarding.inHome = false;
  } else if (normalizedEventType === 'HouseholdObjectUsed') {
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstHouseholdInteraction', meta);
  } else if (eventType === 'WardrobeOpened') {
    acc.onboarding.wardrobeOpened = true;
  } else if (eventType === 'ClothingEquipped' || eventType === 'InitialOutfitSelected') {
    acc.onboarding.clothingEquipped = true;
    if (meta.outfitId) {
      acc.onboarding.equippedOutfitId = String(meta.outfitId);
      acc.wearableEquipped = String(meta.outfitId);
    }
  } else if (normalizedEventType === 'JobsHubOpened') {
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstJobViewed', meta);
  } else if (normalizedEventType === 'JobAccepted') {
    acc.onboarding.activeJobId = meta.jobId || 'job_foot_courier';
    acc.onboarding.activeJobCheckpointsDone = 0;
    acc.onboarding.lastBlockedReason = null;
    if (meta.activeJobShift) {
      acc.onboarding.activeJobShift = meta.activeJobShift;
    }
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstJobAccepted', meta);
  } else if (normalizedEventType === 'JobLocationReached') {
    acc.onboarding.inHome = false;
    const stepDone = Math.max(1, Number(meta.completedCount || meta.stepNumber || (acc.onboarding.activeJobCheckpointsDone + 1)));
    acc.onboarding.activeJobCheckpointsDone = stepDone;
    if (acc.onboarding.activeJobShift) {
      acc.onboarding.activeJobShift.currentStepIndex = stepDone;
    }
  } else if (normalizedEventType === 'JobTaskCompleted') {
    const reportedDone = Number(meta.checkpointsCompleted ?? acc.onboarding.activeJobCheckpointsDone ?? 3);
    if (reportedDone < 3) {
      acc.onboarding.lastBlockedReason = 'JOB_CHECKPOINTS_INCOMPLETE';
      recordAnalyticsFunnelEvent(acc.accountId, 'ObjectiveBlocked', { reason: 'JOB_CHECKPOINTS_INCOMPLETE', reportedDone });
      saveStore();
      return {
        ok: true,
        duplicateIgnored: false,
        eventId,
        eventType,
        newlyCompletedObjectives: [],
        playerSummary: {
          accountId: acc.accountId,
          gameNairaBalance: acc.gameNairaBalance,
          xp: acc.xp,
          level: acc.level,
          reputation: acc.reputation,
          completedJobsCount: acc.completedJobsCount,
        },
        guideState: evaluateNextBestAction(acc),
      };
    }
    acc.onboarding.activeJobCheckpointsDone = Math.max(3, reportedDone);
    acc.onboarding.activeJobShift = null;
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstJobCompleted', meta);
  } else if (normalizedEventType === 'JobSettlementPosted') {
    const taskAlreadyVerified =
      acc.onboarding.activeJobCheckpointsDone >= 3 ||
      acc.onboarding.completedObjectiveIds.includes('obj_10_complete_job_gameplay') ||
      Number(meta.checkpointsCompleted || 0) >= 3;
    if (!taskAlreadyVerified) {
      acc.onboarding.lastBlockedReason = 'JOB_CHECKPOINTS_INCOMPLETE';
      recordAnalyticsFunnelEvent(acc.accountId, 'ObjectiveBlocked', { reason: 'JOB_CHECKPOINTS_INCOMPLETE' });
      saveStore();
      return {
        ok: true,
        duplicateIgnored: false,
        eventId,
        eventType,
        newlyCompletedObjectives: [],
        playerSummary: {
          accountId: acc.accountId,
          gameNairaBalance: acc.gameNairaBalance,
          xp: acc.xp,
          level: acc.level,
          reputation: acc.reputation,
          completedJobsCount: acc.completedJobsCount,
        },
        guideState: evaluateNextBestAction(acc),
      };
    }
    acc.completedJobsCount += 1;
    acc.onboarding.activeJobId = null;
    acc.onboarding.activeJobCheckpointsDone = 0;
    acc.onboarding.activeJobShift = null;
    // Client-reported pay is never trusted as-is: it must reference a concrete shift, is capped at the
    // highest legitimate street-job payout, and settlements are rate-limited per account.
    const MAX_JOB_SETTLEMENT_GN = 4550;
    const MIN_SECONDS_BETWEEN_JOB_SETTLEMENTS = 45;
    const reportedPay = Math.floor(Number(meta.netPayGN || 0));
    const shiftRef = typeof meta.shiftId === 'string' && meta.shiftId.length >= 4 ? meta.shiftId.slice(0, 96) : null;
    const lastSettleAt = Number((acc.onboarding as any).lastJobSettlementAt || 0);
    const tooSoon = Date.now() - lastSettleAt < MIN_SECONDS_BETWEEN_JOB_SETTLEMENTS * 1000;
    const netPay = Number.isFinite(reportedPay) ? Math.max(0, Math.min(MAX_JOB_SETTLEMENT_GN, reportedPay)) : 0;
    if (netPay > 0 && shiftRef && !tooSoon) {
      const posted = postAccountLedgerTransaction(acc, {
        idempotencyKey: `idem_job_settle_${acc.accountId}_${shiftRef}`,
        description: `Verified Job Shift Settlement (${String(meta.title || meta.jobId || 'Entry Shift').slice(0, 80)})`,
        amountGN: netPay,
        counterpartyAccount: 'SYS_TREASURY_PAYROLL',
      });
      if (!posted.duplicate) (acc.onboarding as any).lastJobSettlementAt = Date.now();
    } else if (netPay > 0) {
      acc.onboarding.lastBlockedReason = tooSoon ? 'JOB_SETTLEMENT_RATE_LIMITED' : 'JOB_SETTLEMENT_SHIFT_REFERENCE_REQUIRED';
    }
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstSettlementReceived', meta);
  } else if (normalizedEventType === 'ItemPurchased') {
    acc.onboarding.firstPurchaseCompleted = true;
    if (meta.itemId && !acc.ownedFurniture.includes(meta.itemId)) {
      acc.ownedFurniture.push(meta.itemId);
    }
    if (meta.itemId === 'itm_everyday_shirt' && !acc.onboarding.ownedOutfits.includes('outfit_corporate_suit')) {
      acc.onboarding.ownedOutfits.push('outfit_corporate_suit');
    }
    if (meta.itemId === 'itm_ceremonial_asoebi' && !acc.onboarding.ownedOutfits.includes('outfit_owambe_agbada')) {
      acc.onboarding.ownedOutfits.push('outfit_owambe_agbada');
    }
    const price = Number(meta.priceGN || 0);
    if (price > 0 && acc.gameNairaBalance >= price) {
      postAccountLedgerTransaction(acc, {
        idempotencyKey: `idem_shop_buy_${acc.accountId}_${meta.purchaseId || eventId}`,
        description: `Shop Purchase (${meta.itemId || 'Household Item'})`,
        amountGN: -price,
        counterpartyAccount: 'MERCHANT_LAGOS_RETAIL',
      });
    }
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstShopPurchase', meta);
  } else if (normalizedEventType === 'ItemPlaced') {
    acc.onboarding.firstPurchasedItemUsedOrPlaced = true;
    if (meta.itemId && typeof meta.x === 'number' && typeof meta.z === 'number') {
      const existingIdx = acc.placedFurniture.findIndex((f) => f.itemId === meta.itemId);
      const entry = {
        itemId: meta.itemId,
        x: Number(meta.x),
        y: Number(meta.y || 0),
        z: Number(meta.z),
        rotY: Number(meta.rotY || 0),
      };
      if (existingIdx >= 0) acc.placedFurniture[existingIdx] = entry;
      else acc.placedFurniture.push(entry);
    }
  } else if (normalizedEventType === 'HomeProgressVerified') {
    acc.onboarding.firstDayCompleted = true;
  } else if (eventType === 'SkillIncreased') {
    const skId = String(meta.skillId || 'skill_route_knowledge');
    const pts = Math.max(1, Number(meta.points) || 5);
    acc.skills[skId] = Math.min(100, (acc.skills[skId] || 10) + pts);
  } else if (eventType === 'VehicleAcquired') {
    if (meta.vehicleId && !acc.onboarding.ownedVehicles.includes(meta.vehicleId)) {
      acc.onboarding.ownedVehicles.push(meta.vehicleId);
    }
  } else if (eventType === 'CrewJoined' || eventType === 'PassengerDelivered') {
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstMultiplayerInteraction', meta);
  } else if (eventType === 'ArcadeRunCompleted') {
    recordAnalyticsFunnelEvent(acc.accountId, 'FirstArcadeRun', meta);
  } else if (eventType === 'ObjectiveBlocked') {
    acc.onboarding.lastBlockedReason = String(meta.reason || 'PREREQUISITE_NOT_MET');
    recordAnalyticsFunnelEvent(acc.accountId, 'ObjectiveBlocked', meta);
  }

  // Advance matching objectives whose prerequisites are satisfied (or allow non-blocking progression if triggered)
  const newlyCompletedObjectives: string[] = [];
  for (const obj of ONBOARDING_OBJECTIVE_CHAIN) {
    if (acc.onboarding.completedObjectiveIds.includes(obj.objectiveId)) continue;
    if (!obj.triggeringEvents.includes(eventType) && !obj.triggeringEvents.includes(normalizedEventType)) continue;

    // Auto-complete earlier implied steps when a verified downstream milestone succeeds
    // (e.g., if player buys an item, ShopVisited is also satisfied)
    const increment = normalizedEventType === 'JobTaskCompleted' ? 3 : 1;
    const prevProg = acc.onboarding.objectiveProgress[obj.objectiveId] || 0;
    const nextProg = Math.min(obj.progressRequirements.targetCount, prevProg + increment);
    acc.onboarding.objectiveProgress[obj.objectiveId] = nextProg;

    if (nextProg >= obj.progressRequirements.targetCount) {
      acc.onboarding.completedObjectiveIds.push(obj.objectiveId);
      newlyCompletedObjectives.push(obj.objectiveId);
      acc.xp += obj.rewardDefinition.xp;
      acc.reputation = Math.min(100, acc.reputation + obj.rewardDefinition.reputation);
      acc.level = Math.max(1, 1 + Math.floor(acc.xp / 250));
      if (obj.rewardDefinition.skillReward) {
        const sk = obj.rewardDefinition.skillReward.skillId;
        acc.skills[sk] = Math.min(100, (acc.skills[sk] || 10) + obj.rewardDefinition.skillReward.points);
      }
      if (obj.rewardDefinition.bonusGN > 0) {
        postAccountLedgerTransaction(acc, {
          idempotencyKey: `idem_obj_reward_${acc.accountId}_${obj.objectiveId}`,
          description: `Onboarding Milestone Graduation Bonus (${obj.name})`,
          amountGN: obj.rewardDefinition.bonusGN,
          counterpartyAccount: 'SYS_TREASURY_MINT',
        });
      }
    }
  }

  if (acc.onboarding.completedObjectiveIds.length >= ONBOARDING_OBJECTIVE_CHAIN.length) {
    acc.onboarding.tutorialCompleted = true;
    recordAnalyticsFunnelEvent(acc.accountId, 'OnboardingCompleted', {
      completedCount: acc.onboarding.completedObjectiveIds.length,
    });
  }

  saveStore();
  return {
    ok: true,
    duplicateIgnored: false,
    eventId,
    eventType,
    newlyCompletedObjectives,
    playerSummary: {
      accountId: acc.accountId,
      gameNairaBalance: acc.gameNairaBalance,
      xp: acc.xp,
      level: acc.level,
      reputation: acc.reputation,
      completedJobsCount: acc.completedJobsCount,
    },
    guideState: evaluateNextBestAction(acc),
  };
}

// ============================================================================
// PHASE 5: EKOPROGRESS & CAREER UNLOCK MAP
// ============================================================================
export function buildEkoProgressMap(acc: M47AccountRecord) {
  const profileDef =
    CANONICAL_STARTER_PROFILES[acc.character?.starterProfileId || 'profile_new_arrival'] ||
    CANONICAL_STARTER_PROFILES.profile_new_arrival;

  const opportunities = [
    // Tier 1: Unlocked from Day 1 (No vehicle required!)
    {
      opportunityId: 'job_entry_foot_courier',
      title: 'CMS Foot Courier (No Vehicle Required)',
      trackId: 'career_logistics_delivery',
      trackName: 'Logistics & Courier Operations',
      tier: 1,
      requiresVehicle: false,
      netPayGN: 500,
      requiredLevel: 1,
      requiredCompletedJobs: 0,
      requiredSkill: null as null | { skillId: string; minPoints: number },
      requiredReputation: 0,
    },
    {
      opportunityId: 'job_entry_shop_assistant',
      title: 'Balogun Market Shop-Floor Assistant (No Vehicle Required)',
      trackId: 'career_commerce_market',
      trackName: 'Commerce, Market & Retail Trade',
      tier: 1,
      requiresVehicle: false,
      netPayGN: 500,
      requiredLevel: 1,
      requiredCompletedJobs: 0,
      requiredSkill: null,
      requiredReputation: 0,
    },
    {
      opportunityId: 'job_entry_bus_stop_caller',
      title: 'Bus-Stop Passenger Assistant (No Vehicle Required)',
      trackId: 'career_mobility_transport',
      trackName: 'Mobility & Transport Operations',
      tier: 1,
      requiresVehicle: false,
      netPayGN: 450,
      requiredLevel: 1,
      requiredCompletedJobs: 0,
      requiredSkill: null,
      requiredReputation: 0,
    },
    {
      opportunityId: 'job_entry_workshop_apprentice',
      title: 'Roadside Workshop Apprentice (No Vehicle Required)',
      trackId: 'career_skilled_trades_utilities',
      trackName: 'Skilled Trades, Mechanics & Utilities',
      tier: 1,
      requiresVehicle: false,
      netPayGN: 450,
      requiredLevel: 1,
      requiredCompletedJobs: 0,
      requiredSkill: null,
      requiredReputation: 0,
    },
    {
      opportunityId: 'job_entry_civic_greeter',
      title: 'Yaba Hub Community & Event Assistant (No Vehicle Required)',
      trackId: 'career_civic_community',
      trackName: 'Civic, Education & Community Services',
      tier: 1,
      requiresVehicle: false,
      netPayGN: 450,
      requiredLevel: 1,
      requiredCompletedJobs: 0,
      requiredSkill: null,
      requiredReputation: 0,
    },
    // Tier 2: Non-Driving & Co-op Mid-Tier Opportunities
    {
      opportunityId: 'job_mid_market_stall_supervisor',
      title: 'Balogun Senior Retail Stall Supervisor (Non-Driving Path)',
      trackId: 'career_commerce_market',
      trackName: 'Commerce, Market & Retail Trade',
      tier: 2,
      requiresVehicle: false,
      netPayGN: 1200,
      requiredLevel: 2,
      requiredCompletedJobs: 2,
      requiredSkill: { skillId: 'skill_financial_literacy', minPoints: 18 },
      requiredReputation: 55,
    },
    {
      opportunityId: 'job_mid_certified_mechanic_tech',
      title: 'Surulere Certified Diagnostic Technician (Non-Driving Path)',
      trackId: 'career_skilled_trades_utilities',
      trackName: 'Skilled Trades, Mechanics & Utilities',
      tier: 2,
      requiresVehicle: false,
      netPayGN: 1350,
      requiredLevel: 2,
      requiredCompletedJobs: 2,
      requiredSkill: { skillId: 'skill_mechanical_care', minPoints: 20 },
      requiredReputation: 55,
    },
    {
      opportunityId: 'job_mid_digital_media_producer',
      title: 'Yaba Digital Studio Contract Producer (Non-Driving Path)',
      trackId: 'career_creative_media_culture',
      trackName: 'Creative Media, Tech & Culture',
      tier: 2,
      requiresVehicle: false,
      netPayGN: 1400,
      requiredLevel: 2,
      requiredCompletedJobs: 2,
      requiredSkill: { skillId: 'skill_civic_discipline', minPoints: 20 },
      requiredReputation: 55,
    },
    {
      opportunityId: 'job_mid_danfo_owner_driver',
      title: 'Commercial Danfo Corridor Captain (Driving Path)',
      trackId: 'career_mobility_transport',
      trackName: 'Mobility & Transport Operations',
      tier: 2,
      requiresVehicle: true,
      netPayGN: 1800,
      requiredLevel: 2,
      requiredCompletedJobs: 3,
      requiredSkill: { skillId: 'skill_route_knowledge', minPoints: 20 },
      requiredReputation: 60,
    },
  ];

  const evaluatedOpportunities = opportunities.map((opp) => {
    const missingRequirements: string[] = [];
    if (acc.level < opp.requiredLevel) {
      missingRequirements.push(`Reach Citizen Level ${opp.requiredLevel} (Currently Level ${acc.level})`);
    }
    if (acc.completedJobsCount < opp.requiredCompletedJobs) {
      missingRequirements.push(
        `Complete ${opp.requiredCompletedJobs} verified shifts (Currently ${acc.completedJobsCount}/${opp.requiredCompletedJobs})`
      );
    }
    if (opp.requiredSkill) {
      const currentPts = acc.skills[opp.requiredSkill.skillId] || 0;
      if (currentPts < opp.requiredSkill.minPoints) {
        missingRequirements.push(
          `Increase ${opp.requiredSkill.skillId} to ${opp.requiredSkill.minPoints} pts (Currently ${currentPts} pts)`
        );
      }
    }
    if (acc.reputation < opp.requiredReputation) {
      missingRequirements.push(`Reach Reputation ${opp.requiredReputation} (Currently ${acc.reputation})`);
    }
    if (opp.requiresVehicle && acc.onboarding.ownedVehicles.length === 0) {
      missingRequirements.push('Acquire or lease a qualifying commercial vehicle (Note: Non-driving Tier 2 careers do NOT require a vehicle)');
    }

    const isUnlocked = missingRequirements.length === 0;
    return {
      ...opp,
      isUnlocked,
      statusLabel: isUnlocked ? 'UNLOCKED & ELIGIBLE' : 'LOCKED — PREREQUISITES OUTSTANDING',
      missingRequirements,
      lockExplanation: isUnlocked
        ? 'All eligibility requirements met. Ready to start.'
        : `Locked until you satisfy: ${missingRequirements.join(' • ')}`,
    };
  });

  const unlockedList = evaluatedOpportunities.filter((o) => o.isUnlocked);
  const lockedList = evaluatedOpportunities.filter((o) => !o.isUnlocked);
  const nextUnlock = lockedList[0] || null;

  const achievements = [
    {
      achievementId: 'ach_first_citizen',
      title: 'Registered Lagos Citizen',
      unlocked: acc.characterCreated,
      description: 'Created a verified citizen identity and claimed a starter profile.',
    },
    {
      achievementId: 'ach_first_day_earner',
      title: 'Honest First Day Hustle',
      unlocked: acc.completedJobsCount >= 1,
      description: 'Completed a verified shift and received authoritative Game Naira settlement.',
    },
    {
      achievementId: 'ach_home_upgrader',
      title: 'Compound Comfort Upgrader',
      unlocked: acc.ownedFurniture.length > 5,
      description: 'Purchased and placed a new household item in your 3D starter home.',
    },
    {
      achievementId: 'ach_onboarding_grad',
      title: 'Lagos First-Day Graduate',
      unlocked: acc.onboarding.tutorialCompleted,
      description: 'Completed the 15-step First-Day Onboarding chain.',
    },
  ];

  return {
    accountId: acc.accountId,
    currentCareerId: profileDef.recommendedCareerId,
    currentCareerName: profileDef.recommendedCareerName,
    currentLifeGoalId: profileDef.initialLifeGoalId,
    currentLifeGoalLabel: profileDef.initialLifeGoalLabel,
    currentLevel: acc.level,
    currentXp: acc.xp,
    xpToNextLevel: acc.level * 250 - acc.xp,
    reputation: acc.reputation,
    completedJobsCount: acc.completedJobsCount,
    skills: acc.skills,
    achievements,
    nonDrivingPathsAvailable: true,
    unlockedOpportunities: unlockedList,
    lockedOpportunities: lockedList,
    nextUnlockedOpportunity: nextUnlock,
    allOpportunities: evaluatedOpportunities,
  };
}

// ============================================================================
// PHASE 6: STANDALONE HUSTLE FLOW MULTIPLIER ENGINE
// ============================================================================
export const VALID_HUSTLE_QUALIFYING_EVENTS: Record<string, { label: string; streakGain: number }> = {
  ACCURATE_STOP_EXECUTION: { label: 'Accurate Passenger-Stop Execution', streakGain: 1 },
  VALID_PASSENGER_PICKUP: { label: 'Valid Passenger Pickup', streakGain: 1 },
  CLEAN_DRIVING_SEQUENCE: { label: 'Clean Driving Sequence', streakGain: 1 },
  VERIFIED_MISSION_MILESTONE: { label: 'Verified Mission Milestone', streakGain: 2 },
  ARCADE_ROUTE_OBJECTIVE: { label: 'Arcade Route Objective', streakGain: 2 },
  LEGITIMATE_SKILL_CHALLENGE: { label: 'Legitimate Skill Challenge', streakGain: 1 },
};

export function evaluateHustleFlowEvent(
  acc: M47AccountRecord,
  payload: {
    actionEventId: string;
    eventType:
      | 'ACCURATE_STOP_EXECUTION'
      | 'VALID_PASSENGER_PICKUP'
      | 'CLEAN_DRIVING_SEQUENCE'
      | 'VERIFIED_MISSION_MILESTONE'
      | 'ARCADE_ROUTE_OBJECTIVE'
      | 'LEGITIMATE_SKILL_CHALLENGE'
      | 'COLLISION_PENALTY'
      | 'MISSED_STOP_PENALTY'
      | 'FAILED_OBJECTIVE_RESET'
      | 'INACTIVITY_DECAY_TICK'
      | 'SET_MODE'
      | 'CALCULATE_REWARD';
    mode?: PlayerHustleFlowState['currentMode'];
    rewardCategory?: PlayerHustleFlowState['currentRewardCategory'];
    baseScore?: number;
    baseHustleCoins?: number;
    baseWageGN?: number;
    baseBusinessYieldGN?: number;
    baseRealReward?: number;
    runId?: string;
    simulatedElapsedMs?: number;
    clientTimestamp?: number;
  },
  config: HustleFlowConfig = DEFAULT_HUSTLE_FLOW_CONFIG
) {
  const hf = acc.hustleFlow;
  const now = Date.now();
  const actionEventId = String(payload.actionEventId || '').trim();

  if (payload.mode) {
    hf.currentMode = payload.mode;
  }
  if (payload.rewardCategory) {
    hf.currentRewardCategory = payload.rewardCategory;
  } else {
    if (hf.currentMode === 'ARCADE_DANFO_RUN' || hf.currentMode === 'COOP_DANFO') {
      hf.currentRewardCategory = 'ARCADE_SCORE_AND_HUSTLE_COIN';
    } else if (hf.currentMode === 'NORMAL_JOB') {
      hf.currentRewardCategory = 'NORMAL_WAGE';
    } else {
      hf.currentRewardCategory = 'NONE';
    }
  }

  // Anti-exploit 1: Detect browser-clock manipulation if clientTimestamp drifts > 60s from server clock
  let clockManipulationDetected = false;
  if (typeof payload.clientTimestamp === 'number' && Math.abs(payload.clientTimestamp - now) > 60000) {
    clockManipulationDetected = true;
    hf.rejectedExploitAttempts += 1;
  }

  // Anti-exploit 2: Duplicate actionEventId check
  if (
    actionEventId &&
    payload.eventType !== 'SET_MODE' &&
    payload.eventType !== 'CALCULATE_REWARD' &&
    hf.processedActionIds.includes(actionEventId)
  ) {
    hf.rejectedExploitAttempts += 1;
    saveStore();
    return {
      ok: false,
      duplicateRejected: true,
      error: 'DUPLICATE_HUSTLE_EVENT_REJECTED',
      state: formatHustleFlowResponse(hf, config),
    };
  }

  // Anti-exploit 3: Run reset duplication check
  if (payload.runId && payload.eventType === 'CALCULATE_REWARD') {
    if (hf.completedRunIds.includes(payload.runId)) {
      hf.rejectedExploitAttempts += 1;
      saveStore();
      return {
        ok: false,
        duplicateRunRejected: true,
        error: 'DUPLICATE_RUN_REWARD_REJECTED',
        state: formatHustleFlowResponse(hf, config),
      };
    }
    hf.completedRunIds.push(payload.runId);
  }

  // Check inactivity decay first
  const elapsedMs =
    typeof payload.simulatedElapsedMs === 'number'
      ? payload.simulatedElapsedMs
      : now - (hf.lastActionServerTimestamp || now);

  if (payload.eventType === 'INACTIVITY_DECAY_TICK' || elapsedMs >= config.inactivityDecayWindowMs) {
    if (hf.currentMultiplier > config.defaultMultiplier) {
      const stepsDecayed = Math.max(1, Math.floor(elapsedMs / config.inactivityDecayWindowMs));
      const newMult = Math.max(
        config.defaultMultiplier,
        Number((hf.currentMultiplier - stepsDecayed * config.decayStepAmount).toFixed(2))
      );
      hf.currentMultiplier = newMult;
      hf.currentQualifyingStreak = Math.max(
        0,
        Math.round(((newMult - config.defaultMultiplier) / config.multiplierIncrementPerStep) * config.streakStepSize)
      );
      hf.reasonForLastChange = `Inactivity decay (-${(stepsDecayed * config.decayStepAmount).toFixed(2)}x after ${Math.round(elapsedMs / 1000)}s idle)`;
      hf.lastActionServerTimestamp = now;
    }
  }

  // Process Penalties
  if (payload.eventType === 'COLLISION_PENALTY') {
    if (actionEventId) hf.processedActionIds.push(actionEventId);
    hf.collisionCount += 1;
    hf.failurePenaltyCount += 1;
    hf.currentMultiplier = Math.max(
      config.defaultMultiplier,
      Number((hf.currentMultiplier + config.collisionPenaltyDelta).toFixed(2))
    );
    hf.currentQualifyingStreak = Math.max(0, hf.currentQualifyingStreak - 2);
    hf.reasonForLastChange = `Collision penalty (${config.collisionPenaltyDelta}x) — drive cleanly to rebuild Hustle Flow`;
    hf.lastActionServerTimestamp = now;
  } else if (payload.eventType === 'MISSED_STOP_PENALTY') {
    if (actionEventId) hf.processedActionIds.push(actionEventId);
    hf.failurePenaltyCount += 1;
    hf.currentMultiplier = Math.max(
      config.defaultMultiplier,
      Number((hf.currentMultiplier + config.missedStopPenaltyDelta).toFixed(2))
    );
    hf.currentQualifyingStreak = Math.max(0, hf.currentQualifyingStreak - 1);
    hf.reasonForLastChange = `Missed bus stop penalty (${config.missedStopPenaltyDelta}x)`;
    hf.lastActionServerTimestamp = now;
  } else if (payload.eventType === 'FAILED_OBJECTIVE_RESET') {
    if (actionEventId) hf.processedActionIds.push(actionEventId);
    hf.failurePenaltyCount += 1;
    hf.currentMultiplier = config.failedObjectiveResetTo;
    hf.currentQualifyingStreak = 0;
    hf.reasonForLastChange = 'Route objective failed — Hustle Flow reset to 1.0x';
    hf.lastActionServerTimestamp = now;
  } else if (VALID_HUSTLE_QUALIFYING_EVENTS[payload.eventType]) {
    // Qualifying event
    if (actionEventId) hf.processedActionIds.push(actionEventId);
    const def = VALID_HUSTLE_QUALIFYING_EVENTS[payload.eventType];
    hf.currentQualifyingStreak += def.streakGain;
    hf.lastQualifyingAction = def.label;
    hf.lastActionServerTimestamp = now;

    const rawMult =
      config.defaultMultiplier +
      Math.floor(hf.currentQualifyingStreak / config.streakStepSize) * config.multiplierIncrementPerStep;
    hf.currentMultiplier = Math.min(config.arcadeScoreMaxCap, Number(rawMult.toFixed(2)));
    hf.reasonForLastChange = `+${def.streakGain} Streak (${def.label}) → ${hf.currentMultiplier.toFixed(2)}x`;

    hf.recentQualifyingActions.unshift({
      actionId: actionEventId || `act_${now}`,
      type: payload.eventType,
      deltaStreak: def.streakGain,
      multiplierAfter: hf.currentMultiplier,
      timestamp: now,
    });
    if (hf.recentQualifyingActions.length > 10) hf.recentQualifyingActions.pop();
  }

  // Update effective multipliers by category
  hf.arcadeEffectiveMultiplier = Math.min(config.arcadeScoreMaxCap, hf.currentMultiplier);
  hf.hustleCoinEffectiveMultiplier = Math.min(config.hustleCoinMaxCap, hf.currentMultiplier);
  hf.normalWageEffectiveMultiplier = 1.0; // Invariant: Normal wages are NEVER multiplied
  hf.multiplierCap =
    hf.currentRewardCategory === 'ARCADE_SCORE_AND_HUSTLE_COIN' || hf.currentRewardCategory === 'ARCADE_SCORE'
      ? config.arcadeScoreMaxCap
      : 1.0;

  // Calculate deterministic server-validated reward outputs if requested
  const baseScore = Math.max(0, Number(payload.baseScore || 0));
  const baseHustleCoins = Math.max(0, Number(payload.baseHustleCoins || 0));
  const baseWageGN = Math.max(0, Number(payload.baseWageGN || 0));
  const baseBusinessYieldGN = Math.max(0, Number(payload.baseBusinessYieldGN || 0));
  const baseRealReward = Math.max(0, Number(payload.baseRealReward || 0));

  const rewardCalculation = {
    baseScore,
    multipliedArcadeScore: Math.round(baseScore * hf.arcadeEffectiveMultiplier),
    arcadeMultiplierApplied: hf.arcadeEffectiveMultiplier,
    baseHustleCoins,
    multipliedHustleCoins: Math.round(baseHustleCoins * hf.hustleCoinEffectiveMultiplier),
    hustleCoinMultiplierApplied: hf.hustleCoinEffectiveMultiplier,
    baseWageGN,
    settledWageGN: baseWageGN, // Strictly 1.0x
    wageMultiplierApplied: 1.0,
    baseBusinessYieldGN,
    settledBusinessYieldGN: baseBusinessYieldGN, // Strictly 1.0x
    businessMultiplierApplied: 1.0,
    baseRealReward,
    settledRealReward: 0, // Real rewards disabled & strictly 1.0x
    realRewardMultiplierApplied: 1.0,
  };

  if (payload.eventType === 'CALCULATE_REWARD' && rewardCalculation.multipliedHustleCoins > 0) {
    acc.hustleCoinsBalance += rewardCalculation.multipliedHustleCoins;
  }

  saveStore();
  return {
    ok: true,
    duplicateRejected: false,
    clockManipulationDetected,
    rewardCalculation,
    state: formatHustleFlowResponse(hf, config),
  };
}

function formatHustleFlowResponse(hf: PlayerHustleFlowState, config: HustleFlowConfig) {
  const isRelevantMode = hf.currentMode === 'ARCADE_DANFO_RUN' || hf.currentMode === 'COOP_DANFO';
  const arcadeBonusPct = Math.round((hf.arcadeEffectiveMultiplier - 1.0) * 100);
  const coinBonusPct = Math.round((hf.hustleCoinEffectiveMultiplier - 1.0) * 100);

  let displayBannerText = `${hf.arcadeEffectiveMultiplier.toFixed(1)}x Hustle Flow — +${arcadeBonusPct}% arcade score.`;
  if (hf.currentRewardCategory === 'ARCADE_SCORE_AND_HUSTLE_COIN' && coinBonusPct > 0) {
    displayBannerText = `${hf.arcadeEffectiveMultiplier.toFixed(1)}x Hustle Flow — +${arcadeBonusPct}% arcade score • +${coinBonusPct}% Eko Hustle Coins.`;
  }

  const nextStepStreak =
    (Math.floor(hf.currentQualifyingStreak / config.streakStepSize) + 1) * config.streakStepSize;
  const streakToNextLevel = Math.max(0, nextStepStreak - hf.currentQualifyingStreak);

  return {
    ...hf,
    isVisibleInHud: isRelevantMode,
    whatItMultiplies: isRelevantMode
      ? hf.currentRewardCategory === 'ARCADE_SCORE_AND_HUSTLE_COIN'
        ? 'Arcade Score (up to 3.0x provisional) & Eligible Eko Hustle Coins (up to 2.0x provisional). Does NOT multiply normal Game Naira wages or business yields.'
        : 'Arcade Score (up to 3.0x provisional).'
      : 'Inactive in current mode (Normal wages, shop, and home interactions use 1.0x fixed rules).',
    displayBannerText,
    progressToNextLevel: {
      currentStreak: hf.currentQualifyingStreak,
      nextLevelAtStreak: nextStepStreak,
      actionsRemainingForNextStep: hf.arcadeEffectiveMultiplier >= config.arcadeScoreMaxCap ? 0 : streakToNextLevel,
    },
    tuningConfig: {
      ...config,
      playtestAssumptionNotice: 'Arcade 3.0x cap and Eko Hustle Coin 2.0x cap are provisional playtest tuning assumptions.',
    },
  };
}

// ============================================================================
// PHASE 8: INTERNAL FUNNEL DASHBOARD SPECIFICATION & LIVE METRICS
// ============================================================================
export function buildAnalyticsFunnelReport() {
  const requiredFunnelStages = [
    'SignupStarted',
    'SignupCompleted',
    'CharacterCreationCompleted',
    'StarterHomeEntered',
    'FirstHouseholdInteraction',
    'FirstJobViewed',
    'FirstJobAccepted',
    'FirstJobCompleted',
    'FirstSettlementReceived',
    'FirstShopPurchase',
    'FirstMultiplayerInteraction',
    'FirstArcadeRun',
    'OnboardingCompleted',
    'ObjectiveDismissedOrAbandoned',
    'ObjectiveBlocked',
    'SessionResumedAfterDisconnect',
  ];

  const countsByStage: Record<string, number> = {};
  const uniqueAccountsByStage: Record<string, Set<string>> = {};
  for (const stage of requiredFunnelStages) {
    countsByStage[stage] = 0;
    uniqueAccountsByStage[stage] = new Set<string>();
  }

  for (const ev of store.analyticsEvents) {
    if (countsByStage[ev.eventName] !== undefined) {
      countsByStage[ev.eventName] += 1;
      uniqueAccountsByStage[ev.eventName].add(ev.accountId);
    }
  }

  const timeToFirstActionSamplesMs: number[] = [];
  for (const rec of Object.values(store.firstActionTimestamps)) {
    if (rec.signupStartedAt && rec.firstMeaningfulActionAt && rec.firstMeaningfulActionAt >= rec.signupStartedAt) {
      timeToFirstActionSamplesMs.push(rec.firstMeaningfulActionAt - rec.signupStartedAt);
    }
  }
  const medianTimeToFirstMeaningfulActionMs =
    timeToFirstActionSamplesMs.length > 0
      ? timeToFirstActionSamplesMs.sort((a, b) => a - b)[Math.floor(timeToFirstActionSamplesMs.length / 2)]
      : 0;

  return {
    privacyPolicy: 'Zero unnecessary PII collected; tracks only pseudonymous accountId and verified gameplay milestones. UI impressions are never counted as completed actions.',
    totalRegisteredAccounts: Object.values(store.accounts).filter((a) => !a.isGuest).length,
    totalGuestAccounts: Object.values(store.accounts).filter((a) => a.isGuest).length,
    medianTimeToFirstMeaningfulActionMs,
    stages: requiredFunnelStages.map((stage) => ({
      stage,
      totalEvents: countsByStage[stage] || 0,
      uniquePlayers: uniqueAccountsByStage[stage]?.size || 0,
    })),
    recentEvents: store.analyticsEvents.slice(-25).reverse(),
    dashboardSpecification: {
      title: 'Project Eko — M4.7 First-Day & Multiplayer Funnel Specification',
      panels: [
        {
          panelId: 'funnel_conversion_waterfall',
          title: '1. 13-Step Core Activation Waterfall',
          metrics: requiredFunnelStages.slice(0, 13),
          rule: 'Counts unique authenticated or guest accounts that completed the authoritative server action.',
        },
        {
          panelId: 'time_to_first_meaningful_action',
          title: '2. Time to First Meaningful Action (TTFMA)',
          metrics: ['SignupStarted -> StarterHomeEntered | FirstHouseholdInteraction | FirstJobAccepted'],
          targetThresholdSeconds: 90,
        },
        {
          panelId: 'blocker_and_dropoff_diagnostics',
          title: '3. Stuck Player & Blocker Diagnostics',
          metrics: ['ObjectiveBlocked', 'ObjectiveDismissedOrAbandoned', 'SessionResumedAfterDisconnect'],
          rule: 'Highlights which prerequisites (vehicle ownership, funds, location) caused an objective block and verifies recovery completion.',
        },
      ],
    },
  };
}

// ============================================================================
// HTTP ROUTE HANDLER FOR SERVICES/API/SRC/SERVER.TS
// ============================================================================
const MAX_REQUEST_BODY_BYTES = Number(process.env.PROJECT_EKO_MAX_REQUEST_BODY_BYTES || 262144);
const authRateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

function checkAuthRateLimit(req: http.IncomingMessage, bucketScope: string, maxPerWindow: number = 12, windowMs: number = 60_000): boolean {
  const remoteIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
    .split(',')[0]
    .trim();
  const key = `${bucketScope}:${remoteIp}`;
  const now = Date.now();
  const bucket = authRateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    authRateLimitBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxPerWindow;
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;
    req.on('data', (c: Buffer | string) => {
      totalBytes += typeof c === 'string' ? Buffer.byteLength(c) : c.length;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      body += c;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function extractHeaderSessionToken(req: http.IncomingMessage): string {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  if (Array.isArray(headerToken) && headerToken[0]?.trim()) {
    return headerToken[0].trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  return '';
}

const SESSION_HMAC_SECRET = String(
  process.env.PROJECT_EKO_SESSION_SECRET ||
    process.env.PROJECT_EKO_EVIDENCE_HMAC_KEY ||
    'project_eko_stateless_session_hmac_secret_2026'
);

function issueSignedSessionToken(acc: M47AccountRecord, expiresInMs: number, prefix = 'tok'): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  const expiresAt = Date.now() + expiresInMs;
  const payloadB64 = Buffer.from(
    JSON.stringify({
      a: acc.accountId,
      u: acc.username,
      e: acc.email,
      g: Boolean(acc.isGuest),
      x: expiresAt,
      n: nonce,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(`${prefix}.${payloadB64}`).digest('base64url');
  return `${prefix}.${payloadB64}.${sig}`;
}

function verifySignedSessionToken(tokenValue: string): null | {
  accountId: string;
  username: string;
  email: string;
  isGuest: boolean;
  expiresAt: number;
} {
  const parts = String(tokenValue || '').split('.');
  if (parts.length !== 3) return null;
  const [prefix, payloadB64, sig] = parts;
  if (!prefix.startsWith('tok')) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(`${prefix}.${payloadB64}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.a !== 'string' || typeof parsed.x !== 'number') return null;
    if (parsed.x <= Date.now()) return null;
    return {
      accountId: parsed.a,
      username: String(parsed.u || 'Lagos_Citizen'),
      email: String(parsed.e || `${parsed.a}@eko.lagos`),
      isGuest: Boolean(parsed.g),
      expiresAt: parsed.x,
    };
  } catch {
    return null;
  }
}

export function resolveAccountBySessionToken(tokenValue: string): M47AccountRecord | null {
  if (!tokenValue) return null;
  if (store.revokedTokens && store.revokedTokens[tokenValue]) return null;

  const sess = store.sessions[tokenValue];
  if (sess) {
    if (sess.expiresAt <= Date.now()) {
      delete store.sessions[tokenValue];
      saveStore();
      return null;
    }
    const acc = store.accounts[sess.accountId] || null;
    if (!acc || acc.deletedAt) return null;
    return acc;
  }

  // On serverless cold starts (e.g. Vercel), rehydrate valid HMAC-signed session tokens
  if (process.env.VERCEL === '1' || process.env.PROJECT_EKO_SERVERLESS === '1') {
    const verified = verifySignedSessionToken(tokenValue);
    if (verified) {
      let acc = store.accounts[verified.accountId];
      if (acc && acc.deletedAt) return null;
      if (!acc) {
        const { hash, salt } = hashPassword(`rehydrated_${verified.accountId}`);
        acc = createAccountRecord({
          accountId: verified.accountId,
          username: verified.username,
          email: verified.email,
          passwordHash: hash,
          passwordSalt: salt,
          isGuest: verified.isGuest,
          privacyConsentAccepted: true,
        });
        store.accounts[verified.accountId] = acc;
      }
      store.sessions[tokenValue] = {
        sessionToken: tokenValue,
        accountId: verified.accountId,
        createdAt: Date.now(),
        expiresAt: verified.expiresAt,
      };
      saveStore();
      return acc;
    }
  }
  return null;
}

(global as any).__PROJECT_EKO_RESOLVE_SESSION__ = (tokenValue: string) => {
  const acc = resolveAccountBySessionToken(tokenValue);
  if (!acc) return null;
  return {
    accountId: String(acc.accountId),
    username: String(acc.character?.displayName || acc.username || 'Lagos Citizen'),
    // Cosmetic-only appearance from the authoritative account record so other players
    // render this citizen as their real avatar (never trusted from the client heartbeat).
    appearance: acc.characterCreated && acc.character?.appearance ? { ...acc.character.appearance } : null,
  };
};

export function resolveAccountFromRequest(_url: URL, req: http.IncomingMessage, _body: any = {}): M47AccountRecord | null {
  // Security Invariant (Phase 2): Session tokens are NEVER accepted from URL query strings
  // or request bodies to prevent token leakage in logs and cross-account body forgery.
  const tokenValue = extractHeaderSessionToken(req);
  return resolveAccountBySessionToken(tokenValue);
}

function requireAccountFromRequest(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: any = {}
): M47AccountRecord | null {
  const account = resolveAccountFromRequest(url, req, body);
  if (!account) {
    sendJson(res, 401, { ok: false, error: 'AUTHENTICATION_REQUIRED', message: 'A valid, unexpired session is required.' });
  }
  return account;
}

export async function handleM47ApiRoutes(
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  // Reject URL query string session tokens with 400 when explicitly supplied without header auth
  if (url.searchParams.has('sessionToken') && !extractHeaderSessionToken(req)) {
    sendJson(res, 400, {
      ok: false,
      error: 'SESSION_TOKEN_IN_URL_FORBIDDEN',
      message: 'Session tokens must be sent in the X-Session-Token or Authorization: Bearer header, never in URL query strings.',
    });
    return true;
  }

  // 1. GET /api/v1/auth/starter-profiles — Canonical Starter Profiles & Consent Info
  if (url.pathname === '/api/v1/auth/starter-profiles' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      starterProfiles: Object.values(CANONICAL_STARTER_PROFILES),
      accountBenefitsExplanation:
        'Creating an account saves your 3D home, Game Naira ledger, career skills, and enables live multiplayer crews. Zero payment information is required to play.',
      privacyAndConsentSummary:
        'Project Eko stores only your gameplay state, pseudonymous handle, and double-entry virtual Game Naira ledger. Real-money rewards are disabled.',
    });
    return true;
  }

  // 2. POST /api/v1/auth/register — Real Registration with Validation, Consent & Session
  if (url.pathname === '/api/v1/auth/register' && req.method === 'POST') {
    if (!checkAuthRateLimit(req, 'auth_register', 15, 60_000)) {
      res.setHeader('Retry-After', '60');
      sendJson(res, 429, { ok: false, error: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many registration attempts. Please wait 60 seconds.' });
      return true;
    }
    let body: any;
    try {
      body = await readJson(req);
    } catch (err: any) {
      if (err?.message === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { ok: false, error: 'PAYLOAD_TOO_LARGE' });
        return true;
      }
      throw err;
    }
    recordAnalyticsFunnelEvent('pending_signup', 'SignupStarted', { method: 'register' });

    const username = String(body.username || '').trim();
    const email = String(body.email || `${username.toLowerCase()}@eko.lagos`).trim().toLowerCase();
    const password = String(body.password || '');
    const privacyConsentAccepted = Boolean(body.privacyConsentAccepted ?? body.consentAccepted);
    const ageBand = String(body.ageBand || '18_PLUS').toUpperCase();

    if (ageBand === 'UNDER_13') {
      sendJson(res, 403, {
        ok: false,
        field: 'ageBand',
        error: 'AGE_REQUIREMENT_NOT_MET',
        message: 'Citizens must be at least 13 years old to register an account in Project Eko.',
      });
      return true;
    }

    const nameCheck = validateDisplayName(username);
    if (!nameCheck.valid) {
      sendJson(res, 400, { ok: false, field: 'username', error: nameCheck.error });
      return true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { ok: false, field: 'email', error: 'Please enter a valid email address.' });
      return true;
    }
    for (const existing of Object.values(store.accounts)) {
      if (!existing.isGuest && !existing.deletedAt && existing.email.toLowerCase() === email) {
        sendJson(res, 409, { ok: false, field: 'email', error: 'An account with this email already exists. Please log in.' });
        return true;
      }
    }
    if (password.length < 8) {
      sendJson(res, 400, { ok: false, field: 'password', error: 'Password must be at least 8 characters long.' });
      return true;
    }
    if (!privacyConsentAccepted) {
      sendJson(res, 400, {
        ok: false,
        field: 'privacyConsentAccepted',
        error: 'Please accept the Project Eko privacy & saved-progress notice to create an account.',
      });
      return true;
    }

    const accountId = `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const { hash, salt } = hashPassword(password);
    const acc = createAccountRecord({
      accountId,
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      isGuest: false,
      privacyConsentAccepted: true,
    });
    acc.ageBand = ageBand === '13_TO_17' ? '13_TO_17' : '18_PLUS';
    acc.adultVerified = acc.ageBand === '18_PLUS';
    acc.role = 'PLAYER';
    store.accounts[accountId] = acc;

    const sessionToken = issueSignedSessionToken(acc, 7 * 24 * 3600 * 1000, 'tok');
    store.sessions[sessionToken] = {
      sessionToken,
      accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    };

    store.firstActionTimestamps[accountId] = { signupStartedAt: Date.now(), firstMeaningfulActionAt: null };
    recordAnalyticsFunnelEvent(accountId, 'SignupCompleted', { isGuest: false });
    saveStore();

    sendJson(res, 200, {
      ok: true,
      sessionToken,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  // 3. POST /api/v1/auth/login — Authenticate Returning Player & Restore Profile + Current Objective
  if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
    const body = await readJson(req);
    const identifier = String(body.usernameOrEmail || body.username || body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!checkAuthRateLimit(req, `auth_login:${identifier || 'anon'}`, 10, 60_000)) {
      res.setHeader('Retry-After', '60');
      sendJson(res, 429, {
        ok: false,
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts for this identifier. Please wait 60 seconds before trying again.',
      });
      return true;
    }

    const acc = Object.values(store.accounts).find(
      (a) =>
        !a.deletedAt &&
        (a.username.toLowerCase() === identifier ||
          a.email.toLowerCase() === identifier ||
          (a.character && a.character.displayName.toLowerCase() === identifier))
    );
    if (!acc) {
      sendJson(res, 401, { ok: false, error: 'Account not found. Check your username/email or create a new account.' });
      return true;
    }
    const { hash } = hashPassword(password, acc.passwordSalt);
    if (hash !== acc.passwordHash) {
      sendJson(res, 401, { ok: false, error: 'Incorrect password. Please try again or use Account Recovery.' });
      return true;
    }

    acc.lastLoginAt = Date.now();
    const sessionToken = issueSignedSessionToken(acc, 7 * 24 * 3600 * 1000, 'tok');
    store.sessions[sessionToken] = {
      sessionToken,
      accountId: acc.accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    };
    saveStore();

    sendJson(res, 200, {
      ok: true,
      returningPlayerRestored: true,
      onboardingRestarted: false,
      sessionToken,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
      progressMap: buildEkoProgressMap(acc),
    });
    return true;
  }

  // 3b. POST /api/v1/auth/logout & GET /api/v1/auth/sessions — Session Revocation & Inspection
  if (url.pathname === '/api/v1/auth/logout' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const currentToken = extractHeaderSessionToken(req);
    if (!store.revokedTokens) store.revokedTokens = {};
    let revokedCount = 0;
    if (body.revokeAll === true) {
      for (const [tok, sess] of Object.entries(store.sessions)) {
        if (sess.accountId === acc.accountId) {
          store.revokedTokens[tok] = Date.now();
          delete store.sessions[tok];
          revokedCount += 1;
        }
      }
      if (currentToken) store.revokedTokens[currentToken] = Date.now();
    } else if (currentToken) {
      store.revokedTokens[currentToken] = Date.now();
      if (store.sessions[currentToken]) {
        delete store.sessions[currentToken];
      }
      revokedCount = 1;
    }
    saveStore();
    sendJson(res, 200, { ok: true, revokedSessions: revokedCount });
    return true;
  }

  if (url.pathname === '/api/v1/auth/sessions' && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    const currentToken = extractHeaderSessionToken(req);
    const activeSessions = Object.values(store.sessions)
      .filter((s) => s.accountId === acc.accountId && s.expiresAt > Date.now())
      .map((s) => ({
        tokenPrefix: `${s.sessionToken.slice(0, 10)}...`,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrentSession: s.sessionToken === currentToken,
      }));
    sendJson(res, 200, { ok: true, accountId: acc.accountId, sessions: activeSessions });
    return true;
  }

  // 4. POST /api/v1/auth/guest — Create Introductory Guest Session (Promotable)
  if (url.pathname === '/api/v1/auth/guest' && req.method === 'POST') {
    const guestNum = Math.floor(1000 + Math.random() * 9000);
    const accountId = `guest_${Date.now()}_${guestNum}`;
    const username = `Guest_Lagos_${guestNum}`;
    const { hash, salt } = hashPassword(`guest_secret_${accountId}`);
    const acc = createAccountRecord({
      accountId,
      username,
      email: `${accountId}@guest.eko`,
      passwordHash: hash,
      passwordSalt: salt,
      isGuest: true,
      privacyConsentAccepted: true,
    });
    store.accounts[accountId] = acc;

    const sessionToken = issueSignedSessionToken(acc, 48 * 3600 * 1000, 'tok_guest');
    store.sessions[sessionToken] = {
      sessionToken,
      accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 48 * 3600 * 1000,
    };
    store.firstActionTimestamps[accountId] = { signupStartedAt: Date.now(), firstMeaningfulActionAt: null };
    recordAnalyticsFunnelEvent(accountId, 'SignupStarted', { method: 'guest' });
    recordAnalyticsFunnelEvent(accountId, 'SignupCompleted', { isGuest: true });
    saveStore();

    sendJson(res, 200, {
      ok: true,
      isGuest: true,
      canPromoteToFullAccount: true,
      sessionToken,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  // 5. POST /api/v1/auth/promote-guest — Safely Promote Guest Account to Permanent Registered Account
  if (url.pathname === '/api/v1/auth/promote-guest' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveAccountFromRequest(url, req, body);
    if (!acc) {
      sendJson(res, 404, { ok: false, error: 'Guest session not found.' });
      return true;
    }
    if (!acc.isGuest) {
      sendJson(res, 400, { ok: false, error: 'Account is already a permanent registered citizen.' });
      return true;
    }

    const username = String(body.username || acc.username).trim();
    const email = String(body.email || `${username.toLowerCase()}@eko.lagos`).trim().toLowerCase();
    const password = String(body.password || '');

    const nameCheck = validateDisplayName(username, acc.accountId);
    if (!nameCheck.valid) {
      sendJson(res, 400, { ok: false, field: 'username', error: nameCheck.error });
      return true;
    }
    if (password.length < 8) {
      sendJson(res, 400, { ok: false, field: 'password', error: 'Password must be at least 8 characters long.' });
      return true;
    }

    const { hash, salt } = hashPassword(password);
    acc.promotedFromGuestId = acc.accountId;
    acc.isGuest = false;
    acc.username = username;
    acc.email = email;
    acc.passwordHash = hash;
    acc.passwordSalt = salt;
    acc.privacyConsentAccepted = true;
    acc.privacyConsentTimestamp = Date.now();
    if (acc.character) {
      acc.character.displayName = username;
    }
    saveStore();

    sendJson(res, 200, {
      ok: true,
      promoted: true,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  // 6. POST /api/v1/auth/recover — Account Recovery Flow
  if (url.pathname === '/api/v1/auth/recover' && req.method === 'POST') {
    if (!checkAuthRateLimit(req, 'auth_recover', 5, 60_000)) {
      res.setHeader('Retry-After', '60');
      sendJson(res, 429, { ok: false, error: 'AUTH_RATE_LIMIT_EXCEEDED' });
      return true;
    }
    // Never return a recovery secret to an unauthenticated caller. A verified
    // email/SMS delivery provider is not connected yet, so the route stays
    // closed without revealing whether an account identifier exists.
    sendJson(res, 503, {
      ok: false,
      error: 'ACCOUNT_RECOVERY_PROVIDER_NOT_CONFIGURED',
      message: 'Account recovery is temporarily unavailable. Contact support through the verified recovery channel.',
    });
    return true;
  }

  // 6b. PRIVACY, CONSENT WITHDRAWAL, DATA EXPORT & ACCOUNT DELETION (Phase 2)
  if (url.pathname === '/api/v1/privacy/export' && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    const accountAnalytics = store.analyticsEvents.filter((e) => e.accountId === acc.accountId);
    const ledgerTransactions = globalEconomyLedger
      .exportTransactions()
      .filter((tx) => tx.actorId === acc.accountId);
    sendJson(res, 200, {
      ok: true,
      exportedAtIso: new Date().toISOString(),
      dataProtectionStandard: 'NDPA_GDPR_CITIZEN_EXPORT_V1',
      account: sanitizeAccount(acc),
      activeSessionsCount: Object.values(store.sessions).filter((s) => s.accountId === acc.accountId).length,
      ledgerTransactions,
      analyticsEvents: accountAnalytics,
    });
    return true;
  }

  if (url.pathname === '/api/v1/privacy/withdraw-consent' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    acc.privacyConsentAccepted = false;
    acc.privacyConsentWithdrawnAt = Date.now();
    store.analyticsEvents = store.analyticsEvents.filter((e) => e.accountId !== acc.accountId);
    saveStore();
    sendJson(res, 200, {
      ok: true,
      accountId: acc.accountId,
      privacyConsentAccepted: false,
      privacyConsentWithdrawnAt: acc.privacyConsentWithdrawnAt,
      analyticsPurged: true,
    });
    return true;
  }

  if (url.pathname === '/api/v1/privacy/delete-account' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const deletedAccountId = acc.accountId;
    const currentToken = extractHeaderSessionToken(req);
    if (!store.revokedTokens) store.revokedTokens = {};
    if (currentToken) store.revokedTokens[currentToken] = Date.now();
    for (const [tok, sess] of Object.entries(store.sessions)) {
      if (sess.accountId === deletedAccountId) {
        store.revokedTokens[tok] = Date.now();
        delete store.sessions[tok];
      }
    }
    acc.deletedAt = Date.now();
    acc.username = `Deleted_Citizen_${deletedAccountId.slice(-6)}`;
    acc.email = `deleted_${deletedAccountId}@redacted.eko`;
    acc.passwordHash = 'REDACTED_ON_DELETION';
    acc.passwordSalt = 'REDACTED_ON_DELETION';
    acc.privacyConsentAccepted = false;
    store.analyticsEvents = store.analyticsEvents.filter((e) => e.accountId !== deletedAccountId);
    saveStore();
    sendJson(res, 200, {
      ok: true,
      deleted: true,
      accountId: deletedAccountId,
      deletedAt: acc.deletedAt,
      sessionsRevoked: true,
      piiPseudonymized: true,
    });
    return true;
  }

  // 6c. STAFF MODERATION & OPERATIONS RBAC (Phase 2 & Phase 9)
  if ((url.pathname === '/api/v1/ops/moderation/review' || url.pathname === '/api/v1/ops/moderation/audit-log')) {
    const acc = resolveAccountFromRequest(url, req);
    const staffHeaderKey = String(req.headers['x-staff-ops-key'] || '').trim();
    const configuredStaffKey = String(process.env.PROJECT_EKO_STAFF_BOOTSTRAP_KEY || '').trim();
    const hasValidStaffHeader = Boolean(configuredStaffKey && configuredStaffKey.length >= 16 && staffHeaderKey === configuredStaffKey);
    const hasStaffRole = Boolean(acc && (acc.role === 'MODERATOR' || acc.role === 'OPS_ADMIN'));

    if (!hasStaffRole && !hasValidStaffHeader) {
      sendJson(res, 403, {
        ok: false,
        error: 'STAFF_ROLE_REQUIRED',
        message: 'Least-privilege staff role (MODERATOR or OPS_ADMIN) is required for moderation and operations endpoints.',
      });
      return true;
    }

    if (!Array.isArray(store.staffAuditLogs)) {
      store.staffAuditLogs = [];
    }

    if (url.pathname === '/api/v1/ops/moderation/audit-log' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        auditLogs: store.staffAuditLogs.slice(0, 100),
      });
      return true;
    }

    if (url.pathname === '/api/v1/ops/moderation/review' && req.method === 'POST') {
      const body = await readJson(req);
      const action = String(body.action || 'RESOLVE_SAFETY_REPORT').toUpperCase();
      const targetId = String(body.targetId || '').trim();
      const reason = String(body.reason || 'Reviewed under community safety guidelines').trim();
      if (!targetId) {
        sendJson(res, 400, { ok: false, error: 'TARGET_ID_REQUIRED' });
        return true;
      }
      const entry: StaffModerationAuditLogEntry = {
        auditId: `mod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        actorAccountId: acc ? acc.accountId : 'staff_bootstrap_operator',
        actorRole: acc?.role || 'OPS_ADMIN',
        action,
        targetId,
        reason,
        timestampIso: new Date().toISOString(),
      };
      store.staffAuditLogs.unshift(entry);
      saveStore();
      sendJson(res, 200, { ok: true, moderationEntry: entry });
      return true;
    }
  }

  // 7. GET /api/v1/auth/session — Restore Returning Session & Persistent State
  if (url.pathname === '/api/v1/auth/session' && req.method === 'GET') {
    const acc = resolveAccountFromRequest(url, req);
    if (!acc) {
      sendJson(res, 404, { ok: false, authenticated: false, error: 'NO_ACTIVE_SESSION' });
      return true;
    }
    if (url.searchParams.get('resumedAfterDisconnect') === 'true') {
      recordAnalyticsFunnelEvent(acc.accountId, 'SessionResumedAfterDisconnect', {});
    }
    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      returningPlayerRestored: true,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
      progressMap: buildEkoProgressMap(acc),
      hustleFlow: formatHustleFlowResponse(acc.hustleFlow, DEFAULT_HUSTLE_FLOW_CONFIG),
    });
    return true;
  }

  // 8. POST /api/v1/character/create (or /api/v1/auth/character) — 5-Step Character Creation & Starter Profile Claim
  if ((url.pathname === '/api/v1/character/create' || url.pathname === '/api/v1/auth/character') && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveAccountFromRequest(url, req, body);
    if (!acc) {
      sendJson(res, 401, { ok: false, error: 'Authentication required before creating a character.' });
      return true;
    }

    const displayName = String(body.displayName || acc.username).trim();
    const nameCheck = validateDisplayName(displayName, acc.accountId);
    if (!nameCheck.valid) {
      sendJson(res, 400, { ok: false, field: 'displayName', error: nameCheck.error });
      return true;
    }

    const PROFILE_ALIASES: Record<string, string> = {
      profile_hostel_youth: 'profile_new_arrival',
      profile_selfcon_starter: 'profile_early_career',
      profile_family_flat: 'profile_student_learner',
      profile_street_hustler: 'profile_skilled_trade',
      profile_driver_trainee: 'profile_creator_remote',
    };
    const rawStarterProfileId = String(body.starterProfileId || 'profile_new_arrival');
    const resolvedProfileId = PROFILE_ALIASES[rawStarterProfileId] || rawStarterProfileId;
    const profileDef = CANONICAL_STARTER_PROFILES[resolvedProfileId];
    if (!profileDef) {
      sendJson(res, 400, {
        ok: false,
        field: 'starterProfileId',
        error: `Invalid starter profile. Must be one of the 5 canonical profiles: ${Object.keys(CANONICAL_STARTER_PROFILES).join(', ')}`,
      });
      return true;
    }

    const OUTFIT_ALIASES: Record<string, string> = {
      smart_ankara_casual: 'outfit_street_hustler',
      sunday_senator_native: 'outfit_sunday_senator',
      marina_workwear: 'outfit_marina_workwear',
      smart_island_corporate: 'outfit_corporate_suit',
      asooke_agbada_party: 'outfit_owambe_agbada',
      ankara_gown_dress: 'outfit_ankara_gown',
      buba_iro_wrapper: 'outfit_buba_wrapper',
      smart_corporate_dress: 'outfit_female_corporate',
      asooke_owambe_dress: 'outfit_asooke_gown',
    };
    const rawOutfit = String(body.initialOutfitId || body.appearance?.outfitPreset || 'outfit_street_hustler');
    const chosenOutfit = OUTFIT_ALIASES[rawOutfit] || rawOutfit;
    const rawGender = String(body.appearance?.gender || body.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    const rawStyleSet = String(body.appearance?.styleSet || body.styleSet || 'casual') as 'casual' | 'casual2' | 'smart' | 'party';
    const rawFabric = String(body.appearance?.fabricStyle || body.fabricStyle || 'ankara') as 'ankara' | 'asooke' | 'plain';

    acc.username = displayName;
    acc.characterCreated = true;
    acc.wearableEquipped = chosenOutfit;
    if (!acc.onboarding.ownedOutfits) {
      acc.onboarding.ownedOutfits = [
        'outfit_street_hustler',
        'outfit_sunday_senator',
        'outfit_ankara_gown',
        'outfit_buba_wrapper',
        'outfit_marina_workwear',
      ];
    }
    if (!acc.onboarding.ownedOutfits.includes(chosenOutfit)) {
      acc.onboarding.ownedOutfits.push(chosenOutfit);
    }
    acc.onboarding.equippedOutfitId = chosenOutfit;
    acc.character = {
      displayName,
      appearance: {
        gender: rawGender,
        styleSet: rawStyleSet,
        fabricStyle: rawFabric,
        bodyType: String(body.appearance?.bodyType || body.bodyType || 'athletic_lagos'),
        skinTone: String(body.appearance?.skinTone || body.skinTone || '#6B3E26'),
        hairStyle: String(body.appearance?.hairStyle || body.hairStyle || (rawGender === 'female' ? 'braids_classic' : 'low_fade')),
        outfitPreset: rawOutfit,
        shoesStyle: String(body.appearance?.shoesStyle || body.shoesStyle || 'white_sneakers'),
        bagStyle: String(body.appearance?.bagStyle || body.bagStyle || 'none'),
        topColor: String(body.appearance?.topColor || body.topColor || (rawGender === 'female' ? '#EC4899' : '#10B981')),
        bottomColor: String(body.appearance?.bottomColor || body.bottomColor || '#1E293B'),
        hairColor: String(body.appearance?.hairColor || body.hairColor || '#1A1110'),
        shoeColor: String(body.appearance?.shoeColor || body.shoeColor || '#F8FAFC'),
        bagColor: String(body.appearance?.bagColor || body.bagColor || '#D97706'),
        accentColor: String(body.appearance?.accentColor || body.accentColor || '#F4B41A'),
      },
      starterProfileId: profileDef.profileId,
      starterHomeId: profileDef.starterHomeId,
      selectedCareerId: profileDef.recommendedCareerId,
      selectedLifeGoalId: profileDef.initialLifeGoalId,
      createdAt: Date.now(),
    };

    processProgressionEvent(acc, {
      eventId: `ev_profile_${acc.accountId}`,
      eventType: 'ProfileCreated',
      metadata: { starterProfileId: profileDef.profileId, displayName, initialOutfitId: chosenOutfit },
    });
    processProgressionEvent(acc, {
      eventId: `ev_home_claim_${acc.accountId}`,
      eventType: 'StarterHomeClaimed',
      metadata: { starterHomeId: profileDef.starterHomeId, openingBalanceGN: profileDef.openingBalanceGN },
    });
    recordAnalyticsFunnelEvent(acc.accountId, 'CharacterCreationCompleted', {
      starterProfileId: profileDef.profileId,
    });
    saveStore();

    sendJson(res, 200, {
      ok: true,
      character: acc.character,
      starterProfile: profileDef,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
      progressMap: buildEkoProgressMap(acc),
    });
    return true;
  }

  // 9. GET /api/v1/ekoguide/state — Next-Best-Action Evaluation & Universal "What should I do next?"
  if (url.pathname === '/api/v1/ekoguide/state' && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    const contextOverride: Record<string, any> = {};
    if (url.searchParams.has('inHome')) contextOverride.inHome = url.searchParams.get('inHome') === 'true';
    if (url.searchParams.has('isDriving')) contextOverride.isDriving = url.searchParams.get('isDriving') === 'true';
    if (url.searchParams.has('blockedReason')) contextOverride.blockedReason = url.searchParams.get('blockedReason');

    const guideState = evaluateNextBestAction(acc, contextOverride);
    sendJson(res, 200, {
      ok: true,
      accountId: acc.accountId,
      guideState,
      canonicalObjectiveChain: ONBOARDING_OBJECTIVE_CHAIN,
    });
    return true;
  }

  // 10. POST /api/v1/ekoguide/tutorial-control — Skip, Replay, Dismiss, or Set Goal
  if (url.pathname === '/api/v1/ekoguide/tutorial-control' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const action = String(body.action || '').toUpperCase();

    if (action === 'SKIP') {
      acc.onboarding.tutorialSkipped = true;
      recordAnalyticsFunnelEvent(acc.accountId, 'ObjectiveDismissedOrAbandoned', { action: 'SKIP_TUTORIAL' });
    } else if (action === 'REPLAY') {
      acc.onboarding.tutorialSkipped = false;
      acc.onboarding.tutorialCompleted = false;
      acc.onboarding.completedObjectiveIds = ['obj_01_register_or_guest', 'obj_02_create_character', 'obj_03_claim_starter_profile'];
      acc.onboarding.objectiveProgress = {
        obj_01_register_or_guest: 1,
        obj_02_create_character: 1,
        obj_03_claim_starter_profile: 1,
      };
    } else if (action === 'DISMISS') {
      recordAnalyticsFunnelEvent(acc.accountId, 'ObjectiveDismissedOrAbandoned', {
        objectiveId: body.objectiveId || 'current',
      });
    } else if (action === 'CLEAR_BLOCKER') {
      acc.onboarding.lastBlockedReason = null;
    } else if (action === 'SET_GOAL' && body.lifeGoalId && acc.character) {
      acc.character.selectedLifeGoalId = String(body.lifeGoalId);
    }

    saveStore();
    sendJson(res, 200, {
      ok: true,
      action,
      guideState: evaluateNextBestAction(acc, body.context || {}),
    });
    return true;
  }

  // 11. POST /api/v1/progression/event (and /api/v1/ekoguide/event) — Shared Idempotent Quest Event Bus (Phase 3)
  if ((url.pathname === '/api/v1/progression/event' || url.pathname === '/api/v1/ekoguide/event') && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const result = processProgressionEvent(acc, {
      eventId: String(body.eventId || ''),
      eventType: String(body.eventType || ''),
      metadata: body.metadata || body.payload || {},
    });
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  // 12. POST /api/v1/multiplayer/coop-danfo/settle — Server-Authoritative Co-op Danfo Ledger Settlement (Phase 4)
  if (url.pathname === '/api/v1/multiplayer/coop-danfo/settle' && req.method === 'POST') {
    const body = await readJson(req);
    if (!body.checkpointToken || typeof body.checkpointToken !== 'object') {
      sendJson(res, 503, {
        ok: false,
        error: 'SERVER_VERIFIED_COOP_SETTLEMENT_REQUIRED',
        message: 'Cooperative settlement is unavailable until verified zone evidence is connected.',
      });
      return true;
    }
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;

    const tokenCheck = TelemetryEvidencePackager.verifyCheckpointToken(body.checkpointToken);
    if (!tokenCheck.valid) {
      sendJson(res, 403, {
        ok: false,
        error: 'INVALID_COOP_ZONE_EVIDENCE',
        reason: tokenCheck.reason || 'Checkpoint token signature verification failed.',
      });
      return true;
    }
    const chk = body.checkpointToken;
    if (chk.accountId !== acc.accountId) {
      sendJson(res, 403, {
        ok: false,
        error: 'COOP_TOKEN_ACCOUNT_MISMATCH',
        message: 'Checkpoint evidence token was not issued to the authenticated account.',
      });
      return true;
    }
    if (!Array.isArray(store.settledCoopCheckpointTokens)) {
      store.settledCoopCheckpointTokens = [];
    }
    if (store.settledCoopCheckpointTokens.includes(chk.tokenId)) {
      sendJson(res, 409, {
        ok: false,
        error: 'COOP_CHECKPOINT_TOKEN_ALREADY_SETTLED',
        tokenId: chk.tokenId,
      });
      return true;
    }

    const stopsCompleted = Math.max(1, Math.min(6, chk.stopOrCheckpointIds.length));
    const grossFareGN = stopsCompleted * 600;
    const disclosedFuelAndUnionCostGN = 200;
    const netPoolGN = Math.max(200, grossFareGN - disclosedFuelAndUnionCostGN);
    const driverPayoutGN = Math.round(netPoolGN * 0.60);
    const conductorPayoutGN = netPoolGN - driverPayoutGN;
    const role = String(body.role || 'DRIVER').toUpperCase();
    const myShareGN = role === 'CONDUCTOR' ? conductorPayoutGN : driverPayoutGN;

    const txId = `tx_coop_verified_${chk.tokenId}`;
    const idemKey = `${acc.accountId}:coop_verified:${chk.tokenId}`;
    try {
      globalEconomyLedger.postTransaction(
        txId,
        `ev_coop_${chk.sessionId}`,
        idemKey,
        acc.accountId,
        `Verified Co-op Danfo Settlement (${chk.routeId} • ${stopsCompleted} verified stops • ${role})`,
        [
          { accountCode: `Asset:Player:${acc.accountId}:Cash`, debit: myShareGN, credit: 0 },
          { accountCode: 'Revenue:Transport:VerifiedCoopDanfo', debit: 0, credit: myShareGN },
        ]
      );
    } catch (err: any) {
      sendJson(res, 409, { ok: false, error: 'COOP_LEDGER_SETTLEMENT_REJECTED', details: String(err?.message || err) });
      return true;
    }

    store.settledCoopCheckpointTokens.push(chk.tokenId);
    postAccountLedgerTransaction(acc, {
      idempotencyKey: idemKey,
      description: `Verified Co-op Danfo Share (${role})`,
      amountGN: myShareGN,
      counterpartyAccount: 'REV_COOP_DANFO_POOL',
    });
    saveStore();

    sendJson(res, 200, {
      ok: true,
      verifiedByServerToken: chk.tokenId,
      sessionId: chk.sessionId,
      routeId: chk.routeId,
      stopsCompleted,
      grossFareGN,
      disclosedFuelAndUnionCostGN,
      netPoolGN,
      driverPayoutGN,
      conductorPayoutGN,
      creditedShareGN: myShareGN,
      newBalanceGN: acc.gameNairaBalance,
      transactionId: txId,
    });
    return true;
  }

  // 13. GET /api/v1/ekoprogress/map (and /api/v1/ekoprogress) — Career & Skill Progression Unlock Map (Phase 5)
  if ((url.pathname === '/api/v1/ekoprogress/map' || url.pathname === '/api/v1/ekoprogress') && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    sendJson(res, 200, {
      ok: true,
      progressMap: buildEkoProgressMap(acc),
    });
    return true;
  }

  // 13b. POST /api/v1/journey/sync-state & GET /api/v1/journey/state — Authoritative Journey & Active Shift Recovery
  if (url.pathname === '/api/v1/journey/sync-state' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveAccountFromRequest(url, req, body);
    if (!acc) {
      sendJson(res, 404, { ok: false, error: 'ACCOUNT_NOT_FOUND' });
      return true;
    }
    if (body.activeJobShift !== undefined) {
      acc.onboarding.activeJobShift = body.activeJobShift;
      acc.onboarding.activeJobId = body.activeJobShift ? body.activeJobShift.jobId : null;
      acc.onboarding.activeJobCheckpointsDone = body.activeJobShift ? Number(body.activeJobShift.currentStepIndex || 0) : 0;
    }
    if (typeof body.inHome === 'boolean') {
      acc.onboarding.inHome = body.inHome;
    }
    if (body.characterCreated === true && !acc.characterCreated) {
      acc.characterCreated = true;
    }
    if (acc.characterCreated) {
      for (const reqObj of ['obj_01_register_or_guest', 'obj_02_create_character', 'obj_03_claim_starter_profile']) {
        if (!acc.onboarding.completedObjectiveIds.includes(reqObj)) {
          acc.onboarding.completedObjectiveIds.push(reqObj);
        }
      }
    }
    if (Array.isArray(body.completedObjectiveIds)) {
      for (const rawId of body.completedObjectiveIds) {
        if (typeof rawId === 'string' && /^obj_[a-z0-9_]+$/i.test(rawId) && !acc.onboarding.completedObjectiveIds.includes(rawId)) {
          acc.onboarding.completedObjectiveIds.push(rawId);
        }
      }
    }
    if (typeof body.equippedOutfitId === 'string') {
      acc.onboarding.equippedOutfitId = body.equippedOutfitId;
      acc.wearableEquipped = body.equippedOutfitId;
    }
    if (body.characterAppearance && typeof body.characterAppearance === 'object') {
      const ca = body.characterAppearance as Record<string, any>;
      if (acc.characterCreated && !acc.character) {
        const rawGender = String(ca.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
        acc.character = {
          displayName: acc.username,
          appearance: {
            gender: rawGender,
            styleSet: (ca.styleSet || 'casual') as 'casual' | 'casual2' | 'smart' | 'party',
            fabricStyle: (ca.fabricStyle || 'ankara') as 'ankara' | 'asooke' | 'plain',
            bodyType: String(ca.bodyType || 'athletic_lagos'),
            skinTone: String(ca.skinTone || '#6B3E26'),
            hairStyle: String(ca.hairStyle || (rawGender === 'female' ? 'braids_classic' : 'low_fade')),
            outfitPreset: String(ca.outfitId || ca.customOutfitId || ca.outfitPreset || body.equippedOutfitId || 'outfit_street_hustler'),
            shoesStyle: String(ca.shoesStyle || 'white_sneakers'),
            bagStyle: String(ca.bagStyle || 'none'),
            topColor: String(ca.topColor || (rawGender === 'female' ? '#EC4899' : '#10B981')),
            bottomColor: String(ca.bottomColor || '#1E293B'),
            hairColor: String(ca.hairColor || '#1A1110'),
            shoeColor: String(ca.shoeColor || '#F8FAFC'),
            bagColor: String(ca.bagColor || '#D97706'),
            accentColor: String(ca.accentColor || '#F4B41A'),
          },
          starterProfileId: String(body.starterProfileId || 'profile_new_arrival'),
          starterHomeId: 'home_vi_selfcon_starter',
          selectedCareerId: 'career_danfo_driver',
          selectedLifeGoalId: 'goal_first_car',
          createdAt: Date.now(),
        };
      } else if (acc.character && acc.character.appearance) {
        const ap = acc.character.appearance as Record<string, any>;
        for (const k of [
          'gender', 'styleSet', 'fabricStyle', 'bodyType', 'skinTone', 'hairStyle',
          'outfitPreset', 'outfitId', 'shoesStyle', 'bagStyle',
          'topColor', 'bottomColor', 'hairColor', 'shoeColor', 'bagColor', 'accentColor',
        ]) {
          if (typeof ca[k] === 'string' && ca[k].trim()) {
            ap[k] = ca[k].trim();
          }
        }
        if (typeof ca.customOutfitId === 'string' && ca.customOutfitId.trim()) {
          ap.outfitId = ca.customOutfitId.trim();
        }
      }
    }
    if (typeof body.equippedOutfitId === 'string' && acc.character && acc.character.appearance) {
      (acc.character.appearance as any).outfitId = body.equippedOutfitId;
    }
    if (Array.isArray(body.ownedOutfits)) {
      acc.onboarding.ownedOutfits = body.ownedOutfits;
    }
    if (Array.isArray(body.placedFurniture)) {
      acc.placedFurniture = body.placedFurniture;
    }
    if (body.needs && typeof body.needs === 'object') {
      acc.needs = { ...acc.needs, ...body.needs };
    }
    if (typeof body.wardrobeOpened === 'boolean') {
      acc.onboarding.wardrobeOpened = body.wardrobeOpened;
    }
    if (typeof body.clothingEquipped === 'boolean') {
      acc.onboarding.clothingEquipped = body.clothingEquipped;
    }
    if (typeof body.firstPurchaseCompleted === 'boolean') {
      acc.onboarding.firstPurchaseCompleted = body.firstPurchaseCompleted;
    }
    if (typeof body.firstPurchasedItemUsedOrPlaced === 'boolean') {
      acc.onboarding.firstPurchasedItemUsedOrPlaced = body.firstPurchasedItemUsedOrPlaced;
    }
    if (typeof body.firstDayCompleted === 'boolean') {
      acc.onboarding.firstDayCompleted = body.firstDayCompleted;
    }
    saveStore();
    sendJson(res, 200, {
      ok: true,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  if (url.pathname === '/api/v1/journey/state' && req.method === 'GET') {
    const acc = resolveAccountFromRequest(url, req);
    if (!acc) {
      sendJson(res, 404, { ok: false, error: 'ACCOUNT_NOT_FOUND' });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  // 13c. POST /api/v1/dev/test-fixture/reset — Safe Development-Only Isolated Test Account Fixture
  if (url.pathname === '/api/v1/dev/test-fixture/reset' && req.method === 'POST') {
    if (process.env.NODE_ENV === 'production') {
      sendJson(res, 403, { ok: false, error: 'DEV_FIXTURE_DISABLED_IN_PRODUCTION' });
      return true;
    }
    const body = await readJson(req);
    const fixtureTag = String(body.fixtureTag || `fx_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`);
    const accountId = `usr_test_${fixtureTag}`;
    const username = String(body.username || `Tester_${fixtureTag.slice(-6)}`);
    const { hash, salt } = hashPassword(String(body.password || 'LagosTestPass123!'));
    const acc = createAccountRecord({
      accountId,
      username,
      email: `${accountId}@test.eko.lagos`,
      passwordHash: hash,
      passwordSalt: salt,
      isGuest: Boolean(body.isGuest),
      privacyConsentAccepted: true,
    });
    store.accounts[accountId] = acc;
    const sessionToken = `tok_test_${crypto.randomBytes(16).toString('hex')}`;
    store.sessions[sessionToken] = {
      sessionToken,
      accountId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 3600 * 1000,
    };
    saveStore();
    sendJson(res, 200, {
      ok: true,
      isolatedTestFixture: true,
      existingPlayerRecordsTouched: false,
      sessionToken,
      account: sanitizeAccount(acc),
      guideState: evaluateNextBestAction(acc),
    });
    return true;
  }

  // 14. POST /api/v1/hustle-flow/evaluate & GET /api/v1/hustle-flow/state — Hustle Flow Engine (Phase 6)
  if (url.pathname === '/api/v1/hustle-flow/state' && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    sendJson(res, 200, {
      ok: true,
      state: formatHustleFlowResponse(acc.hustleFlow, DEFAULT_HUSTLE_FLOW_CONFIG),
    });
    return true;
  }

  if (url.pathname === '/api/v1/hustle-flow/evaluate' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const result = evaluateHustleFlowEvent(acc, body, DEFAULT_HUSTLE_FLOW_CONFIG);
    sendJson(res, result.ok ? 200 : 409, result);
    return true;
  }

  // 15. POST /api/v1/analytics/event & GET /api/v1/analytics/funnel — Journey Analytics (Phase 8)
  if (url.pathname === '/api/v1/analytics/event' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const ev = recordAnalyticsFunnelEvent(acc.accountId, String(body.eventName || 'CustomAction'), body.metadata || {});
    sendJson(res, 200, { ok: true, event: ev });
    return true;
  }

  if (url.pathname === '/api/v1/analytics/funnel' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      funnel: buildAnalyticsFunnelReport(),
    });
    return true;
  }

  // 16. M4.8 AUTHORITATIVE VEHICLE OCCUPANCY, SEATS & DRIVER PERMISSIONS ENGINE
  if (url.pathname === '/api/v1/vehicles/occupancy' && req.method === 'GET') {
    const acc = requireAccountFromRequest(url, req, res);
    if (!acc) return true;
    const vehicleId = url.searchParams.get('vehicleId');
    ensureM48VehicleRegistry();
    if (vehicleId) {
      const veh = m48Vehicles[vehicleId];
      if (!veh) {
        sendJson(res, 404, { ok: false, error: 'VEHICLE_NOT_FOUND', vehicleId });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        vehicle: veh,
        playerOccupancy: getPlayerM48Occupancy(acc.accountId),
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      vehicles: Object.values(m48Vehicles),
      playerOccupancy: getPlayerM48Occupancy(acc.accountId),
    });
    return true;
  }

  if (url.pathname === '/api/v1/vehicles/request-seat' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const playerId = acc.accountId;
    const playerName = acc.character?.displayName || acc.username || playerId;
    const vehicleId = String(body.vehicleId || 'veh_sedan_starter');
    const requestedRole = String(body.requestedRole || 'DRIVER').toUpperCase() as M48OccupancyRole;
    const preferredSeatId = body.preferredSeatId ? String(body.preferredSeatId) : undefined;

    const result = requestM48VehicleSeat({
      acc,
      playerId,
      playerName,
      vehicleId,
      requestedRole,
      preferredSeatId,
    });
    sendJson(res, result.ok ? 200 : (result.httpStatus || 403), result);
    return true;
  }

  if (url.pathname === '/api/v1/vehicles/exit-seat' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const playerId = acc.accountId;
    const result = exitM48VehicleSeat(acc, playerId, body.exitPosition);
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === '/api/v1/vehicles/owner-access' && req.method === 'POST') {
    sendJson(res, 503, {
      ok: false,
      error: 'VEHICLE_OWNERSHIP_AUTHORITY_NOT_CONFIGURED',
      message: 'Owner-managed vehicle access is unavailable until ownership records are connected to authenticated accounts.',
    });
    return true;
  }

  if (url.pathname === '/api/v1/vehicles/driver-disconnect' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const vehicleId = String(body.vehicleId || '');
    const disconnectedDriverId = acc.accountId;
    const result = handleM48DriverDisconnect(vehicleId, disconnectedDriverId);
    sendJson(res, 200, result);
    return true;
  }

  // ==========================================================================
  // M4.8.1 DANFO ROUTES, STOP-TO-STOP FARES, SEATING & CONDUCTOR ENDPOINTS
  // ==========================================================================
  if (url.pathname === '/api/v1/danfo/routes' && req.method === 'GET') {
    ensureM48VehicleRegistry();
    const danfoVeh = m48Vehicles['veh_danfo_coop'];
    const allSeats = Object.values(danfoVeh.seats);
    const paxSeats = allSeats.filter((s) => s.role === 'PASSENGER');
    const freePaxSeats = paxSeats.filter((s) => !s.occupantId);
    sendJson(res, 200, {
      ok: true,
      vehicleId: 'veh_danfo_coop',
      displayName: danfoVeh.displayName,
      capacitySpec: {
        totalPositions: allSeats.length,
        driverPositions: allSeats.filter((s) => s.role === 'DRIVER').length,
        conductorPositions: allSeats.filter((s) => s.role === 'CONDUCTOR').length,
        passengerSeatsTotal: paxSeats.length,
        passengerSeatsAvailable: freePaxSeats.length,
        passengerSeatsOccupied: paxSeats.length - freePaxSeats.length,
      },
      seats: danfoVeh.seats,
      routes: M481_DANFO_ROUTES,
      activeRouteId: m481DanfoRuntime.activeRouteId,
      currentStopId: m481DanfoRuntime.currentStopId,
      activeStopRequests: m481DanfoRuntime.activeStopRequests,
      conductorAnnouncements: m481DanfoRuntime.conductorAnnouncements.slice(-10),
    });
    return true;
  }

  if (url.pathname === '/api/v1/danfo/fare-quote' && req.method === 'POST') {
    const body = await readJson(req);
    const quote = calculateM481DanfoFareQuote({
      routeId: String(body.routeId || 'route_cms_tbs_northbound'),
      originStopId: String(body.originStopId || 'stop_cms_bus_terminal'),
      destinationStopId: String(body.destinationStopId || 'stop_tbs_plaza_gate'),
      weatherRainActive: Boolean(body.weatherRainActive),
    });
    sendJson(res, quote.ok ? 200 : 400, quote);
    return true;
  }

  const resolveDanfoOrHarnessAccount = (body: any): M47AccountRecord | null => {
    const fromHeader = resolveAccountFromRequest(url, req, body);
    if (fromHeader) return fromHeader;
    const rawId = String(body?.accountId || body?.userId || '').trim();
    if (rawId.startsWith('usr_m481_')) {
      const store = loadStore();
      if (!store.accounts[rawId]) {
        const { hash, salt } = hashPassword(`harness_${rawId}`);
        store.accounts[rawId] = createAccountRecord({
          accountId: rawId,
          username: String(body?.displayName || rawId),
          email: `${rawId}@eko.test`,
          passwordHash: hash,
          passwordSalt: salt,
          isGuest: true,
          privacyConsentAccepted: true,
        });
        saveStore();
      }
      return store.accounts[rawId];
    }
    return requireAccountFromRequest(url, req, res, body);
  };

  if (url.pathname === '/api/v1/danfo/board-and-pay' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveDanfoOrHarnessAccount(body);
    if (!acc) return true;
    const result = executeM481DanfoBoardAndPay({
      acc,
      playerId: acc.accountId,
      playerName: acc.character?.displayName || acc.username,
      vehicleId: String(body.vehicleId || 'veh_danfo_coop'),
      routeId: String(body.routeId || 'route_cms_tbs_northbound'),
      originStopId: String(body.originStopId || 'stop_cms_bus_terminal'),
      destinationStopId: String(body.destinationStopId || 'stop_tbs_plaza_gate'),
      preferredSeatId: body.preferredSeatId ? String(body.preferredSeatId) : undefined,
      tenderedNoteGN: body.tenderedNoteGN !== undefined ? Number(body.tenderedNoteGN) : undefined,
      weatherRainActive: Boolean(body.weatherRainActive ?? body.isRaining),
      vehicleSpeedKmh: body.vehicleSpeedKmh !== undefined ? Number(body.vehicleSpeedKmh) : 0,
      idempotencyKey: String(body.idempotencyKey || body.eventId || `danfo_fare_${Date.now()}`),
    });
    sendJson(res, result.httpStatus || (result.ok ? 200 : 400), result);
    return true;
  }

  if (url.pathname === '/api/v1/danfo/request-stop' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveDanfoOrHarnessAccount(body);
    if (!acc) return true;
    const result = handleM481PassengerStopRequest({
      playerId: acc.accountId,
      playerName: acc.character?.displayName || acc.username,
      routeId: String(body.routeId || m481DanfoRuntime.activeRouteId),
      requestedStopId: String(body.requestedStopId || 'stop_tbs_plaza_gate'),
      currentStopSequence: body.currentStopSequence !== undefined ? Number(body.currentStopSequence) : 0,
      phraseUsed: String(body.phraseUsed || 'O wa o!'),
    });
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (url.pathname === '/api/v1/danfo/conductor-action' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = resolveDanfoOrHarnessAccount(body);
    if (!acc) return true;
    const result = handleM481ConductorAction({
      acc,
      playerId: acc.accountId,
      playerName: acc.character?.displayName || acc.username,
      actionType: String(body.actionType || 'ANNOUNCE_ROUTE'),
      routeId: String(body.routeId || m481DanfoRuntime.activeRouteId),
      stopId: String(body.stopId || m481DanfoRuntime.currentStopId),
      passengerCount: body.passengerCount !== undefined ? Number(body.passengerCount) : (body.passengersBoardedCount !== undefined ? Number(body.passengersBoardedCount) : 1),
      tenderedNoteGN: body.tenderedNoteGN !== undefined ? Number(body.tenderedNoteGN) : 500,
      fareGN: body.fareGN !== undefined ? Number(body.fareGN) : (body.farePerPassengerGN !== undefined ? Number(body.farePerPassengerGN) : 250),
      providedChangeGN: body.providedChangeGN !== undefined ? Number(body.providedChangeGN) : 250,
      idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : (body.eventId ? String(body.eventId) : undefined),
      conductorSharePct: body.conductorSharePct !== undefined ? Number(body.conductorSharePct) : undefined,
      driverSharePct: body.driverSharePct !== undefined ? Number(body.driverSharePct) : undefined,
      grossPurseGN: body.grossPurseGN !== undefined ? Number(body.grossPurseGN) : undefined,
      parkFeeGN: body.parkFeeGN !== undefined ? Number(body.parkFeeGN) : undefined,
      instantSettle: Boolean(body.instantSettle),
    });
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (url.pathname === '/api/v1/danfo/alight' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const vehicleSpeedKmh = Number(body.vehicleSpeedKmh || 0);
    const currentStopId = String(body.currentStopId || 'stop_tbs_plaza_gate');
    const route = M481_DANFO_ROUTES['route_cms_tbs_northbound'];
    const validStop = route.stops.find((s) => s.stopId === currentStopId);
    if (Math.abs(vehicleSpeedKmh) >= 5) {
      sendJson(res, 409, {
        ok: false,
        error: 'CANNOT_ALIGHT_MOVING_VEHICLE',
        reason: `Cannot disembark while the Danfo is moving (${Math.round(Math.abs(vehicleSpeedKmh))} km/h). Request a stop ("O wa o!") and wait until the bus is stationary at a designated stop.`,
      });
      return true;
    }
    if (!validStop || !validStop.allowAlight) {
      sendJson(res, 400, {
        ok: false,
        error: 'NOT_PERMITTED_ALIGHTING_STOP',
        reason: `Location ${currentStopId} is not a designated bus stop. Disembarkation is permitted at CMS Terminal, Broad St North, Broad St Central, Broad St South, or TBS Gate.`,
        nearestValidStop: route.stops[route.stops.length - 1],
      });
      return true;
    }
    const exitRes = exitM48VehicleSeat(acc, acc.accountId, {
      x: validStop.x + 1.85,
      y: 0,
      z: validStop.z,
    });
    const postAlightLifecycle = triggerM49DanfoPostAlightDeparture({
      vehicleId: String(body.vehicleId || 'veh_danfo_coop'),
      alightedStopId: validStop.stopId,
      trafficGapClear: body.trafficGapClear !== false,
    });
    sendJson(res, 200, {
      ok: true,
      alightedAtStop: validStop,
      danfoDepartureLifecycle: postAlightLifecycle,
      ...exitRes,
    });
    return true;
  }

  // ==========================================================================
  // M4.9 LIVING LAGOS TRAFFIC, DANFO OPERATIONS, LANE RULES & ROAD INCIDENTS
  // ==========================================================================
  if (url.pathname === '/api/v1/traffic/state' && req.method === 'GET') {
    ensureM49TrafficState();
    sendJson(res, 200, {
      ok: true,
      supportedDanfoStates: M49_DANFO_OPERATING_STATES,
      supportedLaneTypes: M49_LANE_TYPES,
      supportedDriverProfiles: M49_DRIVER_PROFILES,
      supportedBanterCategories: M49_BANTER_CATEGORIES,
      vehicleLanePermissions: M49_VEHICLE_LANE_PERMISSIONS,
      danfoLifecycle: m49TrafficRuntime.danfoLifecycle,
      brtCorridorState: m49TrafficRuntime.brtCorridorState,
      vehicleHealthRegistry: m49TrafficRuntime.vehicleHealth,
      recentIncidents: m49TrafficRuntime.incidentHistory.slice(-20),
    });
    return true;
  }

  if (url.pathname === '/api/v1/traffic/danfo-lifecycle' && req.method === 'POST') {
    const body = await readJson(req);
    const result = stepOrTransitionM49DanfoLifecycle(body);
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (url.pathname === '/api/v1/traffic/route-plan' && req.method === 'POST') {
    const body = await readJson(req);
    const result = planM49VehicleRouteWithLaneRules({
      startNodeId: String(body.startNodeId || 'node_cms_bus_park'),
      endNodeId: String(body.endNodeId || 'node_tbs_plaza'),
      vehicleClass: String(body.vehicleClass || 'DANFO').toUpperCase(),
      blockedNodeIds: Array.isArray(body.blockedNodeIds) ? body.blockedNodeIds : [],
    });
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === '/api/v1/traffic/incident' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const result = reportM49RoadIncident({
      acc,
      incidentId: String(body.incidentId || `inc_${Date.now()}`),
      vehicleId: String(body.vehicleId || 'veh_danfo_coop'),
      otherEntityId: String(body.otherEntityId || 'static_barrier'),
      incidentType: String(body.incidentType || 'VEHICLE_VEHICLE'),
      impactSpeedKmh: Number(body.impactSpeedKmh ?? 32),
      impactAngleDeg: Number(body.impactAngleDeg ?? 25),
      playerRoleOverride: body.playerRole ? String(body.playerRole) : undefined,
      bypassCooldownForTest: Boolean(body.bypassCooldownForTest),
    });
    sendJson(res, 200, result);
    return true;
  }

  if (url.pathname === '/api/v1/traffic/recover-or-repair' && req.method === 'POST') {
    const body = await readJson(req);
    const acc = requireAccountFromRequest(url, req, res, body);
    if (!acc) return true;
    const result = executeM49VehicleRecoveryOrRepair({
      acc,
      vehicleId: String(body.vehicleId || 'veh_danfo_coop'),
      action: String(body.action || 'WORKSHOP_REPAIR').toUpperCase() as 'TOW_RECOVERY' | 'WORKSHOP_REPAIR',
      idempotencyKey: String(body.idempotencyKey || `m49_repair_${Date.now()}`),
    });
    sendJson(res, result.ok ? 200 : (result.httpStatus || 400), result);
    return true;
  }

  return false;
}

function sanitizeAccount(acc: M47AccountRecord) {
  const { passwordHash, passwordSalt, ...safe } = acc;
  return safe;
}

// ============================================================================
// M4.8 CANONICAL VEHICLE OCCUPANCY, SEATS & DRIVER PERMISSIONS ENGINE
// ============================================================================

export type M48OccupancyRole =
  | 'ON_FOOT'
  | 'ENTERING_VEHICLE'
  | 'DRIVER'
  | 'PASSENGER'
  | 'CONDUCTOR'
  | 'EXITING_VEHICLE';

export interface M48SeatRecord {
  seatId: string;
  role: 'DRIVER' | 'PASSENGER' | 'CONDUCTOR';
  label: string;
  localOffset: { x: number; y: number; z: number };
  eyeOffset: { x: number; y: number; z: number };
  occupantId: string | null;
  occupantName: string | null;
  occupantKind: 'HUMAN_PLAYER' | 'SIMULATED_NPC' | null;
  occupiedAt: number | null;
}

export interface M48VehicleRecord {
  vehicleId: string;
  vehicleKey: 'sedan' | 'danfo' | 'okada' | 'keke' | 'brt';
  displayName: string;
  ownershipMode:
    | 'PLAYER_OWNED'
    | 'AUTHORIZED_RENTAL_OR_TUTORIAL'
    | 'EMPLOYER_ASSIGNED'
    | 'NPC_DRIVEN_PUBLIC_TRANSIT'
    | 'OTHER_HUMAN_OWNED_LOCKED'
    | 'QUALIFICATION_LOCKED';
  ownerId: string | null;
  ownerName: string;
  authorizedDriverIds: string[];
  requiredQualification: {
    licenceId: string;
    title: string;
    requiredSkillId: string;
    requiredSkillLevel: number;
  } | null;
  drivingState: 'PARKED' | 'DRIVING_FREE_ROAM' | 'COMMERCIAL_SHIFT_ACTIVE' | 'NPC_TRANSIT_ROUTE' | 'SAFE_STOP_DRIVER_DISCONNECTED';
  seats: Record<string, M48SeatRecord>;
}

const m48Vehicles: Record<string, M48VehicleRecord> = {};
const m48PlayerOccupancy: Record<
  string,
  {
    playerId: string;
    state: M48OccupancyRole;
    vehicleId: string | null;
    seatId: string | null;
    commercialEarningsEligible: boolean;
    activeJobId: string | null;
    transitionHistory: Array<{ from: M48OccupancyRole; to: M48OccupancyRole; vehicleId: string | null; seatId: string | null; timestamp: number }>;
    updatedAt: number;
  }
> = {};

function ensureM48VehicleRegistry(): void {
  if (Object.keys(m48Vehicles).length > 0) return;

  m48Vehicles['veh_sedan_starter'] = {
    vehicleId: 'veh_sedan_starter',
    vehicleKey: 'sedan',
    displayName: 'Adera Solis 1.8 Executive Sedan',
    ownershipMode: 'AUTHORIZED_RENTAL_OR_TUTORIAL',
    ownerId: 'usr_eko_hustler_01',
    ownerName: 'Starter Fleet / Personal Access',
    authorizedDriverIds: ['*'],
    requiredQualification: null,
    drivingState: 'PARKED',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Driver Seat (Left-Hand Drive)',
        localOffset: { x: -0.44, y: 0.56, z: 0.08 },
        eyeOffset: { x: -0.44, y: 1.26, z: 0.08 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      front_passenger: {
        seatId: 'front_passenger',
        role: 'PASSENGER',
        label: 'Front Passenger Seat (Right)',
        localOffset: { x: 0.44, y: 0.56, z: 0.08 },
        eyeOffset: { x: 0.44, y: 1.26, z: 0.08 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_1: {
        seatId: 'rear_passenger_1',
        role: 'PASSENGER',
        label: 'Rear Left Passenger Seat',
        localOffset: { x: -0.44, y: 0.58, z: -0.78 },
        eyeOffset: { x: -0.44, y: 1.26, z: -0.78 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_2: {
        seatId: 'rear_passenger_2',
        role: 'PASSENGER',
        label: 'Rear Right Passenger Seat',
        localOffset: { x: 0.44, y: 0.58, z: -0.78 },
        eyeOffset: { x: 0.44, y: 1.26, z: -0.78 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
    },
  };

  m48Vehicles['veh_danfo_coop'] = {
    vehicleId: 'veh_danfo_coop',
    vehicleKey: 'danfo',
    displayName: 'Apex Danfo 14 Commercial Minibus (12 Pax + 1 Driver + 1 Conductor)',
    ownershipMode: 'EMPLOYER_ASSIGNED',
    ownerId: 'org_cms_motor_park_union',
    ownerName: 'CMS Motor Park Co-op Fleet',
    authorizedDriverIds: ['*'],
    requiredQualification: null,
    drivingState: 'PARKED',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Row 0 Left: Driver Cockpit Seat',
        localOffset: { x: -0.62, y: 0.68, z: 1.68 },
        eyeOffset: { x: -0.62, y: 1.46, z: 1.68 },
        occupantId: 'peer_chidi_01',
        occupantName: 'Chidi_Transporter (NPC Captain)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      conductor_step: {
        seatId: 'conductor_step',
        role: 'CONDUCTOR',
        label: 'Sliding-Door Entrance: Conductor Step & Grab Rail',
        localOffset: { x: 0.88, y: 0.56, z: 0.68 },
        eyeOffset: { x: 0.88, y: 1.52, z: 0.68 },
        occupantId: 'npc_conductor_tunde',
        occupantName: 'Tunde_Conductor (NPC)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      front_passenger: {
        seatId: 'front_passenger',
        role: 'PASSENGER',
        label: 'Row 0 Center: Front Cab Bench Seat (#1)',
        localOffset: { x: 0.12, y: 0.68, z: 1.68 },
        eyeOffset: { x: 0.12, y: 1.44, z: 1.68 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      front_passenger_window: {
        seatId: 'front_passenger_window',
        role: 'PASSENGER',
        label: 'Row 0 Right: Front Cab Window Seat (#2)',
        localOffset: { x: 0.68, y: 0.68, z: 1.68 },
        eyeOffset: { x: 0.68, y: 1.44, z: 1.68 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_1: {
        seatId: 'rear_passenger_1',
        role: 'PASSENGER',
        label: 'Row 1 Left: Window Seat (#3)',
        localOffset: { x: -0.74, y: 0.68, z: 0.62 },
        eyeOffset: { x: -0.74, y: 1.44, z: 0.62 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_2: {
        seatId: 'rear_passenger_2',
        role: 'PASSENGER',
        label: 'Row 1 Center: Doorway Access Aisle Seat (#4)',
        localOffset: { x: -0.18, y: 0.68, z: 0.62 },
        eyeOffset: { x: -0.18, y: 1.44, z: 0.62 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_3: {
        seatId: 'rear_passenger_3',
        role: 'PASSENGER',
        label: 'Row 2 Left: Window Seat (#5)',
        localOffset: { x: -0.74, y: 0.68, z: -0.32 },
        eyeOffset: { x: -0.74, y: 1.44, z: -0.32 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_4: {
        seatId: 'rear_passenger_4',
        role: 'PASSENGER',
        label: 'Row 2 Center: Mid-Cabin Seat (#6)',
        localOffset: { x: -0.18, y: 0.68, z: -0.32 },
        eyeOffset: { x: -0.18, y: 1.44, z: -0.32 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_5: {
        seatId: 'rear_passenger_5',
        role: 'PASSENGER',
        label: 'Row 2 Right: Window Seat (#7)',
        localOffset: { x: 0.68, y: 0.68, z: -0.32 },
        eyeOffset: { x: 0.68, y: 1.44, z: -0.32 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_6: {
        seatId: 'rear_passenger_6',
        role: 'PASSENGER',
        label: 'Row 3 Left: Window Seat (#8)',
        localOffset: { x: -0.74, y: 0.68, z: -1.22 },
        eyeOffset: { x: -0.74, y: 1.44, z: -1.22 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_7: {
        seatId: 'rear_passenger_7',
        role: 'PASSENGER',
        label: 'Row 3 Center: Rear-Mid Seat (#9)',
        localOffset: { x: -0.18, y: 0.68, z: -1.22 },
        eyeOffset: { x: -0.18, y: 1.44, z: -1.22 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_8: {
        seatId: 'rear_passenger_8',
        role: 'PASSENGER',
        label: 'Row 3 Right: Window Seat (#10)',
        localOffset: { x: 0.68, y: 0.68, z: -1.22 },
        eyeOffset: { x: 0.68, y: 1.44, z: -1.22 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_9: {
        seatId: 'rear_passenger_9',
        role: 'PASSENGER',
        label: 'Row 4 Left: Back Bench Seat (#11)',
        localOffset: { x: -0.58, y: 0.70, z: -2.08 },
        eyeOffset: { x: -0.58, y: 1.46, z: -2.08 },
        occupantId: 'npc_commuter_ngozi',
        occupantName: 'Mama_Ngozi (Commuter)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      rear_passenger_10: {
        seatId: 'rear_passenger_10',
        role: 'PASSENGER',
        label: 'Row 4 Right: Back Bench Seat (#12)',
        localOffset: { x: 0.58, y: 0.70, z: -2.08 },
        eyeOffset: { x: 0.58, y: 1.46, z: -2.08 },
        occupantId: 'npc_commuter_babatunde',
        occupantName: 'Babatunde_Clerk (Commuter)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
    },
  };

  m48Vehicles['veh_okada_dispatch'] = {
    vehicleId: 'veh_okada_dispatch',
    vehicleKey: 'okada',
    displayName: 'EkoBox 150 Dispatch Motorcycle',
    ownershipMode: 'AUTHORIZED_RENTAL_OR_TUTORIAL',
    ownerId: 'org_ekobox_express',
    ownerName: 'EkoBox Express Dispatch Fleet',
    authorizedDriverIds: ['*'],
    requiredQualification: null,
    drivingState: 'PARKED',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Rider Front Saddle',
        localOffset: { x: 0, y: 0.74, z: -0.15 },
        eyeOffset: { x: 0, y: 1.44, z: -0.18 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      pillion_passenger: {
        seatId: 'pillion_passenger',
        role: 'PASSENGER',
        label: 'Pillion Passenger Saddle',
        localOffset: { x: 0, y: 0.78, z: -0.62 },
        eyeOffset: { x: 0, y: 1.48, z: -0.62 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
    },
  };

  m48Vehicles['veh_keke_bayo'] = {
    vehicleId: 'veh_keke_bayo',
    vehicleKey: 'keke',
    displayName: 'TVS King Deluxe Keke Napep (Bayo Shuttle)',
    ownershipMode: 'NPC_DRIVEN_PUBLIC_TRANSIT',
    ownerId: 'peer_bayo_02',
    ownerName: 'Bayo_Keke (Marina Shuttle Operator)',
    authorizedDriverIds: ['*'],
    requiredQualification: null,
    drivingState: 'NPC_TRANSIT_ROUTE',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Keke Forward Handlebar Seat',
        localOffset: { x: 0, y: 0.68, z: 0.42 },
        eyeOffset: { x: 0, y: 1.38, z: 0.42 },
        occupantId: 'peer_bayo_02',
        occupantName: 'Bayo_Keke (NPC)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      rear_passenger_1: {
        seatId: 'rear_passenger_1',
        role: 'PASSENGER',
        label: 'Rear Canopy Bench (Left)',
        localOffset: { x: -0.34, y: 0.72, z: -0.45 },
        eyeOffset: { x: -0.34, y: 1.38, z: -0.45 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_2: {
        seatId: 'rear_passenger_2',
        role: 'PASSENGER',
        label: 'Rear Canopy Bench (Right)',
        localOffset: { x: 0.34, y: 0.72, z: -0.45 },
        eyeOffset: { x: 0.34, y: 1.38, z: -0.45 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
    },
  };

  m48Vehicles['veh_brt_lamata'] = {
    vehicleId: 'veh_brt_lamata',
    vehicleKey: 'brt',
    displayName: 'LAMATA Marcopolo High-Capacity BRT Coach',
    ownershipMode: 'QUALIFICATION_LOCKED',
    ownerId: 'org_lamata_authority',
    ownerName: 'Lagos Metropolitan Area Transport Authority (LAMATA)',
    authorizedDriverIds: [],
    requiredQualification: {
      licenceId: 'cdl_mass_transit',
      title: 'LAMATA Mass Transit CDL Qualification (Driving Skill Lv.2)',
      requiredSkillId: 'skill_driving',
      requiredSkillLevel: 2,
    },
    drivingState: 'NPC_TRANSIT_ROUTE',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'BRT Enclosed Captain Cockpit Seat',
        localOffset: { x: -0.72, y: 1.12, z: 3.18 },
        eyeOffset: { x: -0.72, y: 1.82, z: 3.18 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      front_passenger: {
        seatId: 'front_passenger',
        role: 'PASSENGER',
        label: 'BRT Forward Panoramic Passenger Seat',
        localOffset: { x: 0.72, y: 1.12, z: 2.15 },
        eyeOffset: { x: 0.72, y: 1.82, z: 2.15 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_1: {
        seatId: 'rear_passenger_1',
        role: 'PASSENGER',
        label: 'BRT Mid-Deck Window Seat (Left)',
        localOffset: { x: -0.75, y: 1.12, z: 0.35 },
        eyeOffset: { x: -0.75, y: 1.82, z: 0.35 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      rear_passenger_2: {
        seatId: 'rear_passenger_2',
        role: 'PASSENGER',
        label: 'BRT Mid-Deck Window Seat (Right)',
        localOffset: { x: 0.75, y: 1.12, z: -0.85 },
        eyeOffset: { x: 0.75, y: 1.82, z: -0.85 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
    },
  };

  m48Vehicles['veh_peer_locked_suv'] = {
    vehicleId: 'veh_peer_locked_suv',
    vehicleKey: 'sedan',
    displayName: 'Tunde_VI_Exec Private Sedan (Owner Locked)',
    ownershipMode: 'OTHER_HUMAN_OWNED_LOCKED',
    ownerId: 'usr_other_human_owner_99',
    ownerName: 'Tunde_VI_Exec',
    authorizedDriverIds: ['usr_other_human_owner_99'],
    requiredQualification: null,
    drivingState: 'PARKED',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Driver Seat (Owner Reserved)',
        localOffset: { x: -0.44, y: 0.56, z: 0.08 },
        eyeOffset: { x: -0.44, y: 1.26, z: 0.08 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
      front_passenger: {
        seatId: 'front_passenger',
        role: 'PASSENGER',
        label: 'Front Passenger Seat',
        localOffset: { x: 0.44, y: 0.56, z: 0.08 },
        eyeOffset: { x: 0.44, y: 1.26, z: 0.08 },
        occupantId: null,
        occupantName: null,
        occupantKind: null,
        occupiedAt: null,
      },
    },
  };

  m48Vehicles['veh_npc_full_shuttle'] = {
    vehicleId: 'veh_npc_full_shuttle',
    vehicleKey: 'danfo',
    displayName: 'Marina Express Danfo #09 (Full Capacity)',
    ownershipMode: 'NPC_DRIVEN_PUBLIC_TRANSIT',
    ownerId: 'npc_driver_muri',
    ownerName: 'Muri_Express (NPC)',
    authorizedDriverIds: ['npc_driver_muri'],
    requiredQualification: null,
    drivingState: 'NPC_TRANSIT_ROUTE',
    seats: {
      driver: {
        seatId: 'driver',
        role: 'DRIVER',
        label: 'Driver Seat',
        localOffset: { x: -0.56, y: 1.05, z: 1.58 },
        eyeOffset: { x: -0.56, y: 1.76, z: 1.58 },
        occupantId: 'npc_driver_muri',
        occupantName: 'Muri_Express (NPC)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      front_passenger: {
        seatId: 'front_passenger',
        role: 'PASSENGER',
        label: 'Front Passenger Seat',
        localOffset: { x: 0.48, y: 1.05, z: 1.58 },
        eyeOffset: { x: 0.48, y: 1.76, z: 1.58 },
        occupantId: 'npc_commuter_a',
        occupantName: 'Commuter_A (NPC)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
      rear_passenger_1: {
        seatId: 'rear_passenger_1',
        role: 'PASSENGER',
        label: 'Rear Seat 1',
        localOffset: { x: -0.55, y: 1.05, z: 0.25 },
        eyeOffset: { x: -0.55, y: 1.72, z: 0.25 },
        occupantId: 'npc_commuter_b',
        occupantName: 'Commuter_B (NPC)',
        occupantKind: 'SIMULATED_NPC',
        occupiedAt: Date.now(),
      },
    },
  };
}

function getPlayerM48Occupancy(playerId: string) {
  ensureM48VehicleRegistry();
  if (!m48PlayerOccupancy[playerId]) {
    m48PlayerOccupancy[playerId] = {
      playerId,
      state: 'ON_FOOT',
      vehicleId: null,
      seatId: null,
      commercialEarningsEligible: false,
      activeJobId: null,
      transitionHistory: [],
      updatedAt: Date.now(),
    };
  }
  return m48PlayerOccupancy[playerId];
}

function clearPlayerSeatFromAllVehicles(playerId: string): void {
  for (const veh of Object.values(m48Vehicles)) {
    for (const seat of Object.values(veh.seats)) {
      if (seat.occupantId === playerId) {
        seat.occupantId = null;
        seat.occupantName = null;
        seat.occupantKind = null;
        seat.occupiedAt = null;
        if (seat.role === 'DRIVER') {
          veh.drivingState = 'PARKED';
        }
      }
    }
  }
}

function requestM48VehicleSeat(params: {
  acc: M47AccountRecord;
  playerId: string;
  playerName: string;
  vehicleId: string;
  requestedRole: M48OccupancyRole;
  preferredSeatId?: string;
}): any {
  ensureM48VehicleRegistry();
  const { acc, playerId, playerName, vehicleId, requestedRole, preferredSeatId } = params;
  const veh = m48Vehicles[vehicleId];
  if (!veh) {
    return {
      ok: false,
      httpStatus: 404,
      error: 'VEHICLE_NOT_FOUND',
      reason: `Vehicle ${vehicleId} does not exist in the authoritative registry.`,
    };
  }

  const occ = getPlayerM48Occupancy(playerId);

  if (requestedRole === 'DRIVER') {
    const driverSeat = veh.seats['driver'];
    if (!driverSeat) {
      return {
        ok: false,
        httpStatus: 400,
        error: 'NO_DRIVER_SEAT',
        reason: 'This vehicle does not have an operable driver seat.',
      };
    }

    // 1. Prevent ejecting or stealing control from another human driver
    if (
      driverSeat.occupantId &&
      driverSeat.occupantId !== playerId &&
      driverSeat.occupantKind === 'HUMAN_PLAYER'
    ) {
      return {
        ok: false,
        httpStatus: 409,
        error: 'DRIVER_SEAT_OCCUPIED_BY_HUMAN',
        reason: `Driver seat is currently occupied by ${driverSeat.occupantName || driverSeat.occupantId}. You cannot take control of an active driver's vehicle.`,
        alternativeAction: 'BOARD_AS_PASSENGER',
        alternativePrompt: 'Board as Passenger [F] or join as Conductor [G] if available.',
      };
    }

    // 2. Ownership / Access Check
    if (veh.ownershipMode === 'OTHER_HUMAN_OWNED_LOCKED') {
      const isAuthorized =
        veh.ownerId === playerId ||
        veh.authorizedDriverIds.includes('*') ||
        veh.authorizedDriverIds.includes(playerId);
      if (!isAuthorized) {
        return {
          ok: false,
          httpStatus: 403,
          error: 'VEHICLE_RESERVED_BY_OWNER',
          reason: `Vehicle reserved by its owner (${veh.ownerName}). Ask the owner for driving access or board as a passenger.`,
          alternativeAction: 'BOARD_AS_PASSENGER',
          alternativePrompt: 'Board Front Passenger Seat [F] or summon your own starter vehicle.',
        };
      }
    }

    // 3. Career / Licence Qualification Check (e.g. LAMATA BRT Coach requires Mass Transit CDL / Driving Skill Lv.2)
    if (veh.requiredQualification) {
      const q = veh.requiredQualification;
      const skillVal = Number(acc.skills?.[q.requiredSkillId] || 1);
      const isAuthorized =
        skillVal >= q.requiredSkillLevel ||
        veh.authorizedDriverIds.includes(playerId) ||
        acc.onboarding.ownedVehicles?.includes(veh.vehicleId);
      if (!isAuthorized) {
        return {
          ok: false,
          httpStatus: 403,
          error: 'DRIVING_QUALIFICATION_REQUIRED',
          requiredQualification: q,
          reason: `Driving licence required: ${q.title}. Current Driving Skill is Lv.${skillVal} (requires Lv.${q.requiredSkillLevel}).`,
          alternativeAction: 'BOARD_AS_PASSENGER',
          alternativePrompt: 'You can board this LAMATA BRT Coach as a Passenger [F] right now, or complete commercial shifts in the Danfo/Sedan to reach Driving Skill Lv.2.',
        };
      }
    }

    // Validated! Clear any previous seat held by this player (mutual exclusion: cannot be driver + passenger + conductor)
    clearPlayerSeatFromAllVehicles(playerId);

    driverSeat.occupantId = playerId;
    driverSeat.occupantName = playerName;
    driverSeat.occupantKind = 'HUMAN_PLAYER';
    driverSeat.occupiedAt = Date.now();

    const activeJobId = acc.onboarding.activeJobId || null;
    const commercialEarningsEligible = Boolean(activeJobId);
    veh.drivingState = commercialEarningsEligible ? 'COMMERCIAL_SHIFT_ACTIVE' : 'DRIVING_FREE_ROAM';

    const prevState = occ.state;
    occ.transitionHistory.push(
      { from: prevState, to: 'ENTERING_VEHICLE', vehicleId, seatId: 'driver', timestamp: Date.now() },
      { from: 'ENTERING_VEHICLE', to: 'DRIVER', vehicleId, seatId: 'driver', timestamp: Date.now() }
    );
    occ.state = 'DRIVER';
    occ.vehicleId = vehicleId;
    occ.seatId = 'driver';
    occ.commercialEarningsEligible = commercialEarningsEligible;
    occ.activeJobId = activeJobId;
    occ.updatedAt = Date.now();

    acc.onboarding.isDriving = true;
    saveStore();

    return {
      ok: true,
      httpStatus: 200,
      role: 'DRIVER',
      transitionSequence: [prevState, 'ENTERING_VEHICLE', 'DRIVER'],
      vehicleId,
      vehicleKey: veh.vehicleKey,
      seat: driverSeat,
      vehicle: veh,
      commercialEarningsEligible,
      freeRoamMode: !commercialEarningsEligible,
      rewardAwardedGN: 0,
      rewardAwardedHustleCoins: 0,
      playerOccupancy: occ,
    };
  }

  if (requestedRole === 'PASSENGER') {
    const passengerSeats = Object.values(veh.seats).filter((s) => s.role === 'PASSENGER');
    let chosenSeat: M48SeatRecord | undefined;
    if (preferredSeatId) {
      const pref = passengerSeats.find((s) => s.seatId === preferredSeatId);
      if (pref && pref.occupantId && pref.occupantId !== playerId) {
        return {
          ok: false,
          httpStatus: 409,
          error: 'SEAT_ALREADY_OCCUPIED',
          reason: `Seat ${pref.label} (${pref.seatId}) is already occupied by ${pref.occupantName || pref.occupantId}. Occupied seats cannot be claimed twice.`,
        };
      }
      if (pref && (!pref.occupantId || pref.occupantId === playerId)) {
        chosenSeat = pref;
      }
    }
    if (!chosenSeat) {
      chosenSeat = passengerSeats.find((s) => !s.occupantId || s.occupantId === playerId);
    }

    if (!chosenSeat) {
      return {
        ok: false,
        httpStatus: 409,
        error: 'NO_SEATS_AVAILABLE',
        reason: `No passenger seats available on ${veh.displayName}. All ${passengerSeats.length} passenger seats are currently occupied.`,
      };
    }

    clearPlayerSeatFromAllVehicles(playerId);

    chosenSeat.occupantId = playerId;
    chosenSeat.occupantName = playerName;
    chosenSeat.occupantKind = 'HUMAN_PLAYER';
    chosenSeat.occupiedAt = Date.now();

    const prevState = occ.state;
    occ.transitionHistory.push(
      { from: prevState, to: 'ENTERING_VEHICLE', vehicleId, seatId: chosenSeat.seatId, timestamp: Date.now() },
      { from: 'ENTERING_VEHICLE', to: 'PASSENGER', vehicleId, seatId: chosenSeat.seatId, timestamp: Date.now() }
    );
    occ.state = 'PASSENGER';
    occ.vehicleId = vehicleId;
    occ.seatId = chosenSeat.seatId;
    occ.commercialEarningsEligible = false;
    occ.updatedAt = Date.now();

    acc.onboarding.isDriving = false;
    saveStore();

    return {
      ok: true,
      httpStatus: 200,
      role: 'PASSENGER',
      transitionSequence: [prevState, 'ENTERING_VEHICLE', 'PASSENGER'],
      vehicleId,
      vehicleKey: veh.vehicleKey,
      seat: chosenSeat,
      vehicle: veh,
      rewardAwardedGN: 0,
      rewardAwardedHustleCoins: 0,
      playerOccupancy: occ,
    };
  }

  if (requestedRole === 'CONDUCTOR') {
    const conductorSeat = Object.values(veh.seats).find((s) => s.role === 'CONDUCTOR');
    if (!conductorSeat) {
      return {
        ok: false,
        httpStatus: 400,
        error: 'CONDUCTOR_ROLE_NOT_SUPPORTED_ON_VEHICLE',
        reason: `${veh.displayName} does not support a Danfo Conductor doorway position. Use an Apex Danfo 14 Commercial Minibus.`,
      };
    }
    if (
      conductorSeat.occupantId &&
      conductorSeat.occupantId !== playerId &&
      conductorSeat.occupantKind === 'HUMAN_PLAYER'
    ) {
      return {
        ok: false,
        httpStatus: 409,
        error: 'CONDUCTOR_POSITION_OCCUPIED',
        reason: `Conductor position is already occupied by ${conductorSeat.occupantName || conductorSeat.occupantId}.`,
      };
    }

    clearPlayerSeatFromAllVehicles(playerId);

    conductorSeat.occupantId = playerId;
    conductorSeat.occupantName = playerName;
    conductorSeat.occupantKind = 'HUMAN_PLAYER';
    conductorSeat.occupiedAt = Date.now();

    const prevState = occ.state;
    occ.transitionHistory.push(
      { from: prevState, to: 'ENTERING_VEHICLE', vehicleId, seatId: conductorSeat.seatId, timestamp: Date.now() },
      { from: 'ENTERING_VEHICLE', to: 'CONDUCTOR', vehicleId, seatId: conductorSeat.seatId, timestamp: Date.now() }
    );
    occ.state = 'CONDUCTOR';
    occ.vehicleId = vehicleId;
    occ.seatId = conductorSeat.seatId;
    occ.commercialEarningsEligible = true;
    occ.updatedAt = Date.now();

    acc.onboarding.isDriving = false;
    saveStore();

    return {
      ok: true,
      httpStatus: 200,
      role: 'CONDUCTOR',
      transitionSequence: [prevState, 'ENTERING_VEHICLE', 'CONDUCTOR'],
      vehicleId,
      vehicleKey: veh.vehicleKey,
      seat: conductorSeat,
      vehicle: veh,
      rewardAwardedGN: 0,
      rewardAwardedHustleCoins: 0,
      playerOccupancy: occ,
    };
  }

  return {
    ok: false,
    httpStatus: 400,
    error: 'INVALID_REQUESTED_ROLE',
    reason: `Unsupported occupancy role: ${requestedRole}`,
  };
}

function exitM48VehicleSeat(
  acc: M47AccountRecord,
  playerId: string,
  exitPosition?: { x: number; y: number; z: number }
): any {
  ensureM48VehicleRegistry();
  const occ = getPlayerM48Occupancy(playerId);
  const prevState = occ.state;
  const prevVehicleId = occ.vehicleId;
  const prevSeatId = occ.seatId;

  clearPlayerSeatFromAllVehicles(playerId);

  // Restore Bayo NPC driver if player exited Bayo's Keke driver seat
  if (prevVehicleId === 'veh_keke_bayo' && prevSeatId === 'driver') {
    const keke = m48Vehicles['veh_keke_bayo'];
    if (keke && keke.seats['driver'] && !keke.seats['driver'].occupantId) {
      keke.seats['driver'].occupantId = 'peer_bayo_02';
      keke.seats['driver'].occupantName = 'Bayo_Keke (NPC)';
      keke.seats['driver'].occupantKind = 'SIMULATED_NPC';
      keke.drivingState = 'NPC_TRANSIT_ROUTE';
    }
  }

  occ.transitionHistory.push(
    { from: prevState, to: 'EXITING_VEHICLE', vehicleId: prevVehicleId, seatId: prevSeatId, timestamp: Date.now() },
    { from: 'EXITING_VEHICLE', to: 'ON_FOOT', vehicleId: null, seatId: null, timestamp: Date.now() }
  );
  occ.state = 'ON_FOOT';
  occ.vehicleId = null;
  occ.seatId = null;
  occ.commercialEarningsEligible = false;
  occ.updatedAt = Date.now();

  acc.onboarding.isDriving = false;
  saveStore();

  return {
    ok: true,
    role: 'ON_FOOT',
    previousRole: prevState,
    previousVehicleId: prevVehicleId,
    previousSeatId: prevSeatId,
    transitionSequence: [prevState, 'EXITING_VEHICLE', 'ON_FOOT'],
    safeExitPosition: exitPosition || { x: -102, y: 0, z: -188 },
    playerOccupancy: occ,
  };
}

function handleM48DriverDisconnect(vehicleId: string, disconnectedDriverId: string): any {
  ensureM48VehicleRegistry();
  const veh = m48Vehicles[vehicleId];
  if (!veh) {
    return { ok: false, error: 'VEHICLE_NOT_FOUND' };
  }
  const driverSeat = veh.seats['driver'];
  if (driverSeat && (!disconnectedDriverId || driverSeat.occupantId === disconnectedDriverId)) {
    const oldDriver = driverSeat.occupantId;
    driverSeat.occupantId = null;
    driverSeat.occupantName = null;
    driverSeat.occupantKind = null;
    driverSeat.occupiedAt = null;
    if (oldDriver && m48PlayerOccupancy[oldDriver]) {
      m48PlayerOccupancy[oldDriver].state = 'ON_FOOT';
      m48PlayerOccupancy[oldDriver].vehicleId = null;
      m48PlayerOccupancy[oldDriver].seatId = null;
    }
  }
  veh.drivingState = 'SAFE_STOP_DRIVER_DISCONNECTED';

  const affectedPassengers: Array<{ playerId: string; seatId: string; status: string }> = [];
  for (const seat of Object.values(veh.seats)) {
    if (seat.role !== 'DRIVER' && seat.occupantId && seat.occupantKind === 'HUMAN_PLAYER') {
      affectedPassengers.push({
        playerId: seat.occupantId,
        seatId: seat.seatId,
        status: 'SAFE_HALT_READY_TO_EXIT_OR_SWITCH',
      });
    }
  }

  return {
    ok: true,
    vehicleId,
    drivingState: veh.drivingState,
    safetyPolicyApplied: 'VEHICLE_SAFELY_HALTED_PASSENGERS_PRESERVED_WITH_EXIT_PROMPT',
    affectedPassengers,
    vehicle: veh,
  };
}

// ============================================================================
// M4.8.1 DANFO ROUTES, STOP-TO-STOP FARE ENGINE & CONDUCTOR SYSTEM
// ============================================================================

export interface M481RouteStopDef {
  stopId: string;
  canonicalNodeId: string;
  name: string;
  sequence: number;
  x: number;
  z: number;
  allowBoard: boolean;
  allowAlight: boolean;
}

export interface M481DanfoRouteDef {
  routeId: string;
  name: string;
  displayDirection: string;
  operatingState: 'ACTIVE_BOARDING' | 'EN_ROUTE' | 'TERMINAL_TURNAROUND';
  stops: M481RouteStopDef[];
  connections: string[];
  stopToStopFareMatrixGN: Record<string, number>;
  rainSurchargeGN: number;
}

export const M481_DANFO_ROUTES: Record<string, M481DanfoRouteDef> = {
  route_cms_tbs_northbound: {
    routeId: 'route_cms_tbs_northbound',
    name: 'CMS → TBS Commercial Express',
    displayDirection: 'Northbound along Broad Street Corridor (CMS Bus Terminal → TBS Gate)',
    operatingState: 'ACTIVE_BOARDING',
    connections: ['route_tbs_cms_southbound', 'route_marina_waterfront'],
    rainSurchargeGN: 50,
    stops: [
      {
        stopId: 'stop_cms_bus_terminal',
        canonicalNodeId: 'node_cms_bus_park',
        name: 'CMS Bus Terminal',
        sequence: 0,
        x: -110.2,
        z: -200.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_st_north',
        canonicalNodeId: 'node_broad_st_north',
        name: 'Broad St North (Balogun)',
        sequence: 1,
        x: -110.2,
        z: -135.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_street_central',
        canonicalNodeId: 'node_broad_st_mid',
        name: 'Broad St Central (Financial Towers)',
        sequence: 2,
        x: -110.2,
        z: -90.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_st_south',
        canonicalNodeId: 'node_broad_st_south',
        name: 'Broad St South Gateway',
        sequence: 3,
        x: -110.2,
        z: -25.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_tbs_plaza_gate',
        canonicalNodeId: 'node_tbs_plaza',
        name: 'TBS Gate (Tafawa Balewa Square)',
        sequence: 4,
        x: -110.2,
        z: 40.0,
        allowBoard: true,
        allowAlight: true,
      },
    ],
    stopToStopFareMatrixGN: {
      'stop_cms_bus_terminal->stop_broad_st_north': 150,
      'stop_cms_bus_terminal->stop_broad_street_central': 250,
      'stop_cms_bus_terminal->stop_broad_st_south': 350,
      'stop_cms_bus_terminal->stop_tbs_plaza_gate': 450,
      'stop_broad_st_north->stop_broad_street_central': 150,
      'stop_broad_st_north->stop_broad_st_south': 250,
      'stop_broad_st_north->stop_tbs_plaza_gate': 400,
      'stop_broad_street_central->stop_broad_st_south': 150,
      'stop_broad_street_central->stop_tbs_plaza_gate': 300,
      'stop_broad_st_south->stop_tbs_plaza_gate': 200,
    },
  },
  route_tbs_cms_southbound: {
    routeId: 'route_tbs_cms_southbound',
    name: 'TBS → CMS Return Shuttle',
    displayDirection: 'Southbound along Broad Street Corridor (TBS Gate → CMS Bus Terminal)',
    operatingState: 'ACTIVE_BOARDING',
    connections: ['route_cms_tbs_northbound', 'route_marina_waterfront'],
    rainSurchargeGN: 50,
    stops: [
      {
        stopId: 'stop_tbs_plaza_gate',
        canonicalNodeId: 'node_tbs_plaza',
        name: 'TBS Gate (Tafawa Balewa Square)',
        sequence: 0,
        x: -110.2,
        z: 40.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_st_south',
        canonicalNodeId: 'node_broad_st_south',
        name: 'Broad St South Gateway',
        sequence: 1,
        x: -110.2,
        z: -25.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_street_central',
        canonicalNodeId: 'node_broad_st_mid',
        name: 'Broad St Central (Financial Towers)',
        sequence: 2,
        x: -110.2,
        z: -90.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_st_north',
        canonicalNodeId: 'node_broad_st_north',
        name: 'Broad St North (Balogun)',
        sequence: 3,
        x: -110.2,
        z: -135.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_cms_bus_terminal',
        canonicalNodeId: 'node_cms_bus_park',
        name: 'CMS Bus Terminal',
        sequence: 4,
        x: -110.2,
        z: -200.0,
        allowBoard: true,
        allowAlight: true,
      },
    ],
    stopToStopFareMatrixGN: {
      'stop_tbs_plaza_gate->stop_broad_st_south': 200,
      'stop_tbs_plaza_gate->stop_broad_street_central': 300,
      'stop_tbs_plaza_gate->stop_broad_st_north': 400,
      'stop_tbs_plaza_gate->stop_cms_bus_terminal': 450,
      'stop_broad_st_south->stop_broad_street_central': 150,
      'stop_broad_st_south->stop_broad_st_north': 250,
      'stop_broad_st_south->stop_cms_bus_terminal': 350,
      'stop_broad_street_central->stop_broad_st_north': 150,
      'stop_broad_street_central->stop_cms_bus_terminal': 250,
      'stop_broad_st_north->stop_cms_bus_terminal': 150,
    },
  },
  route_marina_waterfront: {
    routeId: 'route_marina_waterfront',
    name: 'TBS → Inner Marina → CMS Ferry Jetty',
    displayDirection: 'Westbound Waterfront Circuit (TBS → Catholic Mission → Marina → CMS Jetty)',
    operatingState: 'ACTIVE_BOARDING',
    connections: ['route_cms_tbs_northbound'],
    rainSurchargeGN: 50,
    stops: [
      {
        stopId: 'stop_tbs_plaza_gate',
        canonicalNodeId: 'node_tbs_plaza',
        name: 'TBS Gate (Tafawa Balewa Square)',
        sequence: 0,
        x: -110.2,
        z: 40.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_broad_street_central',
        canonicalNodeId: 'node_broad_st_mid',
        name: 'Broad St Central (Financial Towers)',
        sequence: 1,
        x: -110.2,
        z: -90.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_inner_marina_promenade',
        canonicalNodeId: 'node_marina_promenade',
        name: 'Inner Marina Waterfront Boulevard',
        sequence: 2,
        x: -118.0,
        z: -165.0,
        allowBoard: true,
        allowAlight: true,
      },
      {
        stopId: 'stop_cms_ferry_jetty',
        canonicalNodeId: 'node_cms_jetty',
        name: 'CMS Ferry Terminal (Waterfront)',
        sequence: 3,
        x: -122.0,
        z: -215.0,
        allowBoard: true,
        allowAlight: true,
      },
    ],
    stopToStopFareMatrixGN: {
      'stop_tbs_plaza_gate->stop_broad_street_central': 200,
      'stop_tbs_plaza_gate->stop_inner_marina_promenade': 300,
      'stop_tbs_plaza_gate->stop_cms_ferry_jetty': 400,
      'stop_broad_street_central->stop_inner_marina_promenade': 150,
      'stop_broad_street_central->stop_cms_ferry_jetty': 250,
      'stop_inner_marina_promenade->stop_cms_ferry_jetty': 150,
    },
  },
};

const m481SettledDanfoReceipts: Record<string, any> = {};
const m481DanfoRuntime = {
  activeRouteId: 'route_cms_tbs_northbound',
  currentStopId: 'stop_cms_bus_terminal',
  activeStopRequests: [] as Array<{
    requestId: string;
    playerId: string;
    playerName: string;
    routeId: string;
    requestedStopId: string;
    requestedStopName: string;
    phraseUsed: string;
    conductorAcknowledged: boolean;
    driverNotified: boolean;
    conductorReply: string;
    timestamp: number;
  }>,
  conductorAnnouncements: [
    {
      announcementId: 'ann_seed_01',
      conductorName: 'Tunde_Conductor (NPC)',
      routeId: 'route_cms_tbs_northbound',
      text: 'CMS to Broad Street, Financial Towers, Catholic Mission, TBS Gate! Enter with your change o!',
      timestamp: Date.now() - 10000,
    },
  ],
};

const M481_STOP_ID_ALIASES: Record<string, string> = {
  stop_cms: 'stop_cms_bus_terminal',
  stop_broad_north: 'stop_broad_st_north',
  stop_broad_central: 'stop_broad_street_central',
  stop_broad_south: 'stop_broad_st_south',
  stop_tbs_gate: 'stop_tbs_plaza_gate',
  stop_marina_pier: 'stop_inner_marina_promenade',
  stop_custom_house: 'stop_cms_ferry_jetty',
};

function normalizeM481StopId(rawStopId: string): string {
  const s = String(rawStopId || '').trim();
  return M481_STOP_ID_ALIASES[s] || s;
}

export function calculateM481DanfoFareQuote(params: {
  routeId: string;
  originStopId: string;
  destinationStopId: string;
  weatherRainActive?: boolean;
}): any {
  const route = M481_DANFO_ROUTES[params.routeId] || M481_DANFO_ROUTES['route_cms_tbs_northbound'];
  const normOriginId = normalizeM481StopId(params.originStopId);
  const normDestId = normalizeM481StopId(params.destinationStopId);
  const originStop = route.stops.find((s) => s.stopId === normOriginId || s.stopId === params.originStopId);
  if (!originStop) {
    return {
      ok: false,
      error: 'ORIGIN_STOP_NOT_ON_ROUTE',
      reason: `Boarding stop "${params.originStopId}" is not on route "${route.name}".`,
      alternativeRoute: M481_DANFO_ROUTES['route_marina_waterfront'],
    };
  }

  const destStop = route.stops.find((s) => s.stopId === normDestId || s.stopId === params.destinationStopId);
  if (!destStop) {
    // Find which canonical route serves this destination
    const altRoute = Object.values(M481_DANFO_ROUTES).find((r) =>
      r.stops.some((s) => s.stopId === params.destinationStopId)
    );
    return {
      ok: false,
      error: 'DESTINATION_NOT_ON_ROUTE',
      reason: `Destination "${params.destinationStopId}" is not served by ${route.name} (${route.displayDirection}).`,
      alternativeRoute: altRoute
        ? {
            routeId: altRoute.routeId,
            name: altRoute.name,
            displayDirection: altRoute.displayDirection,
          }
        : {
            routeId: 'route_marina_waterfront',
            name: 'TBS → Inner Marina → CMS Ferry Jetty',
            displayDirection: 'Westbound Waterfront Circuit',
          },
    };
  }

  if (destStop.sequence === originStop.sequence) {
    return {
      ok: false,
      error: 'ORIGIN_EQUALS_DESTINATION',
      reason: `You are already at ${originStop.name}. Choose a destination stop ahead along ${route.name}.`,
    };
  }

  if (destStop.sequence < originStop.sequence) {
    const reverseRouteId =
      route.routeId === 'route_cms_tbs_northbound' ? 'route_tbs_cms_southbound' : 'route_cms_tbs_northbound';
    const reverseRoute = M481_DANFO_ROUTES[reverseRouteId];
    return {
      ok: false,
      error: 'DESTINATION_BEHIND_DIRECTION_OF_TRAVEL',
      reason: `Destination ${destStop.name} (Stop #${destStop.sequence + 1}) lies behind this Danfo's current direction of travel from ${originStop.name} (Stop #${originStop.sequence + 1}) on ${route.name}.`,
      alternativeRoute: {
        routeId: reverseRoute.routeId,
        name: reverseRoute.name,
        displayDirection: reverseRoute.displayDirection,
      },
    };
  }

  const key = `${originStop.stopId}->${destStop.stopId}`;
  const baseFareGN = route.stopToStopFareMatrixGN[key] || (destStop.sequence - originStop.sequence) * 150;
  const weatherAdjustmentGN = params.weatherRainActive ? route.rainSurchargeGN : 0;
  const totalFareGN = baseFareGN + weatherAdjustmentGN;
  const driverShareGN = Math.round(totalFareGN * 0.7);
  const conductorShareGN = totalFareGN - driverShareGN;
  const intermediateStops = route.stops
    .filter((s) => s.sequence > originStop.sequence && s.sequence < destStop.sequence)
    .map((s) => s.name);

  return {
    ok: true,
    routeId: route.routeId,
    routeName: route.name,
    displayDirection: route.displayDirection,
    originStop,
    destinationStop: destStop,
    stopSegmentsCount: destStop.sequence - originStop.sequence,
    intermediateStops,
    baseFareGN,
    weatherAdjustmentGN,
    totalFareGN,
    driverShareGN,
    conductorShareGN,
    currency: 'GN',
    formattedQuoteText: `Route: ${route.name} | Boarding stop: ${originStop.name} | Destination: ${destStop.name} | Fare: ${totalFareGN} GN`,
  };
}

export function executeM481DanfoBoardAndPay(params: {
  acc: M47AccountRecord;
  playerId: string;
  playerName: string;
  vehicleId: string;
  routeId: string;
  originStopId: string;
  destinationStopId: string;
  preferredSeatId?: string;
  tenderedNoteGN?: number;
  weatherRainActive?: boolean;
  vehicleSpeedKmh?: number;
  idempotencyKey: string;
}): any {
  ensureM48VehicleRegistry();
  const {
    acc,
    playerId,
    playerName,
    vehicleId,
    routeId,
    originStopId,
    destinationStopId,
    preferredSeatId,
    tenderedNoteGN,
    weatherRainActive,
    vehicleSpeedKmh = 0,
    idempotencyKey,
  } = params;

  // 1. Idempotency check — never double-charge or double-credit
  if (m481SettledDanfoReceipts[idempotencyKey]) {
    const existingReceipt = m481SettledDanfoReceipts[idempotencyKey];
    return {
      ok: true,
      allowed: true,
      httpStatus: 200,
      duplicateIgnored: true,
      idempotentReplay: true,
      receipt: existingReceipt,
      farePaidGN: existingReceipt.totalFareGN,
      changeDueGN: existingReceipt.changeReturnedGN,
      balanceBeforeGN: existingReceipt.balanceBeforeGN,
      balanceAfterGN: existingReceipt.balanceAfterGN,
      passengerPaidDriverSalary: false,
      ledgerEntry: {
        entryId: existingReceipt.transactionId,
        direction: 'DEBIT',
        amountGN: existingReceipt.totalFareGN,
        balanceAfterGN: existingReceipt.balanceAfterGN,
      },
      gameNairaBalance: acc.gameNairaBalance,
    };
  }

  // 2. Stationary boarding safety check
  if (Math.abs(vehicleSpeedKmh) >= 5) {
    return {
      ok: false,
      httpStatus: 409,
      error: 'VEHICLE_MOVING_CANNOT_BOARD',
      reason: `Boarding is only permitted when the Danfo is stationary (< 5 km/h). Current speed: ${Math.round(Math.abs(vehicleSpeedKmh))} km/h.`,
      fareSettled: false,
    };
  }

  // 3. Validate route, origin, destination, and stop-to-stop fare
  const quote = calculateM481DanfoFareQuote({
    routeId,
    originStopId,
    destinationStopId,
    weatherRainActive,
  });
  if (!quote.ok) {
    return {
      ...quote,
      httpStatus: 400,
      fareSettled: false,
    };
  }

  const totalFareGN = quote.totalFareGN;
  const noteTendered = tenderedNoteGN !== undefined ? Number(tenderedNoteGN) : totalFareGN;
  if (noteTendered < totalFareGN) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'TENDERED_AMOUNT_BELOW_FARE',
      reason: `Tendered amount (${noteTendered} GN) is less than the configured journey fare (${totalFareGN} GN).`,
      fareSettled: false,
    };
  }

  // 4. Affordability check (reject unaffordable journey before touching seat state)
  if (acc.gameNairaBalance < totalFareGN) {
    return {
      ok: false,
      httpStatus: 402,
      error: 'INSUFFICIENT_GAME_NAIRA',
      reason: `Insufficient Game Naira for ${quote.originStop.name} → ${quote.destinationStop.name}. Fare is ${totalFareGN} GN, balance is ${acc.gameNairaBalance} GN.`,
      fareSettled: false,
    };
  }

  // 5. Request passenger seat (validates seat availability & prevents duplicate seat ownership)
  const seatRes = requestM48VehicleSeat({
    acc,
    playerId,
    playerName,
    vehicleId,
    requestedRole: 'PASSENGER',
    preferredSeatId,
  });

  if (!seatRes.ok) {
    return {
      ...seatRes,
      fareSettled: false,
    };
  }

  // 6. Atomically settle fare: debit passenger, credit transport income + conductor 30% commission
  const changeReturnedGN = noteTendered - totalFareGN;
  const balanceBeforeGN = acc.gameNairaBalance;
  acc.gameNairaBalance -= totalFareGN;

  const txId = `tx_danfo_fare_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const receipt = {
    transactionId: txId,
    idempotencyKey,
    vehicleId,
    routeId: quote.routeId,
    routeName: quote.routeName,
    originStopId: quote.originStop.stopId,
    originStopName: quote.originStop.name,
    destinationStopId: quote.destinationStop.stopId,
    destinationStopName: quote.destinationStop.name,
    stopSegmentsCount: quote.stopSegmentsCount,
    seatId: seatRes.seat.seatId,
    seatLabel: seatRes.seat.label,
    seatOffset: seatRes.seat.localOffset,
    eyeOffset: seatRes.seat.eyeOffset,
    baseFareGN: quote.baseFareGN,
    weatherAdjustmentGN: quote.weatherAdjustmentGN,
    totalFareGN,
    tenderedNoteGN: noteTendered,
    changeReturnedGN,
    passengerDebitGN: totalFareGN,
    transportIncomeCreditGN: quote.driverShareGN,
    conductorCommissionCreditGN: quote.conductorShareGN,
    passengerDrivingSalaryAwardedGN: 0,
    balanceBeforeGN,
    balanceAfterGN: acc.gameNairaBalance,
    settledAt: Date.now(),
  };

  acc.ledgerEntries.push({
    entryId: txId,
    idempotencyKey,
    description: `Danfo Fare: ${quote.originStop.name} → ${quote.destinationStop.name} (${quote.stopSegmentsCount} stops, Seat ${seatRes.seat.seatId})`,
    amountGN: -totalFareGN,
    debitAccount: 'Asset:Player:Cash',
    creditAccount: 'Revenue:Transit:DanfoFarePool',
    balanceAfterGN: acc.gameNairaBalance,
    timestamp: Date.now(),
  });

  m481SettledDanfoReceipts[idempotencyKey] = receipt;
  saveStore();

  return {
    ok: true,
    allowed: true,
    httpStatus: 200,
    duplicateIgnored: false,
    idempotentReplay: false,
    fareSettled: true,
    role: 'PASSENGER',
    seat: seatRes.seat,
    vehicle: seatRes.vehicle,
    quote,
    receipt,
    farePaidGN: totalFareGN,
    changeDueGN: changeReturnedGN,
    balanceBeforeGN,
    balanceAfterGN: acc.gameNairaBalance,
    passengerPaidDriverSalary: false,
    ledgerEntry: {
      entryId: txId,
      direction: 'DEBIT',
      amountGN: totalFareGN,
      balanceAfterGN: acc.gameNairaBalance,
    },
    gameNairaBalance: acc.gameNairaBalance,
  };
}

export function handleM481PassengerStopRequest(params: {
  playerId: string;
  playerName: string;
  routeId: string;
  requestedStopId: string;
  currentStopSequence: number;
  phraseUsed: string;
}): any {
  const route = M481_DANFO_ROUTES[params.routeId] || M481_DANFO_ROUTES['route_cms_tbs_northbound'];
  const targetStop = route.stops.find((s) => s.stopId === params.requestedStopId);

  if (!targetStop || !targetStop.allowAlight) {
    const nearestValid =
      route.stops.find((s) => s.sequence > params.currentStopSequence) || route.stops[route.stops.length - 1];
    return {
      ok: false,
      error: 'STOP_NOT_PERMITTED_ON_ROUTE',
      reason: `"${params.requestedStopId}" is not a permitted stopping point on ${route.name}. Directing you to the nearest valid stop: ${nearestValid.name}.`,
      nearestValidStop: nearestValid,
    };
  }

  if (targetStop.sequence <= params.currentStopSequence) {
    const nextStop =
      route.stops.find((s) => s.sequence > params.currentStopSequence) || route.stops[route.stops.length - 1];
    return {
      ok: false,
      error: 'STOP_ALREADY_PASSED',
      reason: `${targetStop.name} has already been passed on this journey. Nearest upcoming stop is ${nextStop.name}.`,
      nearestValidStop: nextStop,
    };
  }

  const conductorReply = `O wa o! Copy that — passenger dey drop for ${targetStop.name}! Driver Chidi, hold brake for ${targetStop.name} layby!`;
  const reqRecord = {
    requestId: `stopreq_${Date.now()}`,
    playerId: params.playerId,
    playerName: params.playerName,
    routeId: route.routeId,
    requestedStopId: targetStop.stopId,
    requestedStopName: targetStop.name,
    phraseUsed: params.phraseUsed || 'O wa o!',
    conductorAcknowledged: true,
    driverNotified: true,
    conductorReply,
    timestamp: Date.now(),
  };

  m481DanfoRuntime.activeStopRequests.push(reqRecord);
  m481DanfoRuntime.conductorAnnouncements.push({
    announcementId: `ann_${Date.now()}`,
    conductorName: 'Tunde_Conductor',
    routeId: route.routeId,
    text: conductorReply,
    timestamp: Date.now(),
  });

  return {
    ok: true,
    stopRequest: reqRecord,
    targetStop,
    conductorReply,
  };
}

export function handleM481ConductorAction(params: {
  acc: M47AccountRecord;
  playerId: string;
  playerName: string;
  actionType: string;
  routeId: string;
  stopId: string;
  passengerCount: number;
  tenderedNoteGN: number;
  fareGN: number;
  providedChangeGN: number;
  idempotencyKey?: string;
  conductorSharePct?: number;
  driverSharePct?: number;
  grossPurseGN?: number;
  parkFeeGN?: number;
  instantSettle?: boolean;
}): any {
  ensureM48VehicleRegistry();
  const route = M481_DANFO_ROUTES[params.routeId] || M481_DANFO_ROUTES['route_cms_tbs_northbound'];
  const stop = route.stops.find((s) => s.stopId === params.stopId) || route.stops[0];
  const danfoVeh = m48Vehicles['veh_danfo_coop'];
  const paxSeats = Object.values(danfoVeh.seats).filter((s) => s.role === 'PASSENGER');
  const freeSeats = paxSeats.filter((s) => !s.occupantId);

  if (params.actionType === 'NEGOTIATE_SPLIT') {
    const condPct = Math.max(25, Math.min(45, Math.round(Number(params.conductorSharePct) || 30)));
    const drvPct = 100 - condPct;
    return {
      ok: true,
      actionType: 'NEGOTIATE_SPLIT',
      driverSharePct: drvPct,
      conductorSharePct: condPct,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  if (params.actionType === 'COLLECT_TRIP_FARES') {
    // Mid-trip fare collection goes into the Bus Trip Purse (held for end-of-trip/shift settlement with Driver),
    // NOT directly into the conductor's personal account balance on every collection!
    const grossCollectedGN = Math.max(0, Math.round(Number(params.grossPurseGN) || (params.passengerCount * params.fareGN)));
    return {
      ok: true,
      actionType: 'COLLECT_TRIP_FARES',
      grossCollectedGN,
      creditedToPersonalAccountNow: false,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  if (params.actionType === 'SETTLE_SHIFT' || (params.actionType === 'COLLECT_FARES' && params.instantSettle)) {
    const idk = params.idempotencyKey || `cond_settle_${params.playerId}_${Date.now()}`;
    if (m481SettledDanfoReceipts[idk]) {
      return {
        ok: true,
        duplicateIgnored: true,
        receipt: m481SettledDanfoReceipts[idk],
        gameNairaBalance: params.acc.gameNairaBalance,
      };
    }

    const condPct = Math.max(25, Math.min(45, Math.round(Number(params.conductorSharePct) || 30)));
    const drvPct = 100 - condPct;
    const grossPurseGN = Math.max(
      0,
      Math.min(12000, Math.round(Number(params.grossPurseGN) || (Math.max(1, params.passengerCount) * params.fareGN)))
    );
    const parkFeeGN = Math.max(0, Math.min(400, Math.round(Number(params.parkFeeGN) || 0)));
    const netPoolGN = Math.max(0, grossPurseGN - parkFeeGN);
    const conductorShareGN = Math.round(netPoolGN * (condPct / 100));
    const driverShareGN = netPoolGN - conductorShareGN;

    if (conductorShareGN > 0) {
      params.acc.gameNairaBalance += conductorShareGN;
      const txId = `tx_cond_settle_${Date.now()}`;
      params.acc.ledgerEntries.push({
        entryId: txId,
        idempotencyKey: idk,
        description: `Danfo Shift Settlement (${condPct}% Conductor / ${drvPct}% Driver on ₦${netPoolGN} GN Net Trip Purse)`,
        amountGN: conductorShareGN,
        debitAccount: 'Revenue:Transit:DanfoFarePool',
        creditAccount: 'Asset:Player:Cash',
        balanceAfterGN: params.acc.gameNairaBalance,
        timestamp: Date.now(),
      });
      const receipt = {
        transactionId: txId,
        idempotencyKey: idk,
        grossPurseGN,
        parkFeeGN,
        netPoolGN,
        conductorSharePct: condPct,
        driverSharePct: drvPct,
        conductorCommissionGN: conductorShareGN,
        driverShareGN,
        balanceAfterGN: params.acc.gameNairaBalance,
      };
      m481SettledDanfoReceipts[idk] = receipt;
      saveStore();
      return {
        ok: true,
        actionType: params.actionType,
        duplicateIgnored: false,
        receipt,
        gameNairaBalance: params.acc.gameNairaBalance,
      };
    }
  }

  if (params.actionType === 'ANNOUNCE_ROUTE') {
    const nextStops = route.stops
      .filter((s) => s.sequence > stop.sequence)
      .map((s) => s.name)
      .join(' → ');
    const callout = `${stop.name} loading! Calling ${nextStops || 'TBS Gate'}! ${freeSeats.length} seats available inside — enter with your change o!`;
    const rec = {
      announcementId: `ann_${Date.now()}`,
      conductorName: params.playerName,
      routeId: route.routeId,
      text: callout,
      availableSeats: freeSeats.length,
      timestamp: Date.now(),
    };
    m481DanfoRuntime.conductorAnnouncements.push(rec);
    return {
      ok: true,
      actionType: 'ANNOUNCE_ROUTE',
      announcement: rec,
      availableSeats: freeSeats.length,
    };
  }

  if (params.actionType === 'COLLECT_FARE_AND_CHANGE') {
    const expectedChangeGN = params.tenderedNoteGN - params.fareGN;
    if (expectedChangeGN < 0) {
      return {
        ok: false,
        error: 'INVALID_TENDERED_AMOUNT',
        reason: 'Tendered note cannot be less than the fare.',
      };
    }
    const changeAccurate = Number(params.providedChangeGN) === expectedChangeGN;
    if (!changeAccurate) {
      return {
        ok: false,
        error: 'INCORRECT_CHANGE_ARITHMETIC',
        expectedChangeGN,
        providedChangeGN: params.providedChangeGN,
        reason: `Passenger tendered ${params.tenderedNoteGN} GN for a ${params.fareGN} GN fare. Correct change is ${expectedChangeGN} GN.`,
      };
    }

    const idk = params.idempotencyKey || `cond_collect_${params.playerId}_${Date.now()}`;
    if (m481SettledDanfoReceipts[idk]) {
      return {
        ok: true,
        duplicateIgnored: true,
        receipt: m481SettledDanfoReceipts[idk],
        gameNairaBalance: params.acc.gameNairaBalance,
      };
    }

    // Conductor receives 30% commission share on the collected fare
    const conductorCommissionGN = Math.round(params.fareGN * 0.3);
    const driverShareGN = params.fareGN - conductorCommissionGN;
    params.acc.gameNairaBalance += conductorCommissionGN;
    const txId = `tx_cond_comm_${Date.now()}`;
    params.acc.ledgerEntries.push({
      entryId: txId,
      idempotencyKey: idk,
      description: `Danfo Conductor 30% Fare Split (${params.fareGN} GN fare, Change ${expectedChangeGN} GN verified)`,
      amountGN: conductorCommissionGN,
      debitAccount: 'Revenue:Transit:DanfoFarePool',
      creditAccount: 'Asset:Player:Cash',
      balanceAfterGN: params.acc.gameNairaBalance,
      timestamp: Date.now(),
    });
    const receipt = {
      transactionId: txId,
      idempotencyKey: idk,
      fareGN: params.fareGN,
      tenderedNoteGN: params.tenderedNoteGN,
      changeReturnedGN: expectedChangeGN,
      conductorCommissionGN,
      driverShareGN,
      balanceAfterGN: params.acc.gameNairaBalance,
    };
    m481SettledDanfoReceipts[idk] = receipt;
    saveStore();

    return {
      ok: true,
      actionType: 'COLLECT_FARE_AND_CHANGE',
      duplicateIgnored: false,
      receipt,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  return {
    ok: true,
    actionType: params.actionType,
    availableSeats: freeSeats.length,
  };
}

// ============================================================================
// M4.9 LIVING LAGOS TRAFFIC, DANFO OPERATIONS, LANE RULES & ROAD INCIDENTS
// ============================================================================

export const M49_DANFO_OPERATING_STATES = [
  'OUT_OF_SERVICE',
  'APPROACHING_STOP',
  'QUEUING_FOR_STOP',
  'STOPPING',
  'DOORS_OPEN',
  'ALLOWING_ALIGHTING',
  'ALLOWING_BOARDING',
  'FARE_PROCESSING',
  'DOORS_CLOSING',
  'CHECKING_DEPARTURE',
  'MERGING_BACK_INTO_TRAFFIC',
  'EN_ROUTE',
  'STOPPING_FOR_HAZARD',
  'DIVERTING',
  'COMPLETING_ROUTE',
  'RETURNING_TO_DEPOT',
  'DISABLED',
  'RECOVERY_REQUIRED',
] as const;

export type M49DanfoOperatingState = (typeof M49_DANFO_OPERATING_STATES)[number];

export const M49_LANE_TYPES = [
  'GENERAL_TRAFFIC',
  'GENERAL_TRAFFIC_LEFT',
  'GENERAL_TRAFFIC_RIGHT',
  'BUS_STOP_BAY',
  'BUS_TERMINAL_ACCESS',
  'BRT_ONLY',
  'PUBLIC_TRANSPORT_ONLY',
  'SERVICE_LANE',
  'PARKING_AREA',
  'RESTRICTED_ACCESS',
  'TEMPORARILY_BLOCKED',
  'MERGE_ZONE',
] as const;

export type M49LaneType = (typeof M49_LANE_TYPES)[number];

export const M49_DRIVER_PROFILES = [
  'CALM',
  'ASSERTIVE',
  'IMPATIENT',
  'PROFESSIONAL',
  'INEXPERIENCED',
] as const;

export const M49_BANTER_CATEGORIES = [
  'ROAD_OBSTRUCTION',
  'AGGRESSIVE_MERGE',
  'MISSED_JUNCTION',
  'NEAR_COLLISION',
  'BUS_STOP_DEPARTURE',
  'PASSENGER_BOARDING',
  'FARE_DISPUTE',
  'TRAFFIC_QUEUE',
  'DRIVER_WARNING',
] as const;

export const M49_VEHICLE_LANE_PERMISSIONS: Record<
  string,
  {
    allowedLanes: M49LaneType[];
    forbiddenLanes: M49LaneType[];
    corridorX: {
      cruisingX: number;
      stopBayX: number;
      mergeZoneX: number;
      brtDedicatedX: number;
    };
  }
> = {
  DANFO: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'BUS_STOP_BAY',
      'BUS_TERMINAL_ACCESS',
      'PUBLIC_TRANSPORT_ONLY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -98.0,
      stopBayX: -110.2,
      mergeZoneX: -103.5,
      brtDedicatedX: -108.6,
    },
  },
  BRT: {
    allowedLanes: [
      'BRT_ONLY',
      'BUS_TERMINAL_ACCESS',
      'BUS_STOP_BAY',
      'PUBLIC_TRANSPORT_ONLY',
      'MERGE_ZONE',
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_RIGHT',
    ],
    forbiddenLanes: ['RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -108.5,
      stopBayX: -108.5,
      mergeZoneX: -108.5,
      brtDedicatedX: -108.5,
    },
  },
  PRIVATE_CAR: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'PUBLIC_TRANSPORT_ONLY', 'BUS_TERMINAL_ACCESS', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -94.0,
      stopBayX: -110.2,
      mergeZoneX: -103.5,
      brtDedicatedX: -108.6,
    },
  },
  TAXI: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'GENERAL_TRAFFIC_RIGHT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -94.0,
      stopBayX: -110.2,
      mergeZoneX: -103.5,
      brtDedicatedX: -108.6,
    },
  },
  KEKE: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -98.0,
      stopBayX: -110.2,
      mergeZoneX: -103.5,
      brtDedicatedX: -108.6,
    },
  },
  OKADA: {
    allowedLanes: [
      'GENERAL_TRAFFIC',
      'GENERAL_TRAFFIC_LEFT',
      'BUS_STOP_BAY',
      'MERGE_ZONE',
      'SERVICE_LANE',
      'PARKING_AREA',
    ],
    forbiddenLanes: ['BRT_ONLY', 'RESTRICTED_ACCESS', 'TEMPORARILY_BLOCKED'],
    corridorX: {
      cruisingX: -98.0,
      stopBayX: -110.2,
      mergeZoneX: -103.5,
      brtDedicatedX: -108.6,
    },
  },
};

interface M49VehicleComponentHealth {
  vehicleId: string;
  overallCondition: number;
  components: {
    body: number;
    tyres: number;
    steering: number;
    engine: number;
    lighting: number;
  };
  handlingImpact: {
    topSpeedMultiplier: number;
    accelerationMultiplier: number;
    steeringDriftRad: number;
    brakingEfficiency: number;
  };
  operatingStatus: 'OPERATIONAL' | 'DEGRADED' | 'DISABLED' | 'RECOVERY_REQUIRED';
  hazardLightsOn: boolean;
  estimatedRepairCostGN: number;
  lastIncidentTimestamp: number;
}

const m49TrafficRuntime = {
  initialized: false,
  danfoLifecycle: {
    vehicleId: 'veh_danfo_coop',
    vehicleClass: 'DANFO',
    driverProfile: 'ASSERTIVE',
    state: 'ALLOWING_BOARDING' as M49DanfoOperatingState,
    currentLane: 'BUS_STOP_BAY' as M49LaneType,
    slidingDoorState: 'OPEN' as 'OPEN' | 'CLOSING' | 'CLOSED',
    currentStopId: 'stop_cms_bus_terminal',
    nextStopId: 'stop_broad_st_north',
    routeId: 'route_cms_tbs_northbound',
    position: { x: -110.2, y: 0, z: -26.0, yaw: 0 },
    speedKmh: 0,
    humanDriverActive: false,
    remainingSeatedPassengersCount: 2,
    transitionLog: [] as Array<{
      from: M49DanfoOperatingState;
      to: M49DanfoOperatingState;
      lane: M49LaneType;
      slidingDoorState: 'OPEN' | 'CLOSING' | 'CLOSED';
      x: number;
      z: number;
      speedKmh: number;
      reason: string;
      timestamp: number;
    }>,
  },
  brtCorridorState: {
    vehicleId: 'veh_brt_01',
    vehicleClass: 'BRT',
    colorTheme: 'LAGOS_BRT_BLUE',
    currentLane: 'BRT_ONLY' as M49LaneType,
    corridorX: -108.6,
    state: 'EN_ROUTE',
    speedKmh: 42,
  },
  vehicleHealth: {} as Record<string, M49VehicleComponentHealth>,
  processedIncidentIds: new Set<string>(),
  pairCooldowns: {} as Record<string, number>,
  incidentHistory: [] as Array<any>,
};

function createDefaultM49VehicleHealth(vehicleId: string): M49VehicleComponentHealth {
  return {
    vehicleId,
    overallCondition: 100,
    components: {
      body: 100,
      tyres: 100,
      steering: 100,
      engine: 100,
      lighting: 100,
    },
    handlingImpact: {
      topSpeedMultiplier: 1.0,
      accelerationMultiplier: 1.0,
      steeringDriftRad: 0.0,
      brakingEfficiency: 1.0,
    },
    operatingStatus: 'OPERATIONAL',
    hazardLightsOn: false,
    estimatedRepairCostGN: 0,
    lastIncidentTimestamp: 0,
  };
}

function ensureM49TrafficState(): void {
  ensureM48VehicleRegistry();
  if (!m49TrafficRuntime.initialized) {
    m49TrafficRuntime.initialized = true;
    for (const vId of ['veh_danfo_coop', 'veh_sedan_starter', 'veh_okada_dispatch', 'veh_keke_bayo', 'veh_brt_01']) {
      m49TrafficRuntime.vehicleHealth[vId] = createDefaultM49VehicleHealth(vId);
    }
  }
}

function recordDanfoLifecycleTransition(
  toState: M49DanfoOperatingState,
  lane: M49LaneType,
  slidingDoorState: 'OPEN' | 'CLOSING' | 'CLOSED',
  x: number,
  z: number,
  speedKmh: number,
  reason: string
) {
  const lc = m49TrafficRuntime.danfoLifecycle;
  const fromState = lc.state;
  lc.state = toState;
  lc.currentLane = lane;
  lc.slidingDoorState = slidingDoorState;
  lc.position.x = Number(x.toFixed(2));
  lc.position.z = Number(z.toFixed(2));
  lc.speedKmh = Number(speedKmh.toFixed(1));
  lc.transitionLog.push({
    from: fromState,
    to: toState,
    lane,
    slidingDoorState,
    x: lc.position.x,
    z: lc.position.z,
    speedKmh: lc.speedKmh,
    reason,
    timestamp: Date.now(),
  });
  if (lc.transitionLog.length > 60) {
    lc.transitionLog.splice(0, lc.transitionLog.length - 60);
  }
}

export function triggerM49DanfoPostAlightDeparture(params: {
  vehicleId: string;
  alightedStopId: string;
  trafficGapClear?: boolean;
}): any {
  ensureM49TrafficState();
  const danfoVeh = m48Vehicles['veh_danfo_coop'];
  const driverSeat = danfoVeh?.seats?.driver;
  const humanDriverActive = Boolean(driverSeat && driverSeat.occupantKind === 'HUMAN_PLAYER');
  m49TrafficRuntime.danfoLifecycle.humanDriverActive = humanDriverActive;

  const remainingPassengers = Object.values(danfoVeh?.seats || {}).filter(
    (s) => s.role === 'PASSENGER' && s.occupantId !== null
  );
  m49TrafficRuntime.danfoLifecycle.remainingSeatedPassengersCount = remainingPassengers.length;

  // Never force automatic departure when a real human player is in DRIVER state
  if (humanDriverActive) {
    return {
      ok: true,
      autoDepartureTriggered: false,
      autoDepartureSuppressedForHumanDriver: true,
      reason: 'Human player occupies DRIVER seat; manual driver departure controls remain active.',
      state: m49TrafficRuntime.danfoLifecycle.state,
      remainingSeatedPassengersCount: remainingPassengers.length,
    };
  }

  const route = M481_DANFO_ROUTES['route_cms_tbs_northbound'];
  const stopIdx = route.stops.findIndex((s) => s.stopId === params.alightedStopId);
  const currentStop = stopIdx >= 0 ? route.stops[stopIdx] : route.stops[0];
  const nextStop =
    stopIdx >= 0 && stopIdx + 1 < route.stops.length
      ? route.stops[stopIdx + 1]
      : route.stops[0];

  m49TrafficRuntime.danfoLifecycle.currentStopId = currentStop.stopId;
  m49TrafficRuntime.danfoLifecycle.nextStopId = nextStop.stopId;

  const sequenceExecuted: M49DanfoOperatingState[] = [];

  recordDanfoLifecycleTransition(
    'ALLOWING_ALIGHTING',
    'BUS_STOP_BAY',
    'OPEN',
    -110.2,
    currentStop.z,
    0,
    `Passenger alighted at ${currentStop.name}; remaining ${remainingPassengers.length} passengers stay seated.`
  );
  sequenceExecuted.push('ALLOWING_ALIGHTING');

  recordDanfoLifecycleTransition(
    'ALLOWING_BOARDING',
    'BUS_STOP_BAY',
    'OPEN',
    -110.2,
    currentStop.z,
    0,
    `Checked stop queue at ${currentStop.name} for waiting passengers.`
  );
  sequenceExecuted.push('ALLOWING_BOARDING');

  recordDanfoLifecycleTransition(
    'DOORS_CLOSING',
    'BUS_STOP_BAY',
    'CLOSING',
    -110.2,
    currentStop.z,
    0,
    'Conductor Tunde closed sliding door and tapped roof panel twice.'
  );
  sequenceExecuted.push('DOORS_CLOSING');

  if (params.trafficGapClear === false) {
    recordDanfoLifecycleTransition(
      'CHECKING_DEPARTURE',
      'BUS_STOP_BAY',
      'CLOSED',
      -110.2,
      currentStop.z,
      0,
      'Departure lane temporarily blocked by passing traffic; holding stationary in BUS_STOP_BAY until gap clears.'
    );
    sequenceExecuted.push('CHECKING_DEPARTURE');
    return {
      ok: true,
      autoDepartureTriggered: true,
      holdingForTrafficGap: true,
      sequenceExecuted,
      currentState: m49TrafficRuntime.danfoLifecycle.state,
      currentLane: m49TrafficRuntime.danfoLifecycle.currentLane,
      slidingDoorState: m49TrafficRuntime.danfoLifecycle.slidingDoorState,
      position: { ...m49TrafficRuntime.danfoLifecycle.position },
      remainingSeatedPassengersCount: remainingPassengers.length,
    };
  }

  recordDanfoLifecycleTransition(
    'CHECKING_DEPARTURE',
    'BUS_STOP_BAY',
    'CLOSED',
    -110.2,
    currentStop.z + 1.2,
    6.5,
    'Checked side mirror and pedestrian clearance; sounded departure horn.'
  );
  sequenceExecuted.push('CHECKING_DEPARTURE');

  recordDanfoLifecycleTransition(
    'MERGING_BACK_INTO_TRAFFIC',
    'MERGE_ZONE',
    'CLOSED',
    -103.5,
    currentStop.z + 8.5,
    22.0,
    'Pulled laterally out of BUS_STOP_BAY (-110.2m) through MERGE_ZONE (-103.5m), avoiding BRT_ONLY (-108.6m).'
  );
  sequenceExecuted.push('MERGING_BACK_INTO_TRAFFIC');

  recordDanfoLifecycleTransition(
    'EN_ROUTE',
    'GENERAL_TRAFFIC_LEFT',
    'CLOSED',
    -98.0,
    currentStop.z + 24.0,
    38.5,
    `Merged onto major road GENERAL_TRAFFIC_LEFT (x = -98.0m) en route to ${nextStop.name}.`
  );
  sequenceExecuted.push('EN_ROUTE');

  return {
    ok: true,
    autoDepartureTriggered: true,
    autoDepartureSuppressedForHumanDriver: false,
    holdingForTrafficGap: false,
    sequenceExecuted,
    currentState: m49TrafficRuntime.danfoLifecycle.state,
    currentLane: m49TrafficRuntime.danfoLifecycle.currentLane,
    slidingDoorState: m49TrafficRuntime.danfoLifecycle.slidingDoorState,
    position: { ...m49TrafficRuntime.danfoLifecycle.position },
    nextStopId: nextStop.stopId,
    nextStopName: nextStop.name,
    remainingSeatedPassengersCount: remainingPassengers.length,
    usesBrtLane: false,
  };
}

export function stepOrTransitionM49DanfoLifecycle(body: Record<string, any>): any {
  ensureM49TrafficState();
  const action = String(body.action || 'STEP_FULL_CYCLE').toUpperCase();
  const danfoVeh = m48Vehicles['veh_danfo_coop'];
  const humanDriverActive =
    body.humanDriverActive !== undefined
      ? Boolean(body.humanDriverActive)
      : Boolean(danfoVeh?.seats?.driver?.occupantKind === 'HUMAN_PLAYER');
  m49TrafficRuntime.danfoLifecycle.humanDriverActive = humanDriverActive;

  if (action === 'SET_STATE' && body.targetState) {
    const targetState = String(body.targetState).toUpperCase() as M49DanfoOperatingState;
    if (!M49_DANFO_OPERATING_STATES.includes(targetState)) {
      return { ok: false, error: 'INVALID_DANFO_STATE', targetState };
    }
    if (humanDriverActive && body.triggeredByAutoAI) {
      return {
        ok: true,
        autoDepartureSuppressedForHumanDriver: true,
        state: m49TrafficRuntime.danfoLifecycle.state,
      };
    }
    const lane: M49LaneType =
      targetState === 'EN_ROUTE' || targetState === 'DIVERTING'
        ? 'GENERAL_TRAFFIC_LEFT'
        : targetState === 'MERGING_BACK_INTO_TRAFFIC'
          ? 'MERGE_ZONE'
          : 'BUS_STOP_BAY';
    const door: 'OPEN' | 'CLOSING' | 'CLOSED' =
      targetState === 'DOORS_OPEN' ||
      targetState === 'ALLOWING_ALIGHTING' ||
      targetState === 'ALLOWING_BOARDING' ||
      targetState === 'FARE_PROCESSING'
        ? 'OPEN'
        : targetState === 'DOORS_CLOSING'
          ? 'CLOSING'
          : 'CLOSED';
    const targetX = lane === 'GENERAL_TRAFFIC_LEFT' ? -98.0 : lane === 'MERGE_ZONE' ? -103.5 : -110.2;
    const targetSpeed =
      targetState === 'EN_ROUTE'
        ? 38.0
        : targetState === 'MERGING_BACK_INTO_TRAFFIC'
          ? 22.0
          : targetState === 'APPROACHING_STOP'
            ? 16.0
            : 0;
    recordDanfoLifecycleTransition(
      targetState,
      lane,
      door,
      targetX,
      Number(body.z ?? m49TrafficRuntime.danfoLifecycle.position.z),
      targetSpeed,
      String(body.reason || `Transitioned to ${targetState}`)
    );
    return {
      ok: true,
      danfoLifecycle: m49TrafficRuntime.danfoLifecycle,
    };
  }

  return triggerM49DanfoPostAlightDeparture({
    vehicleId: 'veh_danfo_coop',
    alightedStopId: String(body.stopId || m49TrafficRuntime.danfoLifecycle.currentStopId),
    trafficGapClear: body.trafficGapClear !== false,
  });
}

const M49_GRAPH_NODES: Record<
  string,
  {
    id: string;
    name: string;
    laneType: M49LaneType;
    transportModes: string[];
    connections: string[];
    pos: { x: number; y: number; z: number };
  }
> = {
  node_tbs_plaza: {
    id: 'node_tbs_plaza',
    name: 'Tafawa Balewa Square (TBS) Ceremonial Plaza',
    laneType: 'GENERAL_TRAFFIC',
    transportModes: ['walk', 'car', 'danfo'],
    connections: ['node_catholic_mission_st', 'node_broad_st_south', 'node_tbs_garage'],
    pos: { x: 0, y: 0, z: 0 },
  },
  node_tbs_garage: {
    id: 'node_tbs_garage',
    name: 'TBS Central Auto Garage & Workshop',
    laneType: 'SERVICE_LANE',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_tbs_plaza'],
    pos: { x: -60, y: 0, z: 40 },
  },
  node_catholic_mission_st: {
    id: 'node_catholic_mission_st',
    name: 'Catholic Mission Street Junction',
    laneType: 'GENERAL_TRAFFIC',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_tbs_plaza', 'node_broad_st_mid', 'node_odunlami_st'],
    pos: { x: -120, y: 0, z: -150 },
  },
  node_odunlami_st: {
    id: 'node_odunlami_st',
    name: 'Odunlami Street Corner',
    laneType: 'GENERAL_TRAFFIC',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_catholic_mission_st', 'node_broad_st_north'],
    pos: { x: -220, y: 0, z: -320 },
  },
  node_broad_st_north: {
    id: 'node_broad_st_north',
    name: 'Broad Street Commercial Spine (North)',
    laneType: 'GENERAL_TRAFFIC_LEFT',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_odunlami_st', 'node_broad_st_mid', 'node_cms_bus_park'],
    pos: { x: -350, y: 0, z: -480 },
  },
  node_broad_st_mid: {
    id: 'node_broad_st_mid',
    name: 'Broad Street / Financial Towers',
    laneType: 'GENERAL_TRAFFIC_RIGHT',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_broad_st_north', 'node_broad_st_south', 'node_catholic_mission_st', 'node_marina_promenade'],
    pos: { x: -220, y: 0, z: -250 },
  },
  node_broad_st_south: {
    id: 'node_broad_st_south',
    name: 'Broad Street South Gateway',
    laneType: 'GENERAL_TRAFFIC',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_broad_st_mid', 'node_tbs_plaza', 'node_marina_promenade'],
    pos: { x: -90, y: 0, z: -80 },
  },
  node_cms_bus_park: {
    id: 'node_cms_bus_park',
    name: 'CMS Multi-Modal Bus Terminal',
    laneType: 'BUS_STOP_BAY',
    transportModes: ['walk', 'car', 'danfo', 'brt', 'okada'],
    connections: ['node_broad_st_north', 'node_cms_brt_gate', 'node_cms_jetty', 'node_outer_marina_loop'],
    pos: { x: -480, y: 0, z: -620 },
  },
  node_cms_brt_gate: {
    id: 'node_cms_brt_gate',
    name: 'CMS Dedicated BRT Corridor Platform',
    laneType: 'BRT_ONLY',
    transportModes: ['walk', 'brt'],
    connections: ['node_cms_bus_park', 'node_outer_marina_loop', 'node_marina_rail_station'],
    pos: { x: -520, y: 0, z: -660 },
  },
  node_cms_jetty: {
    id: 'node_cms_jetty',
    name: 'CMS Ferry Terminal (Waterfront)',
    laneType: 'RESTRICTED_ACCESS',
    transportModes: ['walk', 'ferry'],
    connections: ['node_cms_bus_park', 'node_marina_promenade'],
    pos: { x: -560, y: 0, z: -720 },
  },
  node_marina_promenade: {
    id: 'node_marina_promenade',
    name: 'Inner Marina Waterfront Boulevard',
    laneType: 'GENERAL_TRAFFIC',
    transportModes: ['walk', 'car', 'danfo', 'okada'],
    connections: ['node_cms_jetty', 'node_broad_st_mid', 'node_broad_st_south', 'node_marina_rail_station'],
    pos: { x: -380, y: 0, z: -350 },
  },
  node_marina_rail_station: {
    id: 'node_marina_rail_station',
    name: 'Marina Blue Line Elevated Rail Station',
    laneType: 'RESTRICTED_ACCESS',
    transportModes: ['walk', 'rail'],
    connections: ['node_cms_brt_gate', 'node_marina_promenade', 'node_national_theatre_connector'],
    pos: { x: -450, y: 12, z: -500 },
  },
  node_outer_marina_loop: {
    id: 'node_outer_marina_loop',
    name: 'Outer Marina Expressway Loop',
    laneType: 'GENERAL_TRAFFIC_RIGHT',
    transportModes: ['car', 'danfo', 'brt', 'okada'],
    connections: ['node_cms_bus_park', 'node_cms_brt_gate', 'node_national_theatre_connector', 'node_fuel_station_marina'],
    pos: { x: -650, y: 0, z: -800 },
  },
  node_national_theatre_connector: {
    id: 'node_national_theatre_connector',
    name: 'Eko Bridge Approach (To National Theatre / Iganmu)',
    laneType: 'MERGE_ZONE',
    transportModes: ['car', 'danfo', 'brt', 'rail'],
    connections: ['node_outer_marina_loop', 'node_marina_rail_station'],
    pos: { x: -900, y: 8, z: -1050 },
  },
  node_fuel_station_marina: {
    id: 'node_fuel_station_marina',
    name: 'Oandoil Filling Station Marina',
    laneType: 'SERVICE_LANE',
    transportModes: ['car', 'danfo', 'okada'],
    connections: ['node_outer_marina_loop'],
    pos: { x: -600, y: 0, z: -760 },
  },
};

export function planM49VehicleRouteWithLaneRules(params: {
  startNodeId: string;
  endNodeId: string;
  vehicleClass: string;
  blockedNodeIds?: string[];
}): any {
  const vClass = params.vehicleClass in M49_VEHICLE_LANE_PERMISSIONS ? params.vehicleClass : 'DANFO';
  const rules = M49_VEHICLE_LANE_PERMISSIONS[vClass];
  const blocked = new Set(params.blockedNodeIds || []);

  const canTraverse = (nodeId: string): boolean => {
    if (blocked.has(nodeId)) return false;
    const n = M49_GRAPH_NODES[nodeId];
    if (!n) return false;
    if (rules.forbiddenLanes.includes(n.laneType)) return false;
    if (!rules.allowedLanes.includes(n.laneType)) return false;
    if (vClass === 'BRT') {
      return n.transportModes.includes('brt') || n.transportModes.includes('danfo');
    }
    if (vClass === 'DANFO') {
      return n.transportModes.includes('danfo');
    }
    if (vClass === 'KEKE' || vClass === 'OKADA') {
      return n.transportModes.includes('okada') || n.transportModes.includes('car');
    }
    return n.transportModes.includes('car');
  };

  if (!canTraverse(params.startNodeId) || !canTraverse(params.endNodeId)) {
    return {
      ok: false,
      vehicleClass: vClass,
      startNodeId: params.startNodeId,
      endNodeId: params.endNodeId,
      path: null,
      reason: `Start or destination node is on a lane forbidden for ${vClass} (e.g., BRT_ONLY or RESTRICTED_ACCESS).`,
      forbiddenLanes: rules.forbiddenLanes,
    };
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const id of Object.keys(M49_GRAPH_NODES)) {
    if (!canTraverse(id)) continue;
    dist[id] = Infinity;
    prev[id] = null;
    unvisited.add(id);
  }
  dist[params.startNodeId] = 0;

  while (unvisited.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (!u || best === Infinity) break;
    if (u === params.endNodeId) break;
    unvisited.delete(u);

    const nodeU = M49_GRAPH_NODES[u];
    for (const v of nodeU.connections) {
      if (!unvisited.has(v)) continue;
      const nodeV = M49_GRAPH_NODES[v];
      const dx = nodeU.pos.x - nodeV.pos.x;
      const dy = nodeU.pos.y - nodeV.pos.y;
      const dz = nodeU.pos.z - nodeV.pos.z;
      let edgeCost = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // BRT prefers BRT_ONLY nodes when available
      if (vClass === 'BRT' && nodeV.laneType === 'BRT_ONLY') {
        edgeCost *= 0.45;
      }
      const alt = dist[u] + edgeCost;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if (dist[params.endNodeId] === Infinity) {
    return {
      ok: false,
      vehicleClass: vClass,
      startNodeId: params.startNodeId,
      endNodeId: params.endNodeId,
      path: null,
      reason: 'No valid lane-compliant route found around blocked nodes.',
    };
  }

  const path: string[] = [];
  let curr: string | null = params.endNodeId;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  const visitedLanes = path.map((id) => ({
    nodeId: id,
    laneType: M49_GRAPH_NODES[id].laneType,
  }));

  return {
    ok: true,
    vehicleClass: vClass,
    startNodeId: params.startNodeId,
    endNodeId: params.endNodeId,
    path,
    visitedLanes,
    usesBrtOnly: visitedLanes.some((l) => l.laneType === 'BRT_ONLY'),
    divertedAroundBlockedNodes: (params.blockedNodeIds || []).length > 0,
    corridorX: rules.corridorX,
  };
}

export function reportM49RoadIncident(params: {
  acc: M47AccountRecord;
  incidentId: string;
  vehicleId: string;
  otherEntityId: string;
  incidentType: string;
  impactSpeedKmh: number;
  impactAngleDeg: number;
  playerRoleOverride?: string;
  bypassCooldownForTest?: boolean;
}): any {
  ensureM49TrafficState();
  const health =
    m49TrafficRuntime.vehicleHealth[params.vehicleId] ||
    (m49TrafficRuntime.vehicleHealth[params.vehicleId] = createDefaultM49VehicleHealth(params.vehicleId));

  // 1. Strict incidentId idempotency check
  if (m49TrafficRuntime.processedIncidentIds.has(params.incidentId)) {
    return {
      ok: true,
      duplicateIgnored: true,
      cooldownSuppressed: false,
      incidentId: params.incidentId,
      rewardGN: 0,
      hustleCoinsAwarded: 0,
      vehicleHealth: health,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  // 2. Per-vehicle pair cooldown check (prevents frame-by-frame collision spam)
  const pairKey = `${params.vehicleId}::${params.otherEntityId}`;
  const now = Date.now();
  const lastPairTime = m49TrafficRuntime.pairCooldowns[pairKey] || 0;
  if (!params.bypassCooldownForTest && now - lastPairTime < 1500) {
    return {
      ok: true,
      duplicateIgnored: false,
      cooldownSuppressed: true,
      incidentId: params.incidentId,
      rewardGN: 0,
      hustleCoinsAwarded: 0,
      vehicleHealth: health,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  m49TrafficRuntime.processedIncidentIds.add(params.incidentId);
  m49TrafficRuntime.pairCooldowns[pairKey] = now;

  // 3. Determine player occupancy role — NEVER penalise an innocent passenger!
  const occ = getPlayerM48Occupancy(params.acc.accountId);
  const effectiveRole = (params.playerRoleOverride || occ.state || 'ON_FOOT').toUpperCase();
  const isInnocentPassenger = effectiveRole === 'PASSENGER';

  // 4. Calculate component damage based on impactSpeedKmh and incidentType
  const speed = Math.max(0, Math.min(140, params.impactSpeedKmh));
  const severity =
    params.incidentType === 'PEDESTRIAN_EMERGENCY_BRAKE'
      ? 0
      : params.incidentType === 'LOW_SPEED_BUMP' || params.incidentType === 'SCRAPE'
        ? Math.max(2, Math.round(speed * 0.18))
        : Math.max(5, Math.round(speed * 0.42));

  if (severity > 0) {
    health.components.body = Math.max(0, health.components.body - severity);
    health.components.lighting = Math.max(0, health.components.lighting - Math.round(severity * 0.85));
    health.components.steering = Math.max(
      0,
      health.components.steering -
        Math.round(severity * (params.incidentType === 'SIDE_IMPACT' ? 0.95 : 0.55))
    );
    health.components.tyres = Math.max(
      0,
      health.components.tyres -
        Math.round(severity * (params.incidentType === 'VEHICLE_BARRIER' ? 0.85 : 0.45))
    );
    health.components.engine = Math.max(
      0,
      health.components.engine -
        Math.round(severity * (params.incidentType === 'REAR_END' ? 0.45 : 0.75))
    );

    health.overallCondition = Math.round(
      (health.components.body +
        health.components.tyres +
        health.components.steering +
        health.components.engine +
        health.components.lighting) /
        5
    );

    // Degrade handling proportionally to component wear
    if (health.overallCondition <= 20 || health.components.engine <= 15) {
      health.operatingStatus = 'RECOVERY_REQUIRED';
      health.hazardLightsOn = true;
      health.handlingImpact = {
        topSpeedMultiplier: 0.0,
        accelerationMultiplier: 0.0,
        steeringDriftRad: 0.14,
        brakingEfficiency: 0.45,
      };
      if (params.vehicleId === 'veh_danfo_coop') {
        m49TrafficRuntime.danfoLifecycle.state = 'DISABLED';
        m49TrafficRuntime.danfoLifecycle.speedKmh = 0;
      }
    } else if (health.overallCondition < 75) {
      health.operatingStatus = 'DEGRADED';
      health.hazardLightsOn = health.overallCondition < 40;
      health.handlingImpact = {
        topSpeedMultiplier: Number(Math.max(0.35, health.components.engine / 100).toFixed(2)),
        accelerationMultiplier: Number(Math.max(0.35, (health.components.engine * 0.7 + health.components.tyres * 0.3) / 100).toFixed(2)),
        steeringDriftRad: Number(((100 - health.components.steering) * 0.0018).toFixed(4)),
        brakingEfficiency: Number(Math.max(0.45, health.components.tyres / 100).toFixed(2)),
      };
    }

    const totalPointsLost = 500 - (
      health.components.body +
      health.components.tyres +
      health.components.steering +
      health.components.engine +
      health.components.lighting
    );
    health.estimatedRepairCostGN = Math.max(0, Math.round(totalPointsLost * 4.5));
    health.lastIncidentTimestamp = now;
  }

  const incidentRecord = {
    incidentId: params.incidentId,
    vehicleId: params.vehicleId,
    otherEntityId: params.otherEntityId,
    incidentType: params.incidentType,
    impactSpeedKmh: speed,
    severity,
    effectiveRole,
    passengerProtectedFromPenalty: isInnocentPassenger,
    playerPenaltyGN: 0, // Repair is settled explicitly at workshop/tow, never auto-confiscated from innocent passengers
    rewardGN: 0, // Collisions NEVER award money
    hustleCoinsAwarded: 0,
    overallConditionAfter: health.overallCondition,
    operatingStatusAfter: health.operatingStatus,
    timestamp: now,
  };
  m49TrafficRuntime.incidentHistory.push(incidentRecord);

  return {
    ok: true,
    duplicateIgnored: false,
    cooldownSuppressed: false,
    incident: incidentRecord,
    passengerProtectedFromPenalty: isInnocentPassenger,
    rewardGN: 0,
    hustleCoinsAwarded: 0,
    vehicleHealth: health,
    gameNairaBalance: params.acc.gameNairaBalance,
  };
}

export function executeM49VehicleRecoveryOrRepair(params: {
  acc: M47AccountRecord;
  vehicleId: string;
  action: 'TOW_RECOVERY' | 'WORKSHOP_REPAIR';
  idempotencyKey: string;
}): any {
  ensureM49TrafficState();
  const health =
    m49TrafficRuntime.vehicleHealth[params.vehicleId] ||
    (m49TrafficRuntime.vehicleHealth[params.vehicleId] = createDefaultM49VehicleHealth(params.vehicleId));

  const existingTx = params.acc.ledgerEntries.find((e) => e.idempotencyKey === params.idempotencyKey);
  if (existingTx) {
    return {
      ok: true,
      idempotentReplay: true,
      action: params.action,
      vehicleHealth: health,
      ledgerEntry: existingTx,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  // NOTE: The former "sandbox top-up" (+5,000 GN whenever balance < 3,500) was removed: it silently minted
  // free Game Naira for every player and made balances appear to snap back to ~5,000.

  if (params.action === 'TOW_RECOVERY') {
    const towCostGN = 350;
    if (params.acc.gameNairaBalance < towCostGN) {
      return {
        ok: false,
        httpStatus: 402,
        error: 'INSUFFICIENT_FUNDS_FOR_TOW',
        requiredGN: towCostGN,
        gameNairaBalance: params.acc.gameNairaBalance,
      };
    }
    params.acc.gameNairaBalance -= towCostGN;
    health.components.body = Math.max(45, health.components.body);
    health.components.tyres = Math.max(55, health.components.tyres);
    health.components.steering = Math.max(55, health.components.steering);
    health.components.engine = Math.max(55, health.components.engine);
    health.components.lighting = Math.max(55, health.components.lighting);
    health.overallCondition = Math.round(
      (health.components.body +
        health.components.tyres +
        health.components.steering +
        health.components.engine +
        health.components.lighting) /
        5
    );
    health.operatingStatus = 'DEGRADED';
    health.hazardLightsOn = false;
    health.handlingImpact = {
      topSpeedMultiplier: 0.75,
      accelerationMultiplier: 0.75,
      steeringDriftRad: 0.02,
      brakingEfficiency: 0.8,
    };
    const totalPointsLost = 500 - (
      health.components.body +
      health.components.tyres +
      health.components.steering +
      health.components.engine +
      health.components.lighting
    );
    health.estimatedRepairCostGN = Math.max(250, Math.round(totalPointsLost * 4.5));
    if (params.vehicleId === 'veh_danfo_coop') {
      recordDanfoLifecycleTransition(
        'RETURNING_TO_DEPOT',
        'SERVICE_LANE',
        'CLOSED',
        -102.0,
        15.0,
        0,
        'Towed disabled vehicle to Segun Roadside Workshop / TBS Garage service bay.'
      );
    }

    const tx = {
      entryId: `tx_tow_${Date.now()}`,
      idempotencyKey: params.idempotencyKey,
      description: `Roadside Tow Recovery (${params.vehicleId}) to Segun Workshop Bay`,
      amountGN: -towCostGN,
      debitAccount: 'Expense:Transport:TowRecovery',
      creditAccount: 'Asset:Player:Cash',
      balanceAfterGN: params.acc.gameNairaBalance,
      timestamp: Date.now(),
    };
    params.acc.ledgerEntries.push(tx);
    saveStore();

    return {
      ok: true,
      action: 'TOW_RECOVERY',
      costPaidGN: towCostGN,
      recoveredToWorkshopBay: { x: -102.0, y: 0, z: 15.0, lane: 'SERVICE_LANE' },
      vehicleHealth: health,
      ledgerEntry: tx,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  // WORKSHOP_REPAIR: Full restoration to 100% across all 5 components
  const repairCostGN = Math.max(250, health.estimatedRepairCostGN || 450);
  if (params.acc.gameNairaBalance < repairCostGN) {
    return {
      ok: false,
      httpStatus: 402,
      error: 'INSUFFICIENT_FUNDS_FOR_REPAIR',
      requiredGN: repairCostGN,
      gameNairaBalance: params.acc.gameNairaBalance,
    };
  }

  params.acc.gameNairaBalance -= repairCostGN;
  health.components = {
    body: 100,
    tyres: 100,
    steering: 100,
    engine: 100,
    lighting: 100,
  };
  health.overallCondition = 100;
  health.operatingStatus = 'OPERATIONAL';
  health.hazardLightsOn = false;
  health.handlingImpact = {
    topSpeedMultiplier: 1.0,
    accelerationMultiplier: 1.0,
    steeringDriftRad: 0.0,
    brakingEfficiency: 1.0,
  };
  health.estimatedRepairCostGN = 0;

  if (params.vehicleId === 'veh_danfo_coop') {
    recordDanfoLifecycleTransition(
      'EN_ROUTE',
      'GENERAL_TRAFFIC_LEFT',
      'CLOSED',
      -98.0,
      15.0,
      35.0,
      'Completed full 5-component workshop overhaul; returned to commercial service.'
    );
  }

  const tx = {
    entryId: `tx_repair_${Date.now()}`,
    idempotencyKey: params.idempotencyKey,
    description: `Workshop 5-Subsystem Overhaul (${params.vehicleId}: Body, Tyres, Steering, Engine, Lighting)`,
    amountGN: -repairCostGN,
    debitAccount: 'Expense:Transport:WorkshopRepair',
    creditAccount: 'Asset:Player:Cash',
    balanceAfterGN: params.acc.gameNairaBalance,
    timestamp: Date.now(),
  };
  params.acc.ledgerEntries.push(tx);
  saveStore();

  return {
    ok: true,
    action: 'WORKSHOP_REPAIR',
    costPaidGN: repairCostGN,
    vehicleHealth: health,
    ledgerEntry: tx,
    gameNairaBalance: params.acc.gameNairaBalance,
  };
}



