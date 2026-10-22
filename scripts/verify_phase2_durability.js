#!/usr/bin/env node
/** Isolated Phase 2 durability acceptance check for account and ledger snapshots. */
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eko-phase2-'));
let child;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startApi(port, allowSandboxGrants = false) {
  child = spawn(process.execPath, [path.join(root, 'services/api/dist/server.js')], {
    cwd: root,
    env: {
      ...process.env,
      PROJECT_EKO_DATA_DIR: tempDataDir,
      PROJECT_EKO_API_PORT: String(port),
      ...(allowSandboxGrants ? { PROJECT_EKO_ALLOW_SANDBOX_GRANTS: 'true' } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.failureOutput = () => output;
  return child;
}

async function waitForHealth(url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited before health check:\n${child.failureOutput()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}\n${child.failureOutput()}`);
}

async function request(baseUrl, route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers['X-Session-Token'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function stopApi() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('close', resolve));
  child = null;
}

async function main() {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  startApi(port);
  await waitForHealth(`${baseUrl}/health`);

  const created = await request(baseUrl, '/api/v1/auth/guest', { method: 'POST', body: {} });
  const secondCreated = await request(baseUrl, '/api/v1/auth/guest', { method: 'POST', body: {} });
  assert.strictEqual(created.status, 200);
  assert.strictEqual(secondCreated.status, 200);
  const accountId = created.body.account.accountId;
  const token = created.body.sessionToken;
  const secondAccountId = secondCreated.body.account.accountId;
  const secondToken = secondCreated.body.sessionToken;
  const before = await request(baseUrl, '/api/v1/journey/state', { token });
  assert.strictEqual(before.status, 200);

  const initialProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const initialProfileB = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  assert.strictEqual(initialProfileA.body.player.playerId, accountId, 'Legacy profile identity must use the authenticated account');
  assert.strictEqual(initialProfileB.body.player.playerId, secondAccountId, 'Second legacy profile must use its own account');
  assert.notStrictEqual(accountId, secondAccountId);
  const missingBusinessShiftId = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token, body: { idempotencyKey: 'phase2-business-shift-missing-id' },
  });
  assert.strictEqual(missingBusinessShiftId.status, 404,
    'Business shift must reject missing business IDs rather than defaulting');
  const missingBusinessShiftKey = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token, body: { bizId: 'biz_suya_haruna' },
  });
  assert.strictEqual(missingBusinessShiftKey.status, 400,
    'Business shift must require an idempotency key');
  const businessShiftA = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token,
    body: {
      bizId: 'biz_suya_haruna', grossRevenueGN: 999999999, operatingCostGN: 1,
      idempotencyKey: 'phase2-business-shift-shared-key',
    },
  });
  assert.strictEqual(businessShiftA.status, 200, 'Account A should operate its owned business');
  assert.strictEqual(businessShiftA.body.grossRevenueGN, 1200,
    'Business shift revenue must come from server-owned business data');
  assert.strictEqual(businessShiftA.body.operatingCostGN, 420,
    'Business shift cost must come from server policy');
  const updatedProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const unchangedProfileB = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  assert.strictEqual(updatedProfileA.body.player.gameNairaBalance, initialProfileA.body.player.gameNairaBalance + 780,
    'Legacy wallet mutation must update the authenticated account');
  assert.strictEqual(unchangedProfileB.body.player.gameNairaBalance, initialProfileB.body.player.gameNairaBalance,
    'Legacy wallet mutation must not change another account');
  const businessShiftReplayA = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token,
    body: { bizId: 'biz_suya_haruna', idempotencyKey: 'phase2-business-shift-shared-key' },
  });
  assert.strictEqual(businessShiftReplayA.status, 409, 'Business shift settlement must reject replay');
  const businessShiftB = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token: secondToken,
    body: { bizId: 'biz_suya_haruna', idempotencyKey: 'phase2-business-shift-shared-key' },
  });
  assert.strictEqual(businessShiftB.status, 200,
    'Business shift idempotency keys must be independent across accounts');
  const registryA = await request(baseUrl, '/api/v1/businesses/registry', { token });
  const registryB = await request(baseUrl, '/api/v1/businesses/registry', { token: secondToken });
  const collected = await request(baseUrl, '/api/v1/businesses/collect', { method: 'POST', token, body: {} });
  assert.strictEqual(collected.status, 200, 'Account A should collect its franchise earnings');
  const businessCollectReplay = await request(baseUrl, '/api/v1/businesses/collect', {
    method: 'POST', token, body: { allowRepeat: true },
  });
  assert.strictEqual(businessCollectReplay.status, 409, 'Client allowRepeat must not bypass business settlement guard');
  const profileAfterBusinessCollect = await request(baseUrl, '/api/v1/player/profile', { token });
  const registryAAfterCollect = await request(baseUrl, '/api/v1/businesses/registry', { token });
  const registryBAfterCollect = await request(baseUrl, '/api/v1/businesses/registry', { token: secondToken });
  assert.strictEqual(registryAAfterCollect.body.collectedThisShift, true, 'Collection flag must be stored for account A');
  assert.strictEqual(registryBAfterCollect.body.collectedThisShift, registryB.body.collectedThisShift,
    'Account A collection must not change account B collection flag');
  const suyaEarnings = (businesses) => businesses.find((business) => business.id === 'biz_suya_haruna').unclaimedEarningsGN;
  assert.strictEqual(suyaEarnings(registryAAfterCollect.body.businesses), 0, 'Collected business earnings should clear for account A');
  assert.strictEqual(suyaEarnings(registryBAfterCollect.body.businesses), suyaEarnings(registryB.body.businesses),
    'Business earnings for account B must remain unchanged');
  const inventoryA = await request(baseUrl, '/api/v1/businesses/inventory', { token });
  const inventoryB = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  const stockLevel = (inventory) => inventory.retailStalls.find((stall) => stall.businessId === 'biz_suya_haruna').stockLevel;
  const arbitraryPurchase = await request(baseUrl, '/api/v1/commerce/purchase', {
    method: 'POST', token, body: { itemType: 'unknown', priceGN: -999999 },
  });
  assert.strictEqual(arbitraryPurchase.status, 400, 'Clients must not create arbitrary negative-priced commerce items');
  const purchase = await request(baseUrl, '/api/v1/commerce/purchase', {
    method: 'POST', token, body: { itemType: 'suya', idempotencyKey: 'phase2-suya-purchase' },
  });
  assert.strictEqual(purchase.status, 200, 'Account A should purchase from its account-owned retail inventory');
  const duplicatePurchase = await request(baseUrl, '/api/v1/commerce/purchase', {
    method: 'POST', token, body: { itemType: 'suya', idempotencyKey: 'phase2-suya-purchase' },
  });
  assert.strictEqual(duplicatePurchase.status, 409, 'Duplicate commerce purchases must not spend or decrement inventory twice');
  const inventoryAAfterPurchase = await request(baseUrl, '/api/v1/businesses/inventory', { token });
  const inventoryBAfterPurchase = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  assert.strictEqual(stockLevel(inventoryAAfterPurchase.body), stockLevel(inventoryA.body) - 1,
    'Purchase must decrement account A retail stock');
  assert.strictEqual(stockLevel(inventoryBAfterPurchase.body), stockLevel(inventoryB.body),
    'Purchase must not decrement account B retail stock');
  const delivery = await request(baseUrl, '/api/v1/logistics/deliver', {
    method: 'POST', token, body: { freightFee: 999999 },
  });
  assert.strictEqual(delivery.status, 200);
  assert.strictEqual(delivery.body.freightPayoutGN, 1800, 'Freight payout must come from server cargo data, not the client claim');
  assert.strictEqual(delivery.body.deliveredCargo.status, 'DELIVERED');
  const duplicateDelivery = await request(baseUrl, '/api/v1/logistics/deliver', { method: 'POST', token, body: {} });
  assert.strictEqual(duplicateDelivery.status, 409, 'Delivered cargo must not pay out twice');
  const inventoryAAfterDelivery = await request(baseUrl, '/api/v1/businesses/inventory', { token });
  const inventoryBBeforeDelivery = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  assert.strictEqual(stockLevel(inventoryAAfterDelivery.body), 50, 'Delivery should restock account A business');
  assert.strictEqual(inventoryAAfterDelivery.body.activeCargo[0].status, 'DELIVERED');
  assert.strictEqual(stockLevel(inventoryBBeforeDelivery.body), stockLevel(inventoryB.body),
    'Delivery must not restock account B inventory');
  assert.strictEqual(inventoryBBeforeDelivery.body.activeCargo[0].status, inventoryB.body.activeCargo[0].status,
    'Delivery must not change account B cargo');
  const deliveryB = await request(baseUrl, '/api/v1/logistics/deliver', { method: 'POST', token: secondToken, body: {} });
  assert.strictEqual(deliveryB.status, 200, 'Account B should independently deliver its own cargo batch');
  const inventoryBAfterDelivery = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  const refuel = await request(baseUrl, '/api/v1/vehicle/refuel', {
    method: 'POST', token, body: { liters: 7.5, cost: 1 },
  });
  assert.strictEqual(refuel.status, 200, 'Authenticated account should be able to refuel its vehicle');
  assert.strictEqual(refuel.body.totalCostGN, 825, 'Refueling cost must come from the server price, not the client claim');
  const refueledProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const unaffectedVehicleB = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  assert.strictEqual(refueledProfileA.body.vehicleState.fuelLiters, 50, 'Refueling must update account A vehicle fuel');
  assert.strictEqual(unaffectedVehicleB.body.vehicleState.fuelLiters, initialProfileB.body.vehicleState.fuelLiters,
    'Refueling account A must not change account B vehicle fuel');
  const service = await request(baseUrl, '/api/v1/vehicle/service', {
    method: 'POST', token, body: { cost: 1, idempotencyKey: 'phase2-service-a' },
  });
  assert.strictEqual(service.status, 200, 'Authenticated account should be able to service its vehicle');
  assert.strictEqual(service.body.serviceCostGN, 800, 'Service cost must come from server condition pricing');
  const servicedProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const serviceReplay = await request(baseUrl, '/api/v1/vehicle/service', {
    method: 'POST', token, body: { cost: 1, idempotencyKey: 'phase2-service-a' },
  });
  assert.strictEqual(serviceReplay.status, 409, 'Vehicle service idempotency keys must reject replay');
  const serviceReplayProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const unaffectedAfterServiceB = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  assert.strictEqual(servicedProfileA.body.vehicleState.condition, 100, 'Service must restore account A vehicle condition');
  assert.deepStrictEqual(serviceReplayProfileA.body.vehicleState, servicedProfileA.body.vehicleState,
    'Rejected service replay must not mutate account A vehicle');
  assert.strictEqual(unaffectedAfterServiceB.body.vehicleState.condition, initialProfileB.body.vehicleState.condition,
    'Servicing account A must not change account B vehicle condition');
  const minigamePayoutA = await request(baseUrl, '/api/v1/minigames/complete', {
    method: 'POST', token,
    body: {
      miniGameType: 'skill_challenge', score: 100, grade: 'C',
      rewardGN: 999999999, reputationGain: 999999, idempotencyKey: 'phase2-minigame-a',
    },
  });
  assert.strictEqual(minigamePayoutA.status, 200, 'Valid minigame score should settle its server reward');
  assert.strictEqual(minigamePayoutA.body.grade, 'S', 'Minigame grade must derive from the validated score');
  assert.strictEqual(minigamePayoutA.body.bonusGN, 2500, 'Minigame reward must use the server grade table');
  const minigameReplayA = await request(baseUrl, '/api/v1/minigames/complete', {
    method: 'POST', token,
    body: { miniGameType: 'skill_challenge', score: 100, idempotencyKey: 'phase2-minigame-a' },
  });
  assert.strictEqual(minigameReplayA.status, 409, 'Minigame settlement keys must reject replay');
  const invalidMinigameScore = await request(baseUrl, '/api/v1/minigames/complete', {
    method: 'POST', token, body: { miniGameType: 'skill_challenge', score: 1000000 },
  });
  assert.strictEqual(invalidMinigameScore.status, 400, 'Minigame scores outside server bounds must be rejected');
  const minigamePayoutB = await request(baseUrl, '/api/v1/minigames/complete', {
    method: 'POST', token: secondToken,
    body: { miniGameType: 'skill_challenge', score: 100, idempotencyKey: 'phase2-minigame-a' },
  });
  assert.strictEqual(minigamePayoutB.status, 200,
    'Minigame idempotency keys must remain independent across accounts');
  const arbitraryArbitrage = await request(baseUrl, '/api/v1/market/bargain', {
    method: 'POST', token, body: { rapportBonusGN: 999999999 },
  });
  assert.strictEqual(arbitraryArbitrage.status, 400, 'Client-claimed arbitrage profits must be rejected');
  const bargainPurchase = await request(baseUrl, '/api/v1/market/bargain', {
    method: 'POST', token,
    body: { agreedPriceGN: 1, retailValueGN: 999999999, idempotencyKey: 'phase2-bargain-a' },
  });
  assert.strictEqual(bargainPurchase.status, 200, 'Canonical wholesale purchase should settle');
  assert.strictEqual(bargainPurchase.body.agreedPriceGN, 900,
    'Wholesale price must come from server data, not the client claim');
  assert.strictEqual(bargainPurchase.body.projectedMarginGN, 900,
    'Projected retail margin must come from server data');
  const bargainReplay = await request(baseUrl, '/api/v1/market/bargain', {
    method: 'POST', token,
    body: { idempotencyKey: 'phase2-bargain-a' },
  });
  assert.strictEqual(bargainReplay.status, 409, 'Wholesale purchase settlement keys must reject replay');
  const conductorCoopA = await request(baseUrl, '/api/v1/transit/conductor-coop', {
    method: 'POST', token,
    body: {
      routeId: 'route_cms_tbs_loop', grossRouteFaresGN: 999999999,
      disclosedCostGN: 1, idempotencyKey: 'phase2-conductor-coop-shared-key',
    },
  });
  assert.strictEqual(conductorCoopA.status, 200, 'Canonical conductor co-op route should settle');
  assert.strictEqual(conductorCoopA.body.grossRouteFaresGN, 1800,
    'Conductor co-op fares must come from server route data');
  assert.strictEqual(conductorCoopA.body.conductorShareGN, 640,
    'Conductor payout must derive from the server net pool');
  const conductorCoopReplay = await request(baseUrl, '/api/v1/transit/conductor-coop', {
    method: 'POST', token,
    body: { routeId: 'route_cms_tbs_loop', idempotencyKey: 'phase2-conductor-coop-shared-key' },
  });
  assert.strictEqual(conductorCoopReplay.status, 409, 'Conductor co-op settlement must reject replay');
  const conductorCoopB = await request(baseUrl, '/api/v1/transit/conductor-coop', {
    method: 'POST', token: secondToken,
    body: { routeId: 'route_cms_tbs_loop', idempotencyKey: 'phase2-conductor-coop-shared-key' },
  });
  assert.strictEqual(conductorCoopB.status, 200,
    'Conductor co-op idempotency keys must be independent across accounts');
  const pointsA = await request(baseUrl, '/api/v1/rewards/sandbox', { token });
  const pointsB = await request(baseUrl, '/api/v1/rewards/sandbox', { token: secondToken });
  const unknownReward = await request(baseUrl, '/api/v1/rewards/redeem', {
    method: 'POST', token, body: { rewardId: 'rw_unknown_reward', pointsCost: 1 },
  });
  assert.strictEqual(unknownReward.status, 404, 'Unknown sandbox rewards must be rejected');
  const redemption = await request(baseUrl, '/api/v1/rewards/redeem', {
    method: 'POST', token, body: { rewardId: 'rw_data_10gb', pointsCost: 1 },
  });
  assert.strictEqual(redemption.status, 200, 'Account A should redeem its sandbox points');
  assert.strictEqual(redemption.body.pointsDeducted, 1500,
    'Reward points cost must come from the server catalog, not client claims');
  const pointsAAfterRedeem = await request(baseUrl, '/api/v1/rewards/sandbox', { token });
  const pointsBAfterRedeem = await request(baseUrl, '/api/v1/rewards/sandbox', { token: secondToken });
  assert.strictEqual(pointsAAfterRedeem.body.pointsBalance, pointsA.body.pointsBalance - 1500,
    'Reward points redemption must debit account A');
  assert.strictEqual(pointsBAfterRedeem.body.pointsBalance, pointsB.body.pointsBalance,
    'Reward points redemption must not debit account B');

  const parcelsA = await request(baseUrl, '/api/v1/properties/parcels', { token });
  const parcelsB = await request(baseUrl, '/api/v1/properties/parcels', { token: secondToken });
  assert.strictEqual(parcelsA.status, 200);
  assert.strictEqual(parcelsB.status, 200);
  assert.notStrictEqual(parcelsA.body.parcels, parcelsB.body.parcels,
    'Property parcel snapshots must be resolved independently for each account');
  const deniedGrant = await request(baseUrl, '/api/v1/m3/reset', { method: 'POST', token, body: { grantGN: 1000000 } });
  assert.strictEqual(deniedGrant.status, 403, 'Client-requested sandbox grants must be disabled by default');

  const householdA = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const householdB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  const householdPurchase = await request(baseUrl, '/api/v1/ekolife/shop-purchase', {
    method: 'POST', token,
    body: { itemId: 'item_cleaning_broom_set', idempotencyKey: 'phase2-household-purchase-a' },
  });
  assert.strictEqual(householdPurchase.status, 200, 'Account A should make a household item purchase');
  const duplicateHouseholdPurchase = await request(baseUrl, '/api/v1/ekolife/shop-purchase', {
    method: 'POST', token,
    body: { itemId: 'item_cleaning_broom_set', idempotencyKey: 'phase2-household-purchase-a' },
  });
  assert.strictEqual(duplicateHouseholdPurchase.status, 409, 'Account A duplicate purchase must be rejected');
  const sameKeyOtherAccountPurchase = await request(baseUrl, '/api/v1/ekolife/shop-purchase', {
    method: 'POST', token: secondToken,
    body: { itemId: 'item_cleaning_broom_set', idempotencyKey: 'phase2-household-purchase-a' },
  });
  assert.strictEqual(sameKeyOtherAccountPurchase.status, 200,
    'An idempotency key used by another account must not block this account purchase');
  const householdAAfterPurchase = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const householdBAfterPurchase = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.strictEqual(householdAAfterPurchase.body.ownedItems.length, householdA.body.ownedItems.length + 1,
    'Household inventory mutation must persist for account A');
  assert.strictEqual(householdBAfterPurchase.body.ownedItems.length, householdB.body.ownedItems.length + 1,
    'Account B should retain only its own independently purchased item');
  const soldItemA = householdPurchase.body.ownedItem;
  const sellItemA = await request(baseUrl, '/api/v1/ekolife/item-lifecycle', {
    method: 'POST', token, body: { action: 'SELL', instanceId: soldItemA.ownedItemId },
  });
  assert.strictEqual(sellItemA.status, 200, 'Account A should sell its purchased household item');
  assert.ok(sellItemA.body.resaleGN > 0, 'Item resale amount must come from server item data');
  const sellReplayA = await request(baseUrl, '/api/v1/ekolife/item-lifecycle', {
    method: 'POST', token, body: { action: 'SELL', instanceId: soldItemA.ownedItemId },
  });
  assert.strictEqual(sellReplayA.status, 409, 'Sold household items must not be resold');
  const crossAccountSellA = await request(baseUrl, '/api/v1/ekolife/item-lifecycle', {
    method: 'POST', token: secondToken, body: { action: 'SELL', instanceId: soldItemA.ownedItemId },
  });
  assert.strictEqual(crossAccountSellA.status, 404, 'Another account cannot sell account A inventory');
  const householdAAfterLifecycle = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const foodChain = householdA.body.supplyChains.find((chain) => chain.chainId === 'chain_food');
  const missingSupplyChain = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token, body: { idempotencyKey: 'phase2-supply-chain-missing-id' },
  });
  assert.strictEqual(missingSupplyChain.status, 404, 'Missing supply-chain ID must not fall back to a payable default');
  const unknownSupplyChain = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token, body: { chainId: 'client_invented_chain', idempotencyKey: 'phase2-supply-chain-unknown' },
  });
  assert.strictEqual(unknownSupplyChain.status, 404, 'Unknown supply chains must not fall back to a payable default');
  const missingSupplyChainKey = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token, body: { chainId: foodChain.chainId },
  });
  assert.strictEqual(missingSupplyChainKey.status, 400, 'Supply-chain execution must require an idempotency key');
  const supplyChainA = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token,
    body: { chainId: foodChain.chainId, idempotencyKey: 'phase2-supply-chain-shared-key' },
  });
  assert.strictEqual(supplyChainA.status, 200, 'Account A should execute a canonical supply chain');
  assert.strictEqual(supplyChainA.body.grossSalesGN, foodChain.retailRevenueGN,
    'Supply-chain revenue must come from server chain data');
  assert.strictEqual(supplyChainA.body.totalCostGN, foodChain.wholesaleInputCostGN + foodChain.deliveryFeeGN,
    'Supply-chain cost must come from server wholesale + delivery fees');
  assert.strictEqual(supplyChainA.body.netProfitGN,
    foodChain.retailRevenueGN - (foodChain.wholesaleInputCostGN + foodChain.deliveryFeeGN),
    'Supply-chain net profit must equal server gross sales minus server cost');
  const supplyChainReplayA = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token,
    body: { chainId: foodChain.chainId, idempotencyKey: 'phase2-supply-chain-shared-key' },
  });
  assert.strictEqual(supplyChainReplayA.status, 409, 'Supply-chain settlements must reject same-account replay');
  const supplyChainB = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token: secondToken,
    body: { chainId: foodChain.chainId, idempotencyKey: 'phase2-supply-chain-shared-key' },
  });
  assert.strictEqual(supplyChainB.status, 200,
    'Supply-chain idempotency keys must remain independent across accounts');
  const inventoryAAfterSupplyChain = await request(baseUrl, '/api/v1/businesses/inventory', { token });
  const inventoryBAfterSupplyChain = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  const obligationsA = await request(baseUrl, '/api/v1/household/pay-obligations', {
    method: 'POST', token,
    body: { rentGN: 1, utilitiesGN: 1, idempotencyKey: 'phase2-household-obligation-a' },
  });
  assert.strictEqual(obligationsA.status, 200, 'Account A should settle its current household obligation cycle');
  assert.ok(obligationsA.body.receipt.totalObligationGN > 2,
    'Household obligations must use server lease prices, not client-supplied amounts');
  const obligationsReplayA = await request(baseUrl, '/api/v1/household/pay-obligations', {
    method: 'POST', token,
    body: { rentGN: 1, utilitiesGN: 1, idempotencyKey: 'phase2-household-obligation-a' },
  });
  assert.strictEqual(obligationsReplayA.status, 409, 'Household obligation settlement keys must reject replay');
  const obligationProfileA = await request(baseUrl, '/api/v1/player/profile', { token });

  const socialAction = await request(baseUrl, '/api/v1/social/action', {
    method: 'POST', token,
    body: { action: 'JOIN_CREW', crewId: 'crew_balogun_syndicate' },
  });
  assert.strictEqual(socialAction.status, 200);
  const socialStateA = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const socialStateB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  const crewJoinedA = socialStateA.body.socialAndSafetyState.crews.find((crew) => crew.crewId === 'crew_balogun_syndicate').joined;
  const crewJoinedB = socialStateB.body.socialAndSafetyState.crews.find((crew) => crew.crewId === 'crew_balogun_syndicate').joined;
  assert.strictEqual(crewJoinedA, true, 'Crew membership must be stored for account A');
  assert.strictEqual(crewJoinedB, false, 'Account A crew membership must not change account B');
  const streamed = await request(baseUrl, '/api/v1/districts/stream', {
    method: 'POST', token, body: { districtId: 'dist_yaba_mainland' },
  });
  assert.strictEqual(streamed.status, 200);
  const streamedStateA = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const streamedStateB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.strictEqual(streamedStateA.body.activeStreamedDistrictId, 'dist_yaba_mainland');
  assert.strictEqual(streamedStateB.body.activeStreamedDistrictId, 'dist_lagos_island',
    'Streaming a district for account A must not change account B world-session state');

  const hustleStateA = await request(baseUrl, '/api/v1/danfo-hustle/state', { token });
  const hustleStateB = await request(baseUrl, '/api/v1/danfo-hustle/state', { token: secondToken });
  const hustleRunPayload = {
    runId: 'phase2-shared-run-id', routeId: 'route_cms_rush', distanceM: 300, durationSec: 60,
    coinsCollected: 2, passengersCarried: 2, stopsCompleted: 1, stopsMissed: 0,
    collisions: 0, pedestrianHits: 0, fuelRemainingPct: 60, routeCompleted: true,
  };
  const hustleRunA = await request(baseUrl, '/api/v1/danfo-hustle/settle', {
    method: 'POST', token, body: hustleRunPayload,
  });
  assert.strictEqual(hustleRunA.status, 200, 'Account A Danfo Hustle run should settle');
  const hustleReplayA = await request(baseUrl, '/api/v1/danfo-hustle/settle', {
    method: 'POST', token, body: hustleRunPayload,
  });
  assert.strictEqual(hustleReplayA.body.idempotentReplay, true, 'Account A duplicate run should replay its stored result');
  const hustleRunB = await request(baseUrl, '/api/v1/danfo-hustle/settle', {
    method: 'POST', token: secondToken, body: hustleRunPayload,
  });
  assert.strictEqual(hustleRunB.status, 200, 'Account B should independently settle the same client run id');
  const hustleAfterA = await request(baseUrl, '/api/v1/danfo-hustle/state', { token });
  const hustleAfterB = await request(baseUrl, '/api/v1/danfo-hustle/state', { token: secondToken });
  assert.strictEqual(hustleAfterA.body.records.totalRunsCompleted, hustleStateA.body.records.totalRunsCompleted + 1,
    'Danfo Hustle records should update only for account A');
  assert.strictEqual(hustleAfterB.body.records.totalRunsCompleted, hustleStateB.body.records.totalRunsCompleted + 1,
    'Danfo Hustle records should update only for account B');
  const hustleUnlockA = await request(baseUrl, '/api/v1/danfo-hustle/unlock', {
    method: 'POST', token, body: { itemId: 'unlock_livery_eko_gold' },
  });
  assert.strictEqual(hustleUnlockA.status, 200, 'Account A should spend its own Hustle Coins on a livery unlock');
  const hustleAfterUnlockA = await request(baseUrl, '/api/v1/danfo-hustle/state', { token });
  const hustleUnlockStateB = await request(baseUrl, '/api/v1/danfo-hustle/state', { token: secondToken });
  assert.ok(!hustleUnlockStateB.body.unlockedItems.includes('unlock_livery_eko_gold'),
    'Account A livery unlock must not unlock the item for account B');

  const labourOffer = householdA.body.labourMarketOffers[0];
  const prematureLabourSettlement = await request(baseUrl, '/api/v1/labour/market', {
    method: 'POST', token,
    body: { action: 'COMPLETE_CONTRACT', offerId: labourOffer.offerId },
  });
  assert.strictEqual(prematureLabourSettlement.status, 409,
    'Labour settlement must require an accepted contract');
  const labourAccept = await request(baseUrl, '/api/v1/labour/market', {
    method: 'POST', token,
    body: { action: 'ACCEPT_CONTRACT', offerId: labourOffer.offerId },
  });
  assert.strictEqual(labourAccept.status, 200, 'Account A should accept an open NPC labour offer');
  const labourSettlement = await request(baseUrl, '/api/v1/labour/market', {
    method: 'POST', token,
    body: { action: 'COMPLETE_CONTRACT', offerId: labourOffer.offerId, payGN: 999999 },
  });
  assert.strictEqual(labourSettlement.status, 200, 'Accepted labour contract should settle');
  assert.strictEqual(labourSettlement.body.payGN, labourOffer.payGN,
    'Labour payout must use the server offer amount');
  const labourReplay = await request(baseUrl, '/api/v1/labour/market', {
    method: 'POST', token,
    body: { action: 'COMPLETE_CONTRACT', offerId: labourOffer.offerId },
  });
  assert.strictEqual(labourReplay.status, 409, 'Labour offer can only settle once');
  const labourStateB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.strictEqual(labourStateB.body.labourMarketOffers.find((offer) => offer.offerId === labourOffer.offerId).status,
    'OPEN', 'Account A labour acceptance and settlement must not mutate account B offers');

  const careerBBefore = householdBAfterPurchase.body.completedJobHistory.length;
  const acceptedJob = await request(baseUrl, '/api/v1/jobshub/accept', {
    method: 'POST', token, body: { jobId: 'job_foot_courier' },
  });
  assert.strictEqual(acceptedJob.status, 200, 'Account A should accept a career job');
  const incompleteJobSettlement = await request(baseUrl, '/api/v1/jobshub/complete', {
    method: 'POST', token,
    body: {
      jobId: 'job_foot_courier', jobInstanceId: acceptedJob.body.jobInstance.jobInstanceId,
      idempotencyKey: 'phase2-career-incomplete-a', evidence: { completedSteps: [], qualityScore: 1 },
    },
  });
  assert.strictEqual(incompleteJobSettlement.status, 400,
    'Career settlement must reject incomplete objective evidence');
  const outOfOrderJobSettlement = await request(baseUrl, '/api/v1/jobshub/complete', {
    method: 'POST', token,
    body: {
      jobId: 'job_foot_courier', jobInstanceId: acceptedJob.body.jobInstance.jobInstanceId,
      idempotencyKey: 'phase2-career-out-of-order-a',
      evidence: { completedSteps: [...acceptedJob.body.jobInstance.objectiveSteps].reverse(), qualityScore: 1 },
    },
  });
  assert.strictEqual(outOfOrderJobSettlement.status, 400,
    'Career settlement must reject out-of-order objective checkpoints');
  const jobSettlement = await request(baseUrl, '/api/v1/jobshub/complete', {
    method: 'POST', token,
    body: {
      jobId: 'job_foot_courier', jobInstanceId: acceptedJob.body.jobInstance.jobInstanceId,
      idempotencyKey: 'phase2-career-settlement-a',
      evidence: { completedSteps: acceptedJob.body.jobInstance.objectiveSteps, qualityScore: 1 },
    },
  });
  assert.strictEqual(jobSettlement.status, 200, 'Account A job should settle to its ledger account');
  const repeatedJobSettlement = await request(baseUrl, '/api/v1/jobshub/complete', {
    method: 'POST', token,
    body: {
      jobId: 'job_foot_courier', jobInstanceId: acceptedJob.body.jobInstance.jobInstanceId,
      idempotencyKey: 'phase2-career-settlement-a-second-key',
      evidence: { completedSteps: acceptedJob.body.jobInstance.objectiveSteps, qualityScore: 1 },
    },
  });
  assert.strictEqual(repeatedJobSettlement.status, 409,
    'A completed job instance must not be paid again with another idempotency key');
  const careerAAfterSettlement = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const careerBAfterSettlement = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.strictEqual(careerAAfterSettlement.body.completedJobHistory.length, 1,
    'Completed career history must be stored for account A');
  assert.strictEqual(careerBAfterSettlement.body.completedJobHistory.length, careerBBefore,
    'Account A career settlement must not alter account B history');
  await stopApi();
  startApi(port, true);
  await waitForHealth(`${baseUrl}/health`);
  for (const accountToken of [token, secondToken]) {
    const sandboxFunding = await request(baseUrl, '/api/v1/m3/reset', {
      method: 'POST', token: accountToken, body: { grantGN: 250000 },
    });
    assert.strictEqual(sandboxFunding.status, 200, 'Isolated test mode should fund fleet purchase coverage');
  }
  const creatorProjectId = householdA.body.creatorStudioCatalog[0].projectId;
  const creatorSubmissionA = await request(baseUrl, '/api/v1/creator/submit', {
    method: 'POST', token,
    body: { projectId: creatorProjectId, commissionGN: 999999, idempotencyKey: 'phase2-creator-shared-key' },
  });
  assert.strictEqual(creatorSubmissionA.status, 200, 'Account A should submit an available creator project');
  assert.strictEqual(creatorSubmissionA.body.commissionGN, 850,
    'Creator commission must come from the server project catalog');
  const creatorReplayA = await request(baseUrl, '/api/v1/creator/submit', {
    method: 'POST', token, body: { projectId: creatorProjectId, idempotencyKey: 'phase2-creator-shared-key' },
  });
  assert.strictEqual(creatorReplayA.status, 409, 'Creator project commission must settle only once per account');
  const creatorSubmissionB = await request(baseUrl, '/api/v1/creator/submit', {
    method: 'POST', token: secondToken,
    body: { projectId: creatorProjectId, idempotencyKey: 'phase2-creator-shared-key' },
  });
  assert.strictEqual(creatorSubmissionB.status, 200,
    'Creator submission settlement must be independent across accounts');
  const businessAcquisitionB = await request(baseUrl, '/api/v1/businesses/acquire', {
    method: 'POST', token: secondToken,
    body: { businessId: 'bukka', cost: 1, idempotencyKey: 'phase2-business-acquire-b' },
  });
  assert.strictEqual(businessAcquisitionB.status, 200, 'Account B should acquire an available business concession');
  assert.strictEqual(businessAcquisitionB.body.permitCostGN, 80000,
    'Business permit cost must come from the server registry');
  const businessAcquisitionReplayB = await request(baseUrl, '/api/v1/businesses/acquire', {
    method: 'POST', token: secondToken,
    body: { businessId: 'bukka', cost: 1, idempotencyKey: 'phase2-business-acquire-b' },
  });
  assert.strictEqual(businessAcquisitionReplayB.status, 409,
    'Business acquisition replay must be rejected');
  const parcelPurchase = await request(baseUrl, '/api/v1/properties/acquire', {
    method: 'POST', token,
    body: { parcelId: 'parcel_broad_st_corner_plot_04', idempotencyKey: 'phase2-atlas-ownership' },
  });
  assert.strictEqual(parcelPurchase.status, 200, 'Account A should acquire an eligible virtual parcel');
  const atlasA = await request(baseUrl, '/api/v1/atlas/registry', { token });
  const atlasB = await request(baseUrl, '/api/v1/atlas/registry', { token: secondToken });
  const atlasEntityA = atlasA.body.entities.find((entity) => entity.id === 'parcel_broad_st_corner_plot_04');
  const atlasEntityB = atlasB.body.entities.find((entity) => entity.id === 'parcel_broad_st_corner_plot_04');
  assert.strictEqual(atlasEntityA.ownershipState.ownerId, accountId,
    'Atlas should project account A property ownership');
  assert.notStrictEqual(atlasEntityB.ownershipState?.ownerId, accountId,
    'Atlas ownership projection must not leak account A parcel ownership to account B');
  const parcelDevelopment = await request(baseUrl, '/api/v1/properties/develop', {
    method: 'POST', token,
    body: {
      parcelId: 'parcel_broad_st_corner_plot_04',
      permittedUse: parcelPurchase.body.parcel.permittedUses[0],
      idempotencyKey: 'phase2-parcel-development',
    },
  });
  assert.strictEqual(parcelDevelopment.status, 200, 'Account A should develop its acquired parcel');
  const invalidPropertyAction = await request(baseUrl, '/api/v1/properties/maintain', {
    method: 'POST', token,
    body: { parcelId: 'parcel_broad_st_corner_plot_04', action: 'MINT_YIELD' },
  });
  assert.strictEqual(invalidPropertyAction.status, 400, 'Unknown property actions must not fall through to maintenance');
  const propertyMaintenance = await request(baseUrl, '/api/v1/properties/maintain', {
    method: 'POST', token,
    body: {
      parcelId: 'parcel_broad_st_corner_plot_04', action: 'MAINTAIN',
      idempotencyKey: 'phase2-property-maintenance-a',
    },
  });
  assert.strictEqual(propertyMaintenance.status, 200, 'Account A should pay maintenance on its parcel');
  const propertyMaintenanceReplay = await request(baseUrl, '/api/v1/properties/maintain', {
    method: 'POST', token,
    body: {
      parcelId: 'parcel_broad_st_corner_plot_04', action: 'MAINTAIN',
      idempotencyKey: 'phase2-property-maintenance-a',
    },
  });
  assert.strictEqual(propertyMaintenanceReplay.status, 409, 'Property maintenance settlements must reject replay');
  assert.strictEqual(propertyMaintenanceReplay.body.error, 'PROPERTY_MAINTENANCE_REPLAY_REJECTED');
  const propertyYield = await request(baseUrl, '/api/v1/properties/maintain', {
    method: 'POST', token, body: { parcelId: 'parcel_broad_st_corner_plot_04', action: 'COLLECT_YIELD' },
  });
  assert.strictEqual(propertyYield.status, 200, 'Developed parcel should pay its accrued yield once');
  assert.ok(propertyYield.body.collectedYieldGN > 0, 'Property yield must come from the accrued balance');
  const propertyYieldReplay = await request(baseUrl, '/api/v1/properties/maintain', {
    method: 'POST', token, body: { parcelId: 'parcel_broad_st_corner_plot_04', action: 'COLLECT_YIELD' },
  });
  assert.strictEqual(propertyYieldReplay.status, 409, 'Property yield must not be minted repeatedly after collection');
  const parcelsAAfterAcquisition = await request(baseUrl, '/api/v1/properties/parcels', { token });
  const mediaBeforeEvent = await request(baseUrl, '/api/v1/media/inventory', { token });
  const campaignBeforeEvent = mediaBeforeEvent.body.campaigns.find((campaign) => campaign.campaignId === 'camp_ekopay_zero_fee');
  const mediaEvent = await request(baseUrl, '/api/v1/media/event', {
    method: 'POST', token,
    body: { slotId: 'slot_bb_broad_east', campaignId: 'camp_ekopay_zero_fee', eventType: 'IMPRESSION' },
  });
  assert.strictEqual(mediaEvent.status, 200, 'Shared campaign delivery event should be recorded');
  const mediaAfterEvent = await request(baseUrl, '/api/v1/media/inventory', { token: secondToken });
  const campaignAfterEvent = mediaAfterEvent.body.campaigns.find((campaign) => campaign.campaignId === 'camp_ekopay_zero_fee');
  assert.strictEqual(campaignAfterEvent.deliveryMetrics.impressions, campaignBeforeEvent.deliveryMetrics.impressions + 1,
    'Campaign metrics must update as shared world state for all accounts');
  const vehiclePurchaseA = await request(baseUrl, '/api/v1/dealership/purchase', {
    method: 'POST', token,
    body: { modelId: 'koro_okada_125', idempotencyKey: 'phase2-vehicle-purchase' },
  });
  assert.strictEqual(vehiclePurchaseA.status, 200, 'Account A should be able to purchase an affordable fleet vehicle');
  const duplicateVehiclePurchase = await request(baseUrl, '/api/v1/dealership/purchase', {
    method: 'POST', token,
    body: { modelId: 'koro_okada_125', allowDuplicate: true, idempotencyKey: 'phase2-vehicle-purchase' },
  });
  assert.strictEqual(duplicateVehiclePurchase.status, 409, 'Duplicate fleet purchase settlement must be rejected');
  const vehiclePurchaseB = await request(baseUrl, '/api/v1/dealership/purchase', {
    method: 'POST', token: secondToken,
    body: { modelId: 'koro_okada_125', idempotencyKey: 'phase2-vehicle-purchase' },
  });
  assert.strictEqual(vehiclePurchaseB.status, 200, 'Account B must be able to use the same idempotency key independently');
  const garageA = await request(baseUrl, '/api/v1/dealership/inventory', { token });
  const garageB = await request(baseUrl, '/api/v1/dealership/inventory', { token: secondToken });
  assert.ok(garageA.body.ownedVehicleIds.includes('koro_okada_125'), 'Purchased vehicle must belong to account A');
  assert.ok(garageB.body.ownedVehicleIds.includes('koro_okada_125'), 'Account B vehicle ownership must be recorded independently');

  const fleetCollectA = await request(baseUrl, '/api/v1/fleet/collect', { method: 'POST', token, body: {} });
  assert.strictEqual(fleetCollectA.status, 200, 'Account A should collect its fleet settlement once');
  const repeatFleetCollectA = await request(baseUrl, '/api/v1/fleet/collect', {
    method: 'POST', token, body: { allowRepeat: true },
  });
  assert.strictEqual(repeatFleetCollectA.status, 409, 'Client allowRepeat must not bypass fleet settlement guard');
  const fleetCollectB = await request(baseUrl, '/api/v1/fleet/collect', { method: 'POST', token: secondToken, body: {} });
  assert.strictEqual(fleetCollectB.status, 200, 'Fleet collection state must remain independent per account');
  const fleetOverviewA = await request(baseUrl, '/api/v1/fleet/overview', { token });
  const fleetOverviewB = await request(baseUrl, '/api/v1/fleet/overview', { token: secondToken });
  assert.strictEqual(fleetOverviewA.body.fleet.collectedThisShift, true);
  assert.strictEqual(fleetOverviewB.body.fleet.collectedThisShift, true);

  const unknownFleetClass = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: { classId: 'veh_unknown_hovercraft', idempotencyKey: 'phase2-fleet-unknown' },
  });
  assert.strictEqual(unknownFleetClass.status, 404, 'Unknown vehicle classes must be rejected rather than defaulted');
  const missingFleetKey = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: { classId: 'veh_okada_moto' },
  });
  assert.strictEqual(missingFleetKey.status, 400, 'Fleet charter settlement must require an idempotency key');
  const incompleteFleetCheckpoints = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: {
      classId: 'veh_okada_moto',
      completedCheckpoints: ['checkpoint_1_terminal_departure', 'checkpoint_3_terminal_arrival'],
      idempotencyKey: 'phase2-fleet-incomplete-checkpoints',
    },
  });
  assert.strictEqual(incompleteFleetCheckpoints.status, 400,
    'Fleet charter settlement must reject incomplete or out-of-order route checkpoints');
  const fleetProfileBeforeA = await request(baseUrl, '/api/v1/player/profile', { token });
  const fleetRunA = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: { classId: 'veh_okada_moto', idempotencyKey: 'phase2-fleet-run' },
  });
  assert.strictEqual(fleetRunA.status, 200, 'Account A fleet run should settle');
  assert.strictEqual(fleetRunA.body.grossRunGN, 850, 'Okada gross run revenue must come from server class data');
  assert.strictEqual(fleetRunA.body.charterFeeGN, 100, 'Okada charter deposit must come from server class data');
  assert.strictEqual(fleetRunA.body.netProfitGN, 750, 'Okada net profit must equal gross minus charter deposit');
  assert.strictEqual(fleetRunA.body.newBalanceGN, fleetProfileBeforeA.body.player.gameNairaBalance + 750,
    'Fleet run must credit exact server net profit to account A');
  const fleetRunReplayA = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: { classId: 'veh_okada_moto', idempotencyKey: 'phase2-fleet-run' },
  });
  assert.strictEqual(fleetRunReplayA.status, 409, 'Fleet run replay must not credit the player twice');
  const fleetRunB = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token: secondToken,
    body: { classId: 'veh_okada_moto', idempotencyKey: 'phase2-fleet-run' },
  });
  assert.strictEqual(fleetRunB.status, 200, 'Another account can independently use the same fleet run key');

  const stopsBefore = await request(baseUrl, '/api/v1/transit/stops', { token });
  const cmsQueueBefore = stopsBefore.body.stops.find((stop) => stop.id === 'cms_terminal').waitingPassengers;
  const boarding = await request(baseUrl, '/api/v1/transit/board', {
    method: 'POST', token, body: { stopId: 'cms_terminal', passengerCount: 1, farePerPax: 999999, totalFareGN: 99999999 },
  });
  assert.strictEqual(boarding.status, 200);
  assert.strictEqual(boarding.body.totalFareGN, 200, 'Transit fares must come from the server rate, not client overrides');
  const stopsAfterBoard = await request(baseUrl, '/api/v1/transit/stops', { token: secondToken });
  const cmsQueueAfter = stopsAfterBoard.body.stops.find((stop) => stop.id === 'cms_terminal').waitingPassengers;
  assert.strictEqual(cmsQueueAfter, cmsQueueBefore - 1,
    'Transit queue is shared world state and must update consistently for all accounts');
  const profileABeforeRestart = await request(baseUrl, '/api/v1/player/profile', { token });
  const profileBBeforeRestart = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  await stopApi();

  startApi(port);
  await waitForHealth(`${baseUrl}/health`);
  const after = await request(baseUrl, '/api/v1/journey/state', { token });
  assert.strictEqual(after.status, 200, 'Previously issued session must survive API restart');
  assert.strictEqual(after.body.account.accountId, accountId, 'Account identity must survive API restart');
  assert.strictEqual(after.body.account.username, created.body.account.username, 'Account profile must survive API restart');
  const restartedProfileA = await request(baseUrl, '/api/v1/player/profile', { token });
  const restartedProfileB = await request(baseUrl, '/api/v1/player/profile', { token: secondToken });
  assert.strictEqual(restartedProfileA.body.player.gameNairaBalance, profileABeforeRestart.body.player.gameNairaBalance,
    'Legacy wallet must survive API restart');
  assert.strictEqual(restartedProfileB.body.player.gameNairaBalance, profileBBeforeRestart.body.player.gameNairaBalance,
    'Other account wallet must remain isolated after restart');
  assert.strictEqual(restartedProfileA.body.vehicleState.fuelLiters, refueledProfileA.body.vehicleState.fuelLiters,
    'Vehicle fuel must survive API restart');
  assert.strictEqual(restartedProfileB.body.vehicleState.fuelLiters, unaffectedVehicleB.body.vehicleState.fuelLiters,
    'Other account vehicle fuel must remain isolated after restart');
  assert.strictEqual(restartedProfileA.body.vehicleState.condition, servicedProfileA.body.vehicleState.condition,
    'Vehicle condition must survive API restart');
  assert.strictEqual(restartedProfileB.body.vehicleState.condition, initialProfileB.body.vehicleState.condition,
    'Other account vehicle condition must remain isolated after restart');
  const serviceReplayAfterRestart = await request(baseUrl, '/api/v1/vehicle/service', {
    method: 'POST', token, body: { cost: 1, idempotencyKey: 'phase2-service-a' },
  });
  assert.strictEqual(serviceReplayAfterRestart.status, 409,
    'Vehicle service idempotency records must survive API restart');
  const profileAfterServiceReplayRestart = await request(baseUrl, '/api/v1/player/profile', { token });
  assert.strictEqual(profileAfterServiceReplayRestart.body.player.gameNairaBalance,
    restartedProfileA.body.player.gameNairaBalance,
    'Rejected post-restart service replay must not debit the wallet');
  const restartedGarageA = await request(baseUrl, '/api/v1/dealership/inventory', { token });
  const restartedGarageB = await request(baseUrl, '/api/v1/dealership/inventory', { token: secondToken });
  assert.deepStrictEqual(restartedGarageA.body.ownedVehicleIds, garageA.body.ownedVehicleIds,
    'Account A vehicle ownership must survive API restart');
  assert.deepStrictEqual(restartedGarageB.body.ownedVehicleIds, garageB.body.ownedVehicleIds,
    'Account B vehicle ownership must survive API restart independently');
  const restartedRegistryA = await request(baseUrl, '/api/v1/businesses/registry', { token });
  const restartedRegistryB = await request(baseUrl, '/api/v1/businesses/registry', { token: secondToken });
  assert.strictEqual(restartedRegistryB.body.businesses.find((business) => business.id === 'biz_bukka_nkechi').owned, true,
    'Business concession ownership must survive API restart');
  assert.strictEqual(restartedRegistryA.body.businesses.find((business) => business.id === 'biz_bukka_nkechi').owned, false,
    'Account B business ownership must remain isolated after restart');
  assert.strictEqual(restartedRegistryA.body.collectedThisShift, true, 'Business collection flag must survive API restart');
  assert.strictEqual(restartedRegistryB.body.collectedThisShift, registryBAfterCollect.body.collectedThisShift,
    'Other account business state must remain isolated after restart');
  assert.strictEqual(suyaEarnings(restartedRegistryA.body.businesses), 0, 'Collected earnings must remain cleared after restart');
  assert.strictEqual(suyaEarnings(restartedRegistryB.body.businesses), suyaEarnings(registryBAfterCollect.body.businesses),
    'Other account business earnings must survive restart unchanged');
  const profileBeforeBusinessReplayRestart = await request(baseUrl, '/api/v1/player/profile', { token });
  const businessCollectReplayAfterRestart = await request(baseUrl, '/api/v1/businesses/collect', {
    method: 'POST', token, body: { allowRepeat: true },
  });
  assert.strictEqual(businessCollectReplayAfterRestart.status, 409,
    'Business settlement replay protection must survive API restart');
  const profileAfterBusinessReplayRestart = await request(baseUrl, '/api/v1/player/profile', { token });
  assert.strictEqual(profileAfterBusinessReplayRestart.body.player.gameNairaBalance,
    profileBeforeBusinessReplayRestart.body.player.gameNairaBalance,
    'Rejected post-restart business replay must not debit or credit the wallet');
  const restartedFleetA = await request(baseUrl, '/api/v1/fleet/overview', { token });
  const restartedFleetB = await request(baseUrl, '/api/v1/fleet/overview', { token: secondToken });
  assert.strictEqual(restartedFleetA.body.fleet.collectedThisShift, true, 'Account A fleet collection must survive restart');
  assert.strictEqual(restartedFleetB.body.fleet.collectedThisShift, true, 'Account B fleet collection must survive restart');
  const fleetRunReplayAfterRestart = await request(baseUrl, '/api/v1/fleet/dispatch-or-charter', {
    method: 'POST', token,
    body: { classId: 'veh_okada_moto', idempotencyKey: 'phase2-fleet-run' },
  });
  assert.strictEqual(fleetRunReplayAfterRestart.status, 409,
    'Fleet charter idempotency records must survive API restart');
  const supplyChainReplayAfterRestart = await request(baseUrl, '/api/v1/supply-chain/execute', {
    method: 'POST', token,
    body: { chainId: foodChain.chainId, idempotencyKey: 'phase2-supply-chain-shared-key' },
  });
  assert.strictEqual(supplyChainReplayAfterRestart.status, 409,
    'Supply-chain idempotency records must survive API restart');
  const businessShiftReplayAfterRestart = await request(baseUrl, '/api/v1/business/operate-shift', {
    method: 'POST', token,
    body: { bizId: 'biz_suya_haruna', idempotencyKey: 'phase2-business-shift-shared-key' },
  });
  assert.strictEqual(businessShiftReplayAfterRestart.status, 409,
    'Business shift idempotency records must survive API restart');
  const restartedMedia = await request(baseUrl, '/api/v1/media/inventory', { token: secondToken });
  assert.deepStrictEqual(restartedMedia.body.campaigns.find((campaign) => campaign.campaignId === 'camp_ekopay_zero_fee').deliveryMetrics,
    campaignAfterEvent.deliveryMetrics, 'Shared campaign metrics must survive API restart');
  const restartedInventoryA = await request(baseUrl, '/api/v1/businesses/inventory', { token });
  const restartedInventoryB = await request(baseUrl, '/api/v1/businesses/inventory', { token: secondToken });
  assert.strictEqual(stockLevel(restartedInventoryA.body), stockLevel(inventoryAAfterSupplyChain.body),
    'Account A inventory must survive API restart');
  assert.strictEqual(restartedInventoryA.body.activeCargo[0].status, 'DELIVERED', 'Delivered cargo status must survive restart');
  assert.strictEqual(stockLevel(restartedInventoryB.body), stockLevel(inventoryBAfterSupplyChain.body),
    'Account B inventory must survive API restart unchanged');
  assert.strictEqual(restartedInventoryB.body.activeCargo[0].status, inventoryBAfterSupplyChain.body.activeCargo[0].status,
    'Account B cargo status must survive API restart unchanged');
  const restartedPointsA = await request(baseUrl, '/api/v1/rewards/sandbox', { token });
  const restartedPointsB = await request(baseUrl, '/api/v1/rewards/sandbox', { token: secondToken });
  assert.strictEqual(restartedPointsA.body.pointsBalance, pointsAAfterRedeem.body.pointsBalance,
    'Account A reward points must survive restart');
  assert.strictEqual(restartedPointsB.body.pointsBalance, pointsBAfterRedeem.body.pointsBalance,
    'Account B reward points must remain isolated after restart');
  const restartedParcelsA = await request(baseUrl, '/api/v1/properties/parcels', { token });
  const restartedParcelsB = await request(baseUrl, '/api/v1/properties/parcels', { token: secondToken });
  assert.deepStrictEqual(restartedParcelsA.body.parcels, parcelsAAfterAcquisition.body.parcels,
    'Account A parcel snapshot must survive API restart');
  assert.deepStrictEqual(restartedParcelsB.body.parcels, parcelsB.body.parcels,
    'Account B parcel snapshot must survive API restart independently');
  const restartedHouseholdA = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const restartedHouseholdB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.deepStrictEqual(restartedHouseholdA.body.ownedItems, householdAAfterLifecycle.body.ownedItems,
    'Account A household inventory must survive API restart');
  assert.deepStrictEqual(restartedHouseholdB.body.ownedItems, householdBAfterPurchase.body.ownedItems,
    'Account B household inventory must survive API restart independently');
  assert.deepStrictEqual(restartedHouseholdA.body.completedJobHistory, careerAAfterSettlement.body.completedJobHistory,
    'Account A career history must survive API restart');
  assert.deepStrictEqual(restartedHouseholdB.body.completedJobHistory, careerBAfterSettlement.body.completedJobHistory,
    'Account B career history must survive API restart independently');
  assert.strictEqual(restartedHouseholdA.body.creatorStudioCatalog.find((project) => project.projectId === creatorProjectId).submissionsCount, 1,
    'Account A creator submission count must survive restart');
  assert.strictEqual(restartedHouseholdB.body.creatorStudioCatalog.find((project) => project.projectId === creatorProjectId).submissionsCount, 1,
    'Account B creator submission count must persist independently');
  assert.strictEqual(restartedHouseholdA.body.labourMarketOffers.find((offer) => offer.offerId === labourOffer.offerId).status,
    'SETTLED_AND_RATED', 'Labour contract settlement must survive API restart');
  const obligationProfileBeforeRestartReplay = await request(baseUrl, '/api/v1/player/profile', { token });
  const obligationReplayAfterRestart = await request(baseUrl, '/api/v1/household/pay-obligations', {
    method: 'POST', token,
    body: { rentGN: 1, utilitiesGN: 1, idempotencyKey: 'phase2-household-obligation-a' },
  });
  assert.strictEqual(obligationReplayAfterRestart.status, 409,
    'Household obligation replay protection must survive API restart');
  const obligationProfileAfterRestartReplay = await request(baseUrl, '/api/v1/player/profile', { token });
  assert.strictEqual(obligationProfileAfterRestartReplay.body.player.gameNairaBalance,
    obligationProfileBeforeRestartReplay.body.player.gameNairaBalance,
    'Rejected post-restart household obligation replay must not change the wallet');
  const restartedSocialA = await request(baseUrl, '/api/v1/ekolife/state', { token });
  const restartedSocialB = await request(baseUrl, '/api/v1/ekolife/state', { token: secondToken });
  assert.strictEqual(restartedSocialA.body.activeStreamedDistrictId, 'dist_yaba_mainland',
    'Account A active district must survive API restart');
  assert.strictEqual(restartedSocialB.body.activeStreamedDistrictId, 'dist_lagos_island',
    'Account B active district must survive API restart independently');
  assert.strictEqual(restartedSocialA.body.socialAndSafetyState.crews.find((crew) => crew.crewId === 'crew_balogun_syndicate').joined, true,
    'Account A social preferences must survive API restart');
  assert.strictEqual(restartedSocialB.body.socialAndSafetyState.crews.find((crew) => crew.crewId === 'crew_balogun_syndicate').joined, false,
    'Account B social preferences must remain independent after restart');
  const restartedHustleA = await request(baseUrl, '/api/v1/danfo-hustle/state', { token });
  const restartedHustleB = await request(baseUrl, '/api/v1/danfo-hustle/state', { token: secondToken });
  assert.deepStrictEqual(restartedHustleA.body.records, hustleAfterA.body.records,
    'Account A Danfo Hustle records must survive restart');
  assert.deepStrictEqual(restartedHustleB.body.records, hustleAfterB.body.records,
    'Account B Danfo Hustle records must survive restart independently');
  assert.strictEqual(restartedHustleA.body.hustleCoinsBalance, hustleAfterUnlockA.body.hustleCoinsBalance,
    'Account A Danfo Hustle balance must survive restart');
  assert.strictEqual(restartedHustleB.body.hustleCoinsBalance, hustleAfterB.body.hustleCoinsBalance,
    'Account B Danfo Hustle balance must survive restart independently');
  const duplicateAfterRestart = await request(baseUrl, '/api/v1/ekolife/shop-purchase', {
    method: 'POST', token,
    body: { itemId: 'item_cleaning_broom_set', idempotencyKey: 'phase2-household-purchase-a' },
  });
  assert.strictEqual(duplicateAfterRestart.status, 409,
    'Household purchase idempotency records must survive API restart');
  const restartedStops = await request(baseUrl, '/api/v1/transit/stops', { token: secondToken });
  assert.strictEqual(restartedStops.body.stops.find((stop) => stop.id === 'cms_terminal').waitingPassengers, cmsQueueAfter,
    'Shared transit queues must survive API restart');

  const accountStorePath = path.join(tempDataDir, 'm4_7_persistent_store.json');
  const accountStore = JSON.parse(fs.readFileSync(accountStorePath, 'utf8'));
  assert.strictEqual(accountStore.schemaVersion, 1);
  assert.ok(accountStore.accounts[accountId], 'Account snapshot must be present on disk');
  assert.strictEqual(accountStore.accounts[accountId].legacyPropertyParcels.length, parcelsA.body.parcels.length,
    'Account A property state must be stored in its account record');
  assert.strictEqual(accountStore.accounts[secondAccountId].legacyPropertyParcels.length, parcelsB.body.parcels.length,
    'Account B property state must be stored in its own account record');
  assert.strictEqual(fs.statSync(accountStorePath).mode & 0o077, 0, 'Account snapshot must not be readable by other users');
  assert.ok(fs.existsSync(path.join(tempDataDir, 'economy_ledger.json')), 'Economy journal must be persisted');

  const worldStorePath = path.join(tempDataDir, 'legacy_world_state.json');
  const validWorldSnapshot = fs.readFileSync(worldStorePath, 'utf8');
  assert.strictEqual(JSON.parse(validWorldSnapshot).schemaVersion, 2,
    'Shared world snapshot must use the current schema including commerce state');
  await stopApi();
  fs.writeFileSync(worldStorePath, '{broken json', { encoding: 'utf8', mode: 0o600 });
  startApi(port);
  await assert.rejects(
    waitForHealth(`${baseUrl}/health`),
    /API exited before health check/,
    'Corrupt shared world snapshots must prevent startup'
  );
  await stopApi();
  fs.writeFileSync(worldStorePath, validWorldSnapshot, { encoding: 'utf8', mode: 0o600 });
  startApi(port);
  await waitForHealth(`${baseUrl}/health`);

  await stopApi();
  fs.writeFileSync(accountStorePath, '{broken json', { encoding: 'utf8', mode: 0o600 });
  startApi(port);
  await assert.rejects(
    waitForHealth(`${baseUrl}/health`),
    /API exited before health check/,
    'Corrupt account snapshots must prevent startup rather than resetting accounts'
  );
  console.log('Phase 2 acceptance passed: account wallets, vehicles, businesses, supply, rewards, household, career, arcade and property state are isolated and restart-durable; transit and commerce persist as shared world state; cargo payouts use server data.');
}

main().catch((error) => {
  console.error(error);
  if (child && child.failureOutput) console.error(child.failureOutput());
  process.exitCode = 1;
}).finally(async () => {
  await stopApi();
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});
