const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../apps/game/index.html');
let content = fs.readFileSync(targetFile, 'utf8');

// Find start of constructLagosBuildingsAndLandmarks
const startIdx = content.indexOf('function constructLagosBuildingsAndLandmarks()');
if (startIdx === -1) {
  console.error('Could not find startIdx');
  process.exit(1);
}

// Find end of updateSimulation or setupInputListeners
const endIdx = content.indexOf('function onWindowResize()');
if (endIdx === -1) {
  console.error('Could not find endIdx');
  process.exit(1);
}

const replacementCode = `function constructLagosBuildingsAndLandmarks() {
      // LANDMARK 1: Tafawa Balewa Square (TBS) Arched Grandstand Monument
      buildTafawaBalewaSquare();

      // LANDMARK 2: CMS Multi-Modal Bus Terminal
      buildCMSBusTerminal();

      // LANDMARK 3: Marina Blue Line Elevated Rail & Train
      buildMarinaElevatedRail();

      // LANDMARK 4: Marina Waterfront Lagoon & Docks
      buildWaterfrontLagoon();

      // PROCEDURAL HIGH-RISES WITH AC UNITS & GEEPEE WATER TANKS
      buildAuthenticLagosBuildings();
    }

    function buildTafawaBalewaSquare() {
      const archMat = new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.75 });
      const tbsGroup = new THREE.Group();
      tbsGroup.position.set(-100, 0, 50);

      // Giant Arched Entry Gate Pillars spanning Broad Street Boulevard
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(6, 32, 6), archMat);
      pillarL.position.set(-18, 16, 0);
      pillarL.castShadow = true;
      tbsGroup.add(pillarL);

      const pillarR = pillarL.clone();
      pillarR.position.set(18, 16, 0);
      tbsGroup.add(pillarR);

      // Arched Crossbeam with Ceremonial Relief
      const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 8), archMat);
      crossbeam.position.set(0, 30, 0);
      crossbeam.castShadow = true;
      tbsGroup.add(crossbeam);

      // Sculpted National Horse Statuary Silhouettes atop the Gate
      const horseMat = new THREE.MeshStandardMaterial({ color: 0x05472A, roughness: 0.5 });
      const horse1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.5, 2.5), horseMat);
      horse1.position.set(-8, 35, 0);
      tbsGroup.add(horse1);
      const horse2 = horse1.clone();
      horse2.position.set(8, 35, 0);
      tbsGroup.add(horse2);

      // Grandstand Pavilion with Green Canopy
      const standRoof = new THREE.Mesh(
        new THREE.BoxGeometry(85, 2.5, 45),
        new THREE.MeshStandardMaterial({ color: 0x008751, roughness: 0.6 })
      );
      standRoof.position.set(0, 20, 35);
      standRoof.rotation.x = 0.18;
      tbsGroup.add(standRoof);

      // Nigerian National Flags (Green-White-Green)
      const flagMat = new THREE.MeshStandardMaterial({ color: 0x008751 });
      const flagWhiteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
      const flagL = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.1), flagMat);
      flagL.position.set(-18, 33, 0);
      tbsGroup.add(flagL);
      const flagR = flagL.clone();
      flagR.position.set(18, 33, 0);
      tbsGroup.add(flagR);

      scene.add(tbsGroup);
    }

    function buildCMSBusTerminal() {
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      const cmsGroup = new THREE.Group();

      // 3 Covered Passenger Boarding Bays (West side of Broad Street: x = -124 to -148)
      for (let i = 0; i < 3; i++) {
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 50), steelMat);
        canopy.position.set(-124 - (i * 12), 7.0, -200);
        canopy.castShadow = true;
        cmsGroup.add(canopy);

        // Columns
        for (let l = -20; l <= 20; l += 20) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7.0, 12), steelMat);
          col.position.set(-124 - (i * 12), 3.5, -200 + l);
          cmsGroup.add(col);
        }
      }

      // Terminal Signage: "CMS MULTI-MODAL BUS TERMINAL"
      const signMat = new THREE.MeshStandardMaterial({ color: 0x1E3A8A });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(22, 2.8, 0.8), signMat);
      sign.position.set(-124, 9.2, -175);
      cmsGroup.add(sign);

      scene.add(cmsGroup);
    }

    function buildMarinaElevatedRail() {
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.85 });
      const railMat = new THREE.MeshStandardMaterial({ color: 0x1E40AF, metalness: 0.5, roughness: 0.4 });

      // Concrete Pylons running parallel to Broad St at x = -155
      for (let z = -380; z <= 60; z += 40) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4.5, 14, 4.5), pierMat);
        pier.position.set(-155, 7.0, z);
        pier.castShadow = true;
        scene.add(pier);
      }

      // Rail Bridge Deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 480), railMat);
      deck.position.set(-155, 14.8, -160);
      deck.castShadow = true;
      scene.add(deck);

      // Blue Line Train Passenger Car atop track
      const trainMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, metalness: 0.7, roughness: 0.3 });
      const train = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.0, 48), trainMat);
      train.position.set(-155, 17.5, -190);
      train.castShadow = true;
      scene.add(train);
    }

    function buildWaterfrontLagoon() {
      // Concrete Sea Wall with Safety Railing
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const seaWall = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 520), wallMat);
      seaWall.position.set(-185, 1.75, -150);
      seaWall.receiveShadow = true;
      scene.add(seaWall);

      // Reflective Lagos Lagoon Water
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x082F49,
        roughness: 0.08,
        metalness: 0.88,
        transparent: true,
        opacity: 0.92
      });
      const lagoon = new THREE.Mesh(new THREE.PlaneGeometry(350, 520), waterMat);
      lagoon.rotation.x = -Math.PI / 2;
      lagoon.position.set(-365, 0.25, -150);
      scene.add(lagoon);

      // Wooden Jetty Pier
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9 });
      const jetty = new THREE.Mesh(new THREE.BoxGeometry(45, 1.2, 10), pierMat);
      jetty.position.set(-205, 1.4, -220);
      scene.add(jetty);
    }

    function buildAuthenticLagosBuildings() {
      const buildingsData = [
        { x: -55, z: -320, w: 28, d: 30, h: 72, color: 0x1E293B, isGlass: true, hasGeePee: true, hasAC: true, hasGenerator: true },
        { x: -55, z: -250, w: 26, d: 28, h: 48, color: 0xC4B5A5, isGlass: false, hasGeePee: true, hasAC: true, hasBalcony: true, hasShutters: true },
        { x: -55, z: -180, w: 28, d: 30, h: 64, color: 0x334155, isGlass: true, hasGeePee: true, hasAC: true, hasGenerator: true },
        { x: -55, z: -110, w: 26, d: 26, h: 42, color: 0xA39281, isGlass: false, hasGeePee: true, hasAC: true, hasBalcony: true, hasShutters: true },
        { x: -55, z: -40, w: 30, d: 28, h: 56, color: 0xD8D4C8, isGlass: false, hasGeePee: true, hasAC: true, hasGenerator: true },
        { x: -55, z: 25, w: 32, d: 30, h: 68, color: 0x1E293B, isGlass: true, hasGeePee: true, hasAC: true }
      ];

      buildingsData.forEach((bld) => {
        const bGroup = new THREE.Group();

        // Main Facade Geometry
        const mat = bld.isGlass
          ? new THREE.MeshStandardMaterial({ color: bld.color, metalness: 0.85, roughness: 0.2 })
          : new THREE.MeshStandardMaterial({ color: bld.color, roughness: 0.88 });

        const tower = new THREE.Mesh(new THREE.BoxGeometry(bld.w, bld.h, bld.d), mat);
        tower.position.set(bld.x, bld.h / 2, bld.z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        bGroup.add(tower);

        // FEATURE 1: ROOFTOP BLACK GEEPEE WATER STORAGE TANKS
        if (bld.hasGeePee) {
          const tankMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 16), tankMat);
          tank.position.set(bld.x - (bld.w / 4), bld.h + 2.2, bld.z - (bld.d / 4));
          bGroup.add(tank);

          // Steel support stand
          const stand = new THREE.Mesh(
            new THREE.BoxGeometry(3.6, 1.2, 3.6),
            new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 })
          );
          stand.position.set(bld.x - (bld.w / 4), bld.h + 0.6, bld.z - (bld.d / 4));
          bGroup.add(stand);
        }

        // FEATURE 2: EXTERNAL AIR CONDITIONER CONDENSERS (STREET FACING WEST WALL)
        if (bld.hasAC) {
          const acMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.5 });
          for (let floor = 6; floor < bld.h - 6; floor += 8) {
            const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.7), acMat);
            acUnit.position.set(bld.x - (bld.w / 2) - 0.4, floor, bld.z);
            bGroup.add(acUnit);
          }
        }

        // FEATURE 3: BALCONIES WITH METAL SECURITY GRILLES
        if (bld.hasBalcony) {
          const railMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7 });
          for (let floor = 8; floor < bld.h - 4; floor += 10) {
            const balcony = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 8), railMat);
            balcony.position.set(bld.x - (bld.w / 2) - 1.1, floor, bld.z);
            bGroup.add(balcony);
          }
        }

        // FEATURE 4: DIESEL GENERATOR ENCLOSURES WITH YELLOW HAZARD ACCENTS
        if (bld.hasGenerator) {
          const genMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.5, roughness: 0.6 });
          const gen = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.0, 3.2), genMat);
          gen.position.set(bld.x - (bld.w / 2) - 3.5, 1.5, bld.z + 10);
          bGroup.add(gen);

          // Yellow caution stripe
          const caution = new THREE.Mesh(
            new THREE.BoxGeometry(4.52, 0.5, 3.22),
            new THREE.MeshBasicMaterial({ color: 0xF4B41A })
          );
          caution.position.set(bld.x - (bld.w / 2) - 3.5, 1.5, bld.z + 10);
          bGroup.add(caution);
        }

        // FEATURE 5: COMMERCIAL SHUTTERS & STOREFRONT SIGNS
        if (bld.hasShutters) {
          const shutterMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.6, roughness: 0.5 });
          const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.8, 12), shutterMat);
          shutter.position.set(bld.x - (bld.w / 2) - 0.2, 1.9, bld.z);
          bGroup.add(shutter);
        }

        scene.add(bGroup);
      });
    }

    // =======================================================
    // 3. STREET FURNITURE, VENDORS & STREET LIGHTS
    // =======================================================
    function constructStreetFurnitureAndVendors() {
      // Street Lighting Poles with Projective Spotlights along Broad St kerbs
      for (let z = -380; z <= 60; z += 45) {
        createLagosStreetLight(-113, z);
        createLagosStreetLight(-87, z);
      }

      // Suya Night Stall with Smoking Charcoal Glow right on East Sidewalk near player
      createStreetVendor(-80, -212, 'suya');

      // Mama-Put Bukka with Canopy
      createStreetVendor(-80, -196, 'bukka');

      // Keke NAPEP Tricycle parked near terminal
      const keke = createHeroKekeTricycle();
      keke.position.set(-112, 0, -195);
      scene.add(keke);
    }

    function createLagosStreetLight(x, z) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 11, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
      );
      pole.position.set(x, 5.5, z);
      pole.castShadow = true;
      scene.add(pole);

      const lampHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.45, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xFFF1C5, emissive: 0xFFD700, emissiveIntensity: 0.85 })
      );
      lampHead.position.set(x > -100 ? x - 1.0 : x + 1.0, 10.8, z);
      scene.add(lampHead);

      // Night light source
      const spot = new THREE.SpotLight(0xFFE899, 1.2, 35, Math.PI / 4, 0.4);
      spot.position.set(lampHead.position.x, 10.5, z);
      spot.target.position.set(x > -100 ? x - 8 : x + 8, 0, z);
      scene.add(spot);
      scene.add(spot.target);
    }

    function createStreetVendor(x, z, type) {
      const vendorGroup = new THREE.Group();

      if (type === 'suya') {
        // Red Canopy Umbrella
        const umbrella = new THREE.Mesh(
          new THREE.ConeGeometry(2.4, 1.2, 8),
          new THREE.MeshStandardMaterial({ color: 0xDC2626 })
        );
        umbrella.position.set(x, 3.2, z);
        vendorGroup.add(umbrella);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        pole.position.set(x, 1.6, z);
        vendorGroup.add(pole);

        // Suya Charcoal Grill
        const grill = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 1.0, 1.0),
          new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.9 })
        );
        grill.position.set(x, 0.8, z);
        vendorGroup.add(grill);

        // Glowing Charcoal Embers
        const embers = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.1, 0.8),
          new THREE.MeshBasicMaterial({ color: 0xFF4500 })
        );
        embers.position.set(x, 1.35, z);
        vendorGroup.add(embers);

      } else if (type === 'bukka') {
        // Green & White Vendor Canopy
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(4.5, 0.2, 3.5),
          new THREE.MeshStandardMaterial({ color: 0x05472A })
        );
        canopy.position.set(x, 2.8, z);
        vendorGroup.add(canopy);

        // Wooden Table & Food Coolers
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(3.8, 0.9, 1.8),
          new THREE.MeshStandardMaterial({ color: 0x92400E })
        );
        table.position.set(x, 0.45, z);
        vendorGroup.add(table);

        // Large Aluminium Food Pots
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xD1D5DB, metalness: 0.8 }));
        pot.position.set(x, 1.2, z);
        vendorGroup.add(pot);
      }

      scene.add(vendorGroup);
    }

    // =======================================================
    // 4. HERO VEHICLES & REALISTIC NPC TRAFFIC
    // =======================================================
    function spawnVehiclesAndNPCs() {
      // 1. PLAYER HERO AVATAR (DETAILED NIGERIAN CITIZEN MESH)
      playerAvatar = createDetailedPlayerAvatar();
      playerAvatar.position.set(-83, 0, -208); // Sidewalk beside Broad St
      playerAvatar.rotation.y = 0; // Facing south towards TBS
      scene.add(playerAvatar);

      // 2. HERO COMPACT SEDAN: Adera Compact 1.6
      playerCar = createHeroAderaSedan();
      playerCar.position.set(-89, 0, -202); // Parked cleanly at kerb facing south
      playerCar.rotation.y = 0;
      scene.add(playerCar);

      // 3. HERO DANFO MINIBUS: Apex Danfo 14 (Lagos Yellow with Route Board & Conductor)
      heroDanfo = createHeroApexDanfo();
      heroDanfo.position.set(-106, 0, -210); // Waiting at CMS Bus Terminal
      heroDanfo.rotation.y = 0;
      scene.add(heroDanfo);

      // 4. HERO MOTORCYCLE: Koro 125
      heroOkada = createHeroKoroOkada();
      heroOkada.position.set(-80, 0, -198);
      heroOkada.rotation.y = 0;
      scene.add(heroOkada);

      // 5. NPC DYNAMIC TRAFFIC AGENTS
      spawnNPCTraffic();

      // 6. NPC PEDESTRIANS
      spawnNPCPedestrians();
    }

    // DETAILED 3D NIGERIAN PLAYER AVATAR
    function createDetailedPlayerAvatar() {
      const avatar = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8 });
      const tunicMat = new THREE.MeshStandardMaterial({ color: 0x008751, roughness: 0.65 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xF4B41A, metalness: 0.7, roughness: 0.3 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.7 });
      const shoeMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.4 });
      const capMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

      // Torso / Ankara Tunic
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), tunicMat);
      torso.position.y = 1.35;
      torso.castShadow = true;
      avatar.add(torso);

      // Gold Chest Embroidery Placket
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.44), goldMat);
      placket.position.set(0, 1.4, 0.01);
      avatar.add(placket);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), skinMat);
      head.position.y = 2.05;
      head.castShadow = true;
      avatar.add(head);

      // Lagos Fila / Peaked Cap
      const fila = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.22, 12), capMat);
      fila.position.set(0, 2.3, -0.02);
      fila.rotation.x = -0.1;
      avatar.add(fila);

      // Sunglasses / Visor
      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0x0F172A }));
      glasses.position.set(0, 2.08, 0.2);
      avatar.add(glasses);

      // Left & Right Arms
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), tunicMat);
      armL.position.set(-0.48, 1.35, 0);
      armL.castShadow = true;
      avatar.add(armL);

      const armR = armL.clone();
      armR.position.set(0.48, 1.35, 0);
      avatar.add(armR);

      // Hands
      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), skinMat);
      handL.position.set(-0.48, 0.85, 0);
      avatar.add(handL);

      const handR = handL.clone();
      handR.position.set(0.48, 0.85, 0);
      avatar.add(handR);

      // Gold Watch on Left Wrist
      const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8), goldMat);
      watch.position.set(-0.48, 0.95, 0);
      avatar.add(watch);

      // Legs / Trousers
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.28), pantsMat);
      legL.position.set(-0.18, 0.5, 0);
      legL.castShadow = true;
      avatar.add(legL);

      const legR = legL.clone();
      legR.position.set(0.18, 0.5, 0);
      avatar.add(legR);

      // Sneakers
      const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.48), shoeMat);
      shoeL.position.set(-0.18, 0.08, 0.08);
      shoeL.castShadow = true;
      avatar.add(shoeL);

      const shoeR = shoeL.clone();
      shoeR.position.set(0.18, 0.08, 0.08);
      avatar.add(shoeR);

      avatar.armL = armL;
      avatar.armR = armR;
      avatar.legL = legL;
      avatar.legR = legR;

      return avatar;
    }

    // HERO ASSET 1: Adera Compact 1.6 Sedan (Facing +Z)
    function createHeroAderaSedan() {
      const car = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, metalness: 0.85, roughness: 0.22 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.8 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.9, roughness: 0.1 });

      // Lower Chassis & Body
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.85, 4.5), bodyMat);
      chassis.position.y = 0.65;
      chassis.castShadow = true;
      car.add(chassis);

      // Aerodynamic Cabin with Windows
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.75, 2.4), glassMat);
      cabin.position.set(0, 1.4, 0.2);
      cabin.castShadow = true;
      car.add(cabin);

      // Adera Front Grille & Chrome Emblem (At +Z)
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.08), trimMat);
      grille.position.set(0, 0.65, 2.28);
      car.add(grille);

      // Detailed Headlights (Warm White Projectors at +Z)
      const headlightMat = new THREE.MeshBasicMaterial({ color: 0xFFFBEB });
      const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headlightMat);
      headL.position.set(-0.75, 0.7, 2.26);
      car.add(headL);
      const headR = headL.clone();
      headR.position.set(0.75, 0.7, 2.26);
      car.add(headR);

      // Forward Projective Light Cones
      const leftBeam = new THREE.SpotLight(0xFFFBEB, 1.5, 45, 0.45, 0.3);
      leftBeam.position.set(-0.75, 0.7, 2.2);
      leftBeam.target.position.set(-0.75, 0, 25);
      car.add(leftBeam);
      car.add(leftBeam.target);

      // Red Taillights (At -Z)
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xDC2626 });
      const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), tailMat);
      tailL.position.set(-0.75, 0.75, -2.26);
      car.add(tailL);
      const tailR = tailL.clone();
      tailR.position.set(0.75, 0.75, -2.26);
      car.add(tailR);

      // Side Mirrors
      const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.15), trimMat);
      mirrorL.position.set(-1.18, 1.25, 0.9);
      car.add(mirrorL);
      const mirrorR = mirrorL.clone();
      mirrorR.position.set(1.18, 1.25, 0.9);
      car.add(mirrorR);

      // Detailed Alloy Wheels with Rubber Tyres
      attachDetailedWheels(car, [
        [-1.02, 0.36, -1.35],
        [1.02, 0.36, -1.35],
        [-1.02, 0.36, 1.35],
        [1.02, 0.36, 1.35]
      ]);

      return car;
    }

    // HERO ASSET 2: Apex Danfo 14 (Iconic Yellow Minibus Facing +Z)
    function createHeroApexDanfo() {
      const danfo = new THREE.Group();
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xFDB813, roughness: 0.45 });
      const blackStripeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.15 });

      // Van Main Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.9, 5.3), yellowMat);
      body.position.y = 1.35;
      body.castShadow = true;
      danfo.add(body);

      // Dual Black Horizontal Stripes
      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 5.32), blackStripeMat);
      stripeL.position.set(-1.18, 1.15, 0);
      danfo.add(stripeL);
      const stripeR = stripeL.clone();
      stripeR.position.set(1.18, 1.15, 0);
      danfo.add(stripeR);

      // Large Windshield (At +Z)
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.1), glassMat);
      windshield.position.set(0, 1.6, 2.66);
      danfo.add(windshield);

      // Side Windows
      const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 3.8), glassMat);
      sideGlassL.position.set(-1.18, 1.6, -0.3);
      danfo.add(sideGlassL);
      const sideGlassR = sideGlassL.clone();
      sideGlassR.position.set(1.18, 1.6, -0.3);
      danfo.add(sideGlassR);

      // Iconic Danfo Route Board atop Windshield ("CMS - TBS - YABA")
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.45, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
      );
      board.position.set(0, 2.45, 2.5);
      danfo.add(board);

      // Conductor Character Figure hanging near sliding door on footboard
      const conductor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 1.3, 8),
        new THREE.MeshStandardMaterial({ color: 0xEA580C }) // Bright Orange Tee
      );
      conductor.position.set(1.25, 1.2, 0.8);
      conductor.rotation.z = 0.15;
      danfo.add(conductor);

      // Wheels
      attachDetailedWheels(danfo, [
        [-1.08, 0.38, -1.55],
        [1.08, 0.38, -1.55],
        [-1.08, 0.38, 1.55],
        [1.08, 0.38, 1.55]
      ]);

      return danfo;
    }

    // HERO ASSET 3: Koro 125 (Commuter Okada Motorcycle Facing +Z)
    function createHeroKoroOkada() {
      const bike = new THREE.Group();
      const redMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, metalness: 0.65, roughness: 0.3 });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.8 });

      // Fuel Tank & Frame
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.4, 0.9), redMat);
      tank.position.set(0, 1.0, 0.2);
      bike.add(tank);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 1.6), frameMat);
      frame.position.set(0, 0.65, 0);
      bike.add(frame);

      // Chrome Handlebars
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.15, 8),
        new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95 })
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 1.25, 0.65);
      bike.add(bar);

      // Headlight at +Z
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xFFFBEB }));
      lamp.position.set(0, 1.1, 0.85);
      bike.add(lamp);

      // 2 Spoke Wheels
      attachDetailedWheels(bike, [
        [0, 0.35, -0.8],
        [0, 0.35, 0.8]
      ]);

      return bike;
    }

    // HERO ASSET 4: Koro Keke 200 (Iconic Yellow Tricycle)
    function createHeroKekeTricycle() {
      const keke = new THREE.Group();
      const yellowMat = new THREE.MeshStandardMaterial({ color: 0xFDB813, roughness: 0.4 });
      const blackRoofMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.2), yellowMat);
      cab.position.y = 0.9;
      keke.add(cab);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.2, 2.25), blackRoofMat);
      roof.position.y = 1.6;
      keke.add(roof);

      return keke;
    }

    function attachDetailedWheels(vehicleGroup, offsets) {
      const tyreMat = new THREE.MeshStandardMaterial({ color: 0x11161B, roughness: 0.95 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.85, roughness: 0.2 });

      offsets.forEach(([x, y, z]) => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(x, y, z);

        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18), tyreMat);
        tyre.rotation.z = Math.PI / 2;
        tyre.castShadow = true;
        wheelGroup.add(tyre);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.29, 12), rimMat);
        rim.rotation.z = Math.PI / 2;
        wheelGroup.add(rim);

        vehicleGroup.add(wheelGroup);
      });
    }

    // Dynamic Traffic Simulation Loop
    function spawnNPCTraffic() {
      // 1. Moving Yellow Danfo in traffic queue
      const npcDanfo = createHeroApexDanfo();
      npcDanfo.position.set(-106, 0, -80);
      scene.add(npcDanfo);
      npcVehicles.push({ mesh: npcDanfo, speed: 28, laneX: -106, targetZ: 50, resetZ: -380 });

      // 2. Private SUV in outer lane
      const npcSUV = createHeroAderaSedan();
      npcSUV.position.set(-98, 0, -290);
      scene.add(npcSUV);
      npcVehicles.push({ mesh: npcSUV, speed: 45, laneX: -98, targetZ: 70, resetZ: -390 });

      // 3. Okada Courier weaving
      const npcOkada = createHeroKoroOkada();
      npcOkada.position.set(-94, 0, -150);
      scene.add(npcOkada);
      npcVehicles.push({ mesh: npcOkada, speed: 38, laneX: -94, targetZ: 60, resetZ: -370 });
    }

    function spawnNPCPedestrians() {
      const pedColors = [0xDC2626, 0x2563EB, 0xF59E0B, 0x05472A, 0x7C3AED];
      for (let i = 0; i < 14; i++) {
        const ped = new THREE.Group();
        const col = pedColors[i % pedColors.length];
        const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.4, 8), new THREE.MeshStandardMaterial({ color: col }));
        pBody.position.y = 0.9;
        ped.add(pBody);
        const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3E2723 }));
        pHead.position.y = 1.8;
        ped.add(pHead);

        const zPos = -320 + (i * 26);
        const xPos = i % 2 === 0 ? -116 : -84; // On sidewalks
        ped.position.set(xPos, 0, zPos);
        scene.add(ped);

        npcPedestrians.push({ mesh: ped, speed: 2.2 + (Math.random() * 1.5), dirZ: i % 2 === 0 ? 1 : -1 });
      }
    }

    function setupRainSystem() {
      const count = 5500;
      const rainGeo = new THREE.BufferGeometry();
      const pos = [];

      for (let i = 0; i < count; i++) {
        pos.push(
          Math.random() * 450 - 225,
          Math.random() * 90 + 2,
          Math.random() * 450 - 225
        );
      }

      rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const rainMat = new THREE.PointsMaterial({
        color: 0x93C5FD,
        size: 0.42,
        transparent: true,
        opacity: 0.7
      });

      rainSystem = new THREE.Points(rainGeo, rainMat);
      rainSystem.visible = false;
      scene.add(rainSystem);
    }

    // =======================================================
    // 5. VEHICLE DYNAMICS, CAMERA & WORLD TICK
    // =======================================================
    let currentSpeedKmh = 0;
    let steeringAngle = 0;
    let vehicleHeading = 0; // 0 points along +Z towards TBS

    function updateSimulation(dt) {
      // 1. Dynamic NPC Traffic Progression
      npcVehicles.forEach((veh) => {
        veh.mesh.position.z += (veh.speed / 3.6) * dt;
        if (veh.mesh.position.z > veh.targetZ) {
          veh.mesh.position.z = veh.resetZ;
        }
      });

      // 2. Pedestrian Sidewalk Ambience
      npcPedestrians.forEach((ped) => {
        ped.mesh.position.z += ped.speed * ped.dirZ * dt;
        if (ped.mesh.position.z > 80) ped.dirZ = -1;
        if (ped.mesh.position.z < -360) ped.dirZ = 1;
      });

      // 3. Tropical Raindrop Animation
      if (isRaining && rainSystem.visible) {
        const positions = rainSystem.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= 120 * dt;
          if (positions[i] < 0) positions[i] = 90;
        }
        rainSystem.geometry.attributes.position.needsUpdate = true;
      }

      // 4. Player Driving or Walking Mode
      if (isDriving && currentVehicle) {
        // DRIVING DYNAMICS
        const maxSpeed = isRaining ? 80 : 120; // Wet-road top speed limitation
        const accelRate = 44;
        const brakeRate = 70;
        const coastDrag = 14;

        if (keys.w) {
          currentSpeedKmh = Math.min(maxSpeed, currentSpeedKmh + accelRate * dt);
        } else if (keys.s) {
          if (currentSpeedKmh > 1) {
            currentSpeedKmh = Math.max(0, currentSpeedKmh - brakeRate * dt);
          } else {
            currentSpeedKmh = Math.max(-25, currentSpeedKmh - accelRate * 0.55 * dt);
          }
        } else {
          if (currentSpeedKmh > 0) currentSpeedKmh = Math.max(0, currentSpeedKmh - coastDrag * dt);
          if (currentSpeedKmh < 0) currentSpeedKmh = Math.min(0, currentSpeedKmh + coastDrag * dt);
        }

        if (keys.space) {
          currentSpeedKmh *= Math.pow(0.18, dt); // Handbrake clamp
        }

        // Speed-dependent steering sensitivity
        const steerSens = Math.max(0.65, 1.9 - (Math.abs(currentSpeedKmh) / 90));
        if (keys.a) steeringAngle = Math.max(-0.65, steeringAngle - steerSens * dt * 4);
        else if (keys.d) steeringAngle = Math.min(0.65, steeringAngle + steerSens * dt * 4);
        else steeringAngle *= Math.pow(0.04, dt);

        if (Math.abs(currentSpeedKmh) > 0.4) {
          const yaw = (currentSpeedKmh / 3.6 / 2.65) * Math.tan(steeringAngle) * dt;
          vehicleHeading += yaw;
          currentVehicle.rotation.y = vehicleHeading;

          // Realistic Body Roll into turns
          const roll = (currentSpeedKmh / 120) * -steeringAngle * 0.22;
          currentVehicle.rotation.z = roll;
        }

        // Integrate Position along +Z forward heading
        const forwardX = Math.sin(vehicleHeading);
        const forwardZ = Math.cos(vehicleHeading);
        const moveDist = (currentSpeedKmh / 3.6) * dt;
        currentVehicle.position.x += forwardX * moveDist;
        currentVehicle.position.z += forwardZ * moveDist;

        // Pothole collision response
        const distPothole1 = currentVehicle.position.distanceTo(new THREE.Vector3(-103, 0, -80));
        const distPothole2 = currentVehicle.position.distanceTo(new THREE.Vector3(-96, 0, -180));
        if ((distPothole1 < 2.5 || distPothole2 < 2.2) && Math.abs(currentSpeedKmh) > 15) {
          currentVehicle.position.y = Math.sin(Date.now() * 0.05) * 0.25;
          currentSpeedKmh *= 0.98; // bump slows car
        } else {
          currentVehicle.position.y = 0;
        }

        // Fuel Consumption
        if (Math.abs(currentSpeedKmh) > 5) {
          player.fuel = Math.max(0, player.fuel - 0.0035 * dt * 60);
          document.getElementById('fuel-text').innerText = \`\${Math.round(player.fuel)}%\`;
          document.getElementById('fuel-bar-fill').style.width = \`\${Math.round(player.fuel)}%\`;
        }

        // Sync Avatar inside car
        playerAvatar.position.copy(currentVehicle.position);
        playerAvatar.visible = false;

        // Dynamic Third-Person Driving Camera with Speed Follow & Look-Ahead
        if (cameraMode === 'chase') {
          const camDist = 8.0 + (Math.abs(currentSpeedKmh) / 25);
          const camHeight = 3.2 + (Math.abs(currentSpeedKmh) / 45);
          const targetCamX = currentVehicle.position.x - forwardX * camDist;
          const targetCamZ = currentVehicle.position.z - forwardZ * camDist;
          camera.position.x += (targetCamX - camera.position.x) * 0.16;
          camera.position.y += (currentVehicle.position.y + camHeight - camera.position.y) * 0.16;
          camera.position.z += (targetCamZ - camera.position.z) * 0.16;
          camera.lookAt(currentVehicle.position.x + forwardX * 6, currentVehicle.position.y + 1.2, currentVehicle.position.z + forwardZ * 6);
        } else if (cameraMode === 'hood') {
          camera.position.set(currentVehicle.position.x + forwardX * 1.4, currentVehicle.position.y + 1.4, currentVehicle.position.z + forwardZ * 1.4);
          camera.lookAt(currentVehicle.position.x + forwardX * 25, currentVehicle.position.y + 1.0, currentVehicle.position.z + forwardZ * 25);
        }

        // Audio RPM Modulation
        AudioEngine.updateEngineRPM(currentSpeedKmh, keys.w);

        // Update Tactical Gauges
        document.getElementById('speedometer-value').innerText = Math.round(Math.abs(currentSpeedKmh));
        let gear = 'N';
        if (currentSpeedKmh < -0.5) gear = 'R';
        else if (currentSpeedKmh < 1) gear = 'N';
        else if (currentSpeedKmh < 30) gear = '1';
        else if (currentSpeedKmh < 55) gear = '2';
        else if (currentSpeedKmh < 80) gear = '3';
        else if (currentSpeedKmh < 105) gear = '4';
        else gear = '5';
        document.getElementById('gear-indicator-box').innerText = gear;

        // Check Arrival at Tafawa Balewa Square Destination (Near z = 50)
        if (player.currentMission && player.currentMission.id === 'mis_cms_to_tbs') {
          if (currentVehicle.position.z >= 25 && currentVehicle.position.z <= 70) {
            concludeTripSuccess();
          }
        }

      } else {
        // WALKING MODE PHYSICS
        const walkSpeed = 7.5;
        let isMoving = false;

        if (keys.w) { playerAvatar.position.z += walkSpeed * dt; isMoving = true; }
        if (keys.s) { playerAvatar.position.z -= walkSpeed * dt; isMoving = true; }
        if (keys.a) { playerAvatar.position.x -= walkSpeed * dt; isMoving = true; }
        if (keys.d) { playerAvatar.position.x += walkSpeed * dt; isMoving = true; }

        if (isMoving && playerAvatar.armL) {
          const t = performance.now() * 0.008;
          playerAvatar.armL.rotation.x = Math.sin(t) * 0.45;
          playerAvatar.armR.rotation.x = -Math.sin(t) * 0.45;
          playerAvatar.legL.rotation.x = -Math.sin(t) * 0.45;
          playerAvatar.legR.rotation.x = Math.sin(t) * 0.45;
        }

        playerAvatar.visible = true;

        // Cinematic Over-the-Shoulder Camera framing avatar, Adera car, Danfo, and Broad St vista
        camera.position.set(playerAvatar.position.x + 0.8, playerAvatar.position.y + 2.4, playerAvatar.position.z - 4.8);
        camera.lookAt(playerAvatar.position.x - 0.6, playerAvatar.position.y + 1.2, playerAvatar.position.z + 6);

        // Vehicle Boarding Proximity Check
        const distSedan = playerAvatar.position.distanceTo(playerCar.position);
        const distDanfo = playerAvatar.position.distanceTo(heroDanfo.position);
        const distOkada = playerAvatar.position.distanceTo(heroOkada.position);

        const cue = document.getElementById('interaction-cue');
        if (distSedan < 4.5) {
          cue.style.display = 'block';
          cue.innerText = 'PRESS [E] TO DRIVE ADERA COMPACT 1.6';
        } else if (distDanfo < 5.5) {
          cue.style.display = 'block';
          cue.innerText = 'PRESS [E] TO BOARD APEX DANFO 14 (MINIBUS)';
        } else if (distOkada < 3.5) {
          cue.style.display = 'block';
          cue.innerText = 'PRESS [E] TO RIDE KORO 125 (OKADA)';
        } else {
          cue.style.display = 'none';
        }

        document.getElementById('speedometer-value').innerText = '0';
        document.getElementById('gear-indicator-box').innerText = 'P';
      }
    }

    // =======================================================
    // 6. USER INPUT & INTERACTIVE EVENT CONTROLS
    // =======================================================
    function setupInputListeners() {
      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'w' || e.key === 'ArrowUp') keys.w = true;
        if (k === 's' || e.key === 'ArrowDown') keys.s = true;
        if (k === 'a' || e.key === 'ArrowLeft') keys.a = true;
        if (k === 'd' || e.key === 'ArrowRight') keys.d = true;
        if (e.code === 'Space') { keys.space = true; e.preventDefault(); }

        // Enter/Exit Vehicle
        if (k === 'e') toggleVehicleMount();

        // EkoPhone OS Launcher
        if (k === 'p') toggleEkoPhone();

        // Weather Toggle
        if (k === 'r') toggleRainMode();

        // Day/Night Cycle
        if (k === 't') cycleTimeOfDay();

        // Horn
        if (k === 'h') AudioEngine.playHorn();

        // Camera Mode Toggle
        if (k === 'c') cycleCamera();
      });

      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
        if (k === 's' || e.key === 'ArrowDown') keys.s = false;
        if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
        if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
        if (e.code === 'Space') keys.space = false;
      });
    }

    function toggleVehicleMount() {
      if (isDriving) {
        // Disembark
        isDriving = false;
        playerAvatar.visible = true;
        playerAvatar.position.set(currentVehicle.position.x + 2.2, 0, currentVehicle.position.z);
        currentVehicle = null;
        document.getElementById('gauge-cluster').style.opacity = '0.35';
      } else {
        // Check which vehicle is closest
        const distSedan = playerAvatar.position.distanceTo(playerCar.position);
        const distDanfo = playerAvatar.position.distanceTo(heroDanfo.position);
        const distOkada = playerAvatar.position.distanceTo(heroOkada.position);

        if (distSedan < 4.8) {
          isDriving = true;
          currentVehicle = playerCar;
        } else if (distDanfo < 5.8) {
          isDriving = true;
          currentVehicle = heroDanfo;
        } else if (distOkada < 3.8) {
          isDriving = true;
          currentVehicle = heroOkada;
        }

        if (isDriving) {
          currentSpeedKmh = 0;
          vehicleHeading = currentVehicle.rotation.y;
          document.getElementById('gauge-cluster').style.opacity = '1.0';
          document.getElementById('interaction-cue').style.display = 'none';
          AudioEngine.playHorn();
        }
      }
    }

    function toggleRainMode() {
      isRaining = !isRaining;
      rainSystem.visible = isRaining;
      const vignette = document.getElementById('weather-vignette');

      if (isRaining) {
        vignette.classList.add('wet');
        scene.fog.density = 0.0065;
      } else {
        vignette.classList.remove('wet');
        scene.fog.density = 0.0028;
      }
    }

    function cycleTimeOfDay() {
      timeIndex = (timeIndex + 1) % timeBands.length;
      const band = timeBands[timeIndex];
      scene.background.setHex(band.sky);
      scene.fog.color.setHex(band.fog);
      sunLight.color.setHex(band.sunColor);
      sunLight.intensity = band.sunInt;
      ambientLight.intensity = band.ambientInt;
      document.getElementById('hud-time-display').innerText = band.name;
    }

    function cycleCamera() {
      cameraMode = cameraMode === 'chase' ? 'hood' : 'chase';
    }

    function toggleEkoPhone() {
      const phone = document.getElementById('eko-phone-container');
      phone.classList.toggle('active');
    }

    function triggerPhoneFeedback(msg) {
      alert(msg);
    }

    function startDispatchedMission(mId) {
      if (mId === 'mis_cms_to_tbs') {
        player.currentMission = {
          id: 'mis_cms_to_tbs',
          title: 'CMS to TBS Corporate Commute',
          destination: 'Tafawa Balewa Square Plaza',
          fare: 1250
        };

        const banner = document.getElementById('mission-hud-banner');
        banner.style.display = 'flex';
        document.getElementById('mission-headline').innerText = player.currentMission.title;
        document.getElementById('mission-guide').innerText = 'Destination: Tafawa Balewa Square Plaza (Follow Road)';

        toggleEkoPhone();
        AudioEngine.playHorn();
      }
    }

    function concludeTripSuccess() {
      const modal = document.getElementById('celebration-modal');
      modal.style.display = 'block';

      const fare = 1250;
      const fuel = 180;
      const tax = 100;
      const net = fare - fuel - tax;

      player.balance += net;
      document.getElementById('hud-gn-balance').innerText = \`₦\${player.balance.toLocaleString()} GN\`;

      document.getElementById('mission-hud-banner').style.display = 'none';
      player.currentMission = null;
    }

    function dismissCelebrationModal() {
      document.getElementById('celebration-modal').style.display = 'none';
    }

    `;

const newContent = content.substring(0, startIdx) + replacementCode + content.substring(endIdx);
fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Successfully updated apps/game/index.html! New length:', newContent.length);
