document
  .getElementById("buildOrderInput")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the default behavior of adding a new line

      const textarea = event.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Get the current value of the textarea
      const text = textarea.value;

      // Insert a new row with brackets "[]" at the cursor position
      const newText = text.slice(0, start) + "\n[]" + text.slice(end);

      // Update the textarea value and cursor position
      textarea.value = newText;
      textarea.selectionStart = textarea.selectionEnd = start + 3; // Place cursor inside the brackets
    }
  });

document
  .getElementById("saveBuildButton")
  .addEventListener("click", saveCurrentBuild);

// Structures and Units Data
const structures = [
  "baneling nest",
  "evolution chamber",
  "extractor",
  "greater spire",
  "hatchery",
  "hatcheries",
  "hive",
  "hydralisk den",
  "lair",
  "lurker den",
  "nydus network",
  "roach warren",
  "spawning pool",
  "spine crawler",
  "spire",
  "spore crawler",
  "infestation pit",
  "assimilator",
  "cybernetics core",
  "dark shrine",
  "fleet beacon",
  "forge",
  "gateway",
  "nexus",
  "photon cannon",
  "pylon",
  "robotics bay",
  "robotics facility",
  "shield battery",
  "stargate",
  "templar archives",
  "twilight council",
  "warp gate",
  "armory",
  "barracks",
  "bunker",
  "command center",
  "engineering bay",
  "fusion core",
  "ghost academy",
  "missile turret",
  "orbital command",
  "planetary fortress",
  "reactor",
  "refinery",
  "sensor tower",
  "starport",
  "supply depot",
  "tech lab",
  "factory",
  "creep tumor",
];

const units = {
  zerg: [
    "overlord",
    "overseer",
    "zergling",
    "queen",
    "drone",
    "lurker",
    "hydralisk",
    "swarm host",
    "roach",
    "baneling",
    "corruptor",
    "infestor",
    "ultralisk",
    "mutalisk",
    "viper",
    "brood lord",
    "larva",
    "changling",
  ],
  protoss: [
    "probe",
    "zealot",
    "stalker",
    "sentry",
    "observer",
    "immortal",
    "warp prism",
    "colossus",
    "phoenix",
    "void ray",
    "high templar",
    "dark templar",
    "archon",
    "carrier",
    "mothership",
    "oracle",
    "tempest",
    "adept",
    "disruptor",
  ],
  terran: [
    "scv",
    "marine",
    "marauder",
    "reaper",
    "ghost",
    "hellion",
    "siege tank",
    "thor",
    "viking",
    "medivac",
    "banshee",
    "raven",
    "battlecruiser",
    "widow mine",
    "hellbat",
    "cyclone",
    "liberator",
  ],
};

const upgrades = [
  // Zerg Upgrades
  "metabolic boost",
  "adrenal glands",
  "glial reconstitution",
  "tunneling claws",
  "grooved spines",
  "muscular augments",
  "chitinous plating",
  "anabolic synthesis",
  "neural parasite",
  "range attack",
  "baneling speed",
  "centrifugal Hooks",
  "overlord speed",
  "burrow",
  "carapace",
  "melee attack",
  "missile attack",
  "flyer armor",
  "flyer attack",
  "adaptive talons",
  "seismic spines",

  // Protoss Upgrades
  "research warp gate",
  "shield",
  "ground weapons",
  "ground armor",
  "air weapons",
  "air armor",
  "blink",
  "charge",
  "resonating glaives",
  "psionic storm",
  "storm",
  "anion pulse-crystals",
  "colossus range",
  "extended thermal lance",
  "gravitic boosters",
  "gravitic drive",
  "flux vanes",
  "tectonic destabilizers",
  "shadow stride",

  // Terran Upgrades
  "weapon refit",
  "vehicle and ship plating",
  "vehicle weapons",
  "stim",
  "ship weapons",
  "smart servos",
  "neosteel armor",
  "infernal pre-igniter",
  "interference matrix",
  "infantry weapons",
  "hyperflight rotors",
  "infantry armor",
  "hi-sec auto tracking",
  "hurricane engines",
  "drilling claws",
  "combat shield",
  "concussive shells",
  "cloak",
  "advanced ballistics",
  "caduceus reactor",
];

// Modify the abbreviation map for specific structures and units
const abbreviationMap = {
  ling: "zergling",
  lings: "zerglings",
  ovi: "overlord",
  ovie: "overlord",
  RW: "roach warren",
  zgas: "extractor",
  tgas: "refinery",
  pgas: "assimilator",
  hydra: "hydralisk",
  hatch: "hatchery",
  bc: "battlecruiser",
  evo: "evolution chamber",
  "zergling speed": "Metabolic Boost",
  "roach speed": "glial reconstitution",
  "hydralsik range": "grooved spines",
  "hydralsik speed": "muscular augments",
  "ultralisk armor": "chitinous plating",
  "ultralisk speed": "anabolic synthesis",
  "lurker range": "seismic spines",
  "range attack": "missile attack",
  cannon: "photon cannon",
  cannons: "photon cannons",
  "phoenix range": "anion pulse-crystals",
  "building armor": "Neosteel armor",
  "blue flame": "Infernal pre-igniter",
  pool: "spawning pool",
  ebay: "engineering bay",
  CC: "command center",
  "Bane nest": "baneling nest",
  SG: "stargate",
  "Lurker speed": "adaptive talons",
  rax: "barracks",
  SP: "starport",
  PF: "planetary fortress",
  robo: "robotics facility",
  battery: "shield battery",
  Infestation: "Infestation pit",
};

function transformAbbreviations(text) {
  // Specific replacements for full phrases to avoid partial matches
  const replacements = {
    "spine crawler": "Spine Crawler",
    "spore crawler": "Spore Crawler",
    "nydus network": "Nydus Network",
    "brood lord": "Brood Lord",
    "siege tank": "Siege Tank",
    "psionic storm": "Psionic Storm", // Prioritize this replacement
    "greater spire": "Greater Spire", // Add specific replacement for Greater Spire
  };

  // Replace full phrases first
  Object.keys(replacements).forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    text = text.replace(regex, replacements[phrase]);
  });

  // Handle "spire" separately, ensuring no overlap with "Greater Spire"
  text = text.replace(/\bspire\b(?!\s+spire)/gi, (match) => {
    if (!/\bgreater spire\b/gi.test(text)) {
      return "Spire";
    }
    return match;
  });

  // Handle singular forms without affecting plural forms
  text = text.replace(/\broach\b(?!es)/gi, "Roach"); // Only replace singular "roach"
  text = text.replace(/\bzergling\b(?!s)/gi, "Zergling"); // Only replace singular "zergling"
  text = text.replace(/\bqueen\b(?!s)/gi, "Queen"); // Only replace singular "queen"

  // Abbreviations handling for single words only if they are not part of a larger term
  text = text.replace(/\bspine\b(?!\s+crawler)/gi, (match) => {
    if (!/\bspine crawler\b/gi.test(text)) {
      return "Spine Crawler";
    }
    return match;
  });
  text = text.replace(/\bspore\b(?!\s+crawler)/gi, (match) => {
    if (!/\bspore crawler\b/gi.test(text)) {
      return "Spore Crawler";
    }
    return match;
  });
  text = text.replace(/\bnydus\b(?!\s+network)/gi, (match) => {
    if (!/\bnydus network\b/gi.test(text)) {
      return "Nydus Network";
    }
    return match;
  });
  text = text.replace(/\bbrood\b(?!\s+lord)/gi, (match) => {
    if (!/\bbrood lord\b/gi.test(text)) {
      return "Brood Lord";
    }
    return match;
  });
  text = text.replace(/\btank\b(?!\s+tank)/gi, (match) => {
    if (!/\bsiege tank\b/gi.test(text)) {
      return "Siege Tank";
    }
    return match;
  });
  text = text.replace(/\bcaduceus\b(?!\s+reactor)/gi, (match) => {
    if (!/\bcaduceus reactor\b/gi.test(text)) {
      return "Caduceus Reactor";
    }
    return match;
  });

  // Apply other abbreviations from the abbreviationMap only if no previous match occurred
  return Object.keys(abbreviationMap).reduce((updatedText, abbr) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi"); // Word boundary matching
    const replacement = abbreviationMap[abbr];
    return updatedText.replace(regex, (match) => {
      if (!new RegExp(`\\b${replacement}\\b`, "gi").test(updatedText)) {
        return replacement;
      }
      return match;
    });
  }, text);
}

const upgradeImages = {
  // zerg
  "metabolic boost": "img/upgrade/metabolic_boost.png",
  "adrenal glands": "img/upgrade/adrenal_glands.png",
  "glial reconstitution": "img/upgrade/glial_reconstitution.png",
  "tunneling claws": "img/upgrade/tunneling_claws.png",
  "overlord speed": "img/upgrade/overlord_speed.png",
  "muscular augments": "img/upgrade/muscular_augments.png",
  "chitinous plating": "img/upgrade/chitinous_plating.png",
  "grooved spines": "img/upgrade/grooved_spines.png",
  burrow: "img/upgrade/burrow.png",
  "anabolic synthesis": "img/upgrade/anabolic_synthesis.png",
  "flyer attack": "img/upgrade/flyer_attack.png",
  "flyer armor": "img/upgrade/flyer_armor.png",
  "melee attack": "img/upgrade/melee_attack.png",
  carapace: "img/upgrade/carapace.png",
  "missile attack": "img/upgrade/missile_attack.png",
  "centrifugal hooks": "img/upgrade/centrifugal_hooks.png",
  "baneling speed": "img/upgrade/centrifugal_hooks.png",
  "adaptive talons": "img/upgrade/adaptive_talons.png",
  "seismic spines": "img/upgrade/seismic_spines.png",
  "neural parasite": "img/upgrade/neural_parasite.png",
  // protoss
  "air armor": "img/upgrade/air_armor.png",
  "air weapons": "img/upgrade/air_weapons.png",
  blink: "img/upgrade/blink.png",
  "anion pulse-crystals": "img/upgrade/anion_pulse-crystals.png",
  "extended thermal lance": "img/upgrade/extended_thermal_lance.png",
  charge: "img/upgrade/charge.png",
  "flux vanes": "img/upgrade/flux_vanes.png",
  "gravitic drive": "img/upgrade/gravitic_drive.png",
  "gravitic boosters": "img/upgrade/gravitic_boosters.png",
  "ground armor": "img/upgrade/ground_armor.png",
  "psionic storm": "img/upgrade/psionic_storm.png",
  "ground weapons": "img/upgrade/ground_weapons.png",
  "research warp gate": "img/upgrade/research_warpgate.png",
  "shadow stride": "img/upgrade/shadow_stride.png",
  "resonating glaives": "img/upgrade/resonating_glaives.png",
  shields: "img/upgrade/shields.png",
  "tectonic destabilizers": "img/upgrade/tectonic_desabilizers.png",
  // terran
  "weapon refit": "img/upgrade/weapon_refit.png",
  "vehicle and ship plating": "img/upgrade/vehicle_and_ship_plating.png",
  "vehicle weapons": "img/upgrade/vehicle_weapons.png",
  stim: "img/upgrade/stim.png",
  "ship weapons": "img/upgrade/ship_weapons.png",
  "smart servos": "img/upgrade/smart_servos.png",
  "neosteel armor": "img/upgrade/neosteel_armor.png",
  "infernal pre-igniter": "img/upgrade/infernal_pre-igniter.png",
  "interference matrix": "img/upgrade/interference_matrix.png",
  "infantry weapons": "img/upgrade/infantry_weapons.png",
  "hyperflight rotors": "img/upgrade/hyperflight_rotors.png",
  "infantry armor": "img/upgrade/infantry_armor.png",
  "hi-sec auto tracking": "img/upgrade/hi-sec_auto_tracking.png",
  "hurricane engines": "img/upgrade/hurricane_engines.png",
  "drilling claws": "img/upgrade/drilling_claws.png",
  "combat shield": "img/upgrade/combat_shield.png",
  "concussive shells": "img/upgrade/concussive_shells.png",
  cloak: "img/upgrade/cloak.png",
  "advanced ballistics": "img/upgrade/advanced_ballistics.png",
  "caduceus reactor": "img/upgrade/caduceus_reactor.png",
};

const structureImages = {
  armory: "img/structure/armory.png",
  assimilator: "img/structure/assimilator.png",
  "baneling nest": "img/structure/baneling_nest.png",
  barracks: "img/structure/barracks.png",
  bunker: "img/structure/bunker.png",
  "command center": "img/structure/command_center.png",
  "creep tumor": "img/structure/creep_tumor.png",
  "cybernetics core": "img/structure/cybernetics_core.png",
  "dark shrine": "img/structure/dark_shrine.png",
  "engineering bay": "img/structure/engineering_bay.png",
  "evolution chamber": "img/structure/evolution_chamber.png",
  extractor: "img/structure/extractor.png",
  factory: "img/structure/factory.png",
  "fleet beacon": "img/structure/fleet_beacon.png",
  forge: "img/structure/forge.png",
  "fusion core": "img/structure/fusion_core.png",
  gateway: "img/structure/gateway.png",
  "ghost academy": "img/structure/ghost_academy.png",
  "greater spire": "img/structure/greater_spire.png",
  hatchery: "img/structure/hatchery.png",
  hive: "img/structure/hive.png",
  "hydralisk den": "img/structure/hydralisk_den.png",
  "infestation pit": "img/structure/infestation_pit.png",
  lair: "img/structure/lair.png",
  "missile turret": "img/structure/missile_turret.png",
  nexus: "img/structure/nexus.png",
  "nydus network": "img/structure/nydus_network.png",
  "orbital command": "img/structure/orbital_command.png",
  "photon cannon": "img/structure/photon_cannon.png",
  "planetary fortress": "img/structure/planetary_fortress.png",
  pylon: "img/structure/pylon.png",
  reactor: "img/structure/reactor.png",
  refinery: "img/structure/refinery.png",
  "roach warren": "img/structure/roach_warren.png",
  "robotics bay": "img/structure/robotics_bay.png",
  "robotics facility": "img/structure/robotics_facility.png",
  "sensor tower": "img/structure/sensor_tower.png",
  "spawning pool": "img/structure/spawning_pool.png",
  "spine crawler": "img/structure/spine_crawler.png",
  spire: "img/structure/spire.png",
  "spore crawler": "img/structure/spore_crawler.png",
  stargate: "img/structure/stargate.png",
  starport: "img/structure/starport.png",
  "supply depot": "img/structure/supply_depot.png",
  "tech lab": "img/structure/tech_lab.png",
  "templar archives": "img/structure/templar_archives.png",
  "twilight council": "img/structure/twilight_council.png",
  "ultralisk cavern": "img/structure/ultralisk_cavern.png",
  "warp gate": "img/structure/warp_gate.png",
  "shield battery": "img/structure/shield_battery.png",

  // Add paths for all structures
};

const unitImages = {
  adept: "img/unit/adept.png",
  archon: "img/unit/archon.png",
  baneling: "img/unit/baneling.png",
  banshee: "img/unit/banshee.png",
  battlecruiser: "img/unit/battlecruiser.png",
  "brood lord": "img/unit/brood_lord.png",
  carrier: "img/unit/carrier.png",
  changling: "img/unit/changling.png",
  colossus: "img/unit/colossus.png",
  corruptor: "img/unit/corruptor.png",
  cyclone: "img/unit/cyclone.png",
  "dark templar": "img/unit/dark_templar.png",
  drone: "img/unit/drone.png",
  disruptor: "img/unit/disruptor.png",
  ghost: "img/unit/ghost.png",
  hellion: "img/unit/hellion.png",
  hellbat: "img/unit/hellbat.png",
  "high templar": "img/unit/high_templar.png",
  hydralisk: "img/unit/hydralisk.png",
  immortal: "img/unit/immortal.png",
  infestor: "img/unit/infestor.png",
  larva: "img/unit/larva.png",
  liberator: "img/unit/liberator.png",
  lurker: "img/unit/lurker.png",
  marauder: "img/unit/marauder.png",
  marine: "img/unit/marine.png",
  medivac: "img/unit/medivac.png",
  mothership: "img/unit/mothership.png",
  mule: "img/unit/mule.png",
  mutalisk: "img/unit/mutalisk.png",
  observer: "img/unit/observer.png",
  oracle: "img/unit/oracle.png",
  overlord: "img/unit/overlord.png",
  overseer: "img/unit/overseer.png",
  tempest: "img/unit/tempest.png",
  phoenix: "img/unit/phoenix.png",
  probe: "img/unit/probe.png",
  queen: "img/unit/queen.png",
  raven: "img/unit/raven.png",
  reaper: "img/unit/reaper.png",
  roach: "img/unit/roach.png",
  scv: "img/unit/scv.png",
  sentry: "img/unit/sentry.png",
  "siege tank": "img/unit/siege_tank.png",
  stalker: "img/unit/stalker.png",
  "swarm host": "img/unit/swarm_host.png",
  thor: "img/unit/thor.png",
  ultralisk: "img/unit/ultralisk.png",
  viking: "img/unit/viking.png",
  viper: "img/unit/viper.png",
  "void ray": "img/unit/void_ray.png",
  "warp prism": "img/unit/warp_prism.png",
  "widow mine": "img/unit/widow_mine.png",
  zealot: "img/unit/zealot.png",
  zergling: "img/unit/zergling.png",
  // Add paths for all units
};

// Function to format action text with upgrade images
function formatUpgrades(actionText) {
  const upgrades = Object.keys(upgradeImages);

  upgrades.forEach((upgrade) => {
    const escapedUpgrade = upgrade.replace(/\+/g, "\\+"); // Escape special characters
    const regex = new RegExp(`\\b${escapedUpgrade}\\b`, "gi");

    // Only replace once to avoid duplication
    actionText = actionText.replace(regex, (match) => {
      // Check if the upgrade is "flyer carapace" to handle its image properly
      if (upgrade === "flyer carapace") {
        const imageSrc = upgradeImages[upgrade];
        return `<span class="upgrade-highlight">${upgrade} <img src="${imageSrc}" alt="${upgrade}" class="upgrade-image"></span>`;
      }

      // For other upgrades, use the default formatting
      const imageSrc = upgradeImages[upgrade];
      return `<span class="upgrade-highlight">${upgrade} <img src="${imageSrc}" alt="${upgrade}" class="upgrade-image"></span>`;
    });
  });

  return actionText;
}

// Capitalize the first letter of the text
function capitalizeFirstLetter(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Capitalize the first letter of each word for units, structures, and upgrades
function capitalizeWords(text) {
  // Avoid capitalizing suffixes like "st," "nd," "rd," "th"
  text = text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num, suffix) => {
    return `${num}${suffix}`; // Keep the number and suffix as-is
  });

  // Capitalize specific terms (Units, Structures, Upgrades)
  const allUnitsAndStructures = [
    ...units.zerg,
    ...units.protoss,
    ...units.terran,
    ...structures,
    ...upgrades,
  ];

  allUnitsAndStructures.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    text = text.replace(regex, (match) => capitalizeFirstLetter(match));
  });

  return text;
}

// Capitalize the first letter of each sentence
function capitalizeSentences(text) {
  // Avoid capitalizing suffixes like "st," "nd," "rd," "th"
  return text.replace(/(?:^|\.\s+)([a-z](?!st|nd|rd|th))/g, (match, group1) => {
    return match.toUpperCase();
  });
}

function formatStructureText(actionText) {
  // Handle multi-word upgrades as exceptions first
  const exceptions = [
    {
      regex: /\bcaduceus reactor\b/gi,
      replacement: `<span class="upgrade-highlight">Caduceus Reactor</span>`,
    },
    {
      regex: /\bresearch warp gate\b/gi,
      replacement: `<span class="upgrade-highlight">Research Warp Gate</span>`,
    },
  ];

  // Replace exceptions first
  exceptions.forEach((exception) => {
    actionText = actionText.replace(exception.regex, exception.replacement);
  });

  // Process remaining structures, ensuring no conflicts with exceptions
  structures.forEach((structure) => {
    const regex = new RegExp(`\\b${structure}\\b`, "gi");
    actionText = actionText.replace(regex, (match) => {
      // Avoid duplicating replacements
      const alreadyProcessed = actionText.includes(
        `<span class="bold-yellow">${match}`
      );
      if (alreadyProcessed) {
        return match; // Skip if already processed
      }

      // Get image path if available
      const imageSrc = structureImages[structure.toLowerCase()] || "";
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${structure}" class="structure-image">`
        : "";

      return `<span class="bold-yellow">${structure}${imageTag}</span>`;
    });
  });

  return actionText;
}

// Function to format specific units with styling, handling plural forms and exceptions
function formatUnits(actionText) {
  // Zerg Units - Purple
  units.zerg.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+warren|\\s+den|\\s+pit|\\s+network|\\s+speed|\\s+armor|\\s+nest)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-purple">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  // Protoss Units - Bright Blue
  units.protoss.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+core|\\s+shrine|\\s+gate|\\s+forge|\\s+range)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-blue">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  // Terran Units - Bright Red
  units.terran.forEach((unit) => {
    const regex = new RegExp(
      `\\b${unit}(s)?\\b(?!\\s+barracks|\\s+command|\\s+reactor|\\s+academy)`,
      "gi"
    );
    actionText = actionText.replace(regex, (match, plural) => {
      const imageSrc = unitImages[unit.toLowerCase()] || ""; // Get image path if available
      const imageTag = imageSrc
        ? ` <img src="${imageSrc}" alt="${unit}" class="unit-image">`
        : "";
      return `<span class="bold-red">${capitalizeFirstLetter(unit)}${
        plural || ""
      }${imageTag}</span>`;
    });
  });

  return actionText;
}

// Function to format specific units and structures with styling
function formatActionText(actionText) {
  actionText = transformAbbreviations(actionText); // Transform abbreviations first
  actionText = formatStructureText(actionText); // Format structures
  actionText = formatUnits(actionText); // Format units
  actionText = formatUpgrades(actionText); // Format upgrades

  // Capitalize first letter of each sentence
  actionText = capitalizeSentences(actionText);

  // Capitalize the first letter of each word for units, structures, and upgrades
  actionText = capitalizeWords(actionText);

  // Highlight numbers followed by "gas" or "minerals" (with or without space)
  actionText = actionText.replace(
    /(\d+)\s*(gas|minerals)/gi,
    (match, num, resource) => {
      const colorClass =
        resource.toLowerCase() === "gas" ? "green-text" : "blue-text";
      const imageSrc =
        resource.toLowerCase() === "gas"
          ? "img/resources/gas.png"
          : "img/resources/minerals.png";
      const imageTag = `<img src="${imageSrc}" alt="${resource}" class="resource-image">`;

      return `<span class="${colorClass}">${num} ${capitalizeFirstLetter(
        resource
      )}</span> ${imageTag}`;
    }
  );

  // Highlight other numbers (including those attached to words like "1x marine")
  actionText = actionText.replace(
    /(\d+)(\s*x\s*)?([a-z]+)/gi,
    (match, num, x, word) => {
      const colorClass = "red-text"; // Default red for general numbers
      const formattedWord = capitalizeFirstLetter(word);

      if (x) {
        return `<span class="${colorClass}">${num}${x}${formattedWord}</span>`;
      }

      return `<span class="${colorClass}">${num}</span> ${formattedWord}`;
    }
  );

  return actionText;
}

// Function to analyze and update the build order table automatically
function analyzeBuildOrder(inputText) {
  const lines = inputText.split("\n");
  const table = document.getElementById("buildOrderTable");

  // Clear existing rows (except the header)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  lines.forEach((line) => {
    const match = line.match(/\[(.*?)\]\s*(.*)/);

    let workersOrTimestamp = "";
    let actionText = "";

    if (match) {
      workersOrTimestamp = match[1];
      actionText = match[2];
    } else {
      actionText = line;
    }

    // Replace `->` and `<-` with arrows in the action text
    actionText = actionText.replace(/->/g, "→").replace(/<-/g, "←");

    // Format Workers/Timestamp
    workersOrTimestamp = formatWorkersOrTimestamp(workersOrTimestamp);

    // Apply additional formatting to action text
    actionText = transformAbbreviations(actionText);
    actionText = formatStructureText(actionText);
    actionText = formatActionText(actionText);

    // Insert row in the table
    const row = table.insertRow();
    row.insertCell(0).innerHTML = workersOrTimestamp;
    row.insertCell(1).innerHTML = actionText;
  });
}

function formatWorkersOrTimestamp(text) {
  // Highlight numbers followed by "gas" or "minerals"
  return text.replace(/(\d+)\s+(gas|minerals)/gi, (match, num, resource) => {
    const colorClass =
      resource.toLowerCase() === "gas" ? "green-text" : "blue-text";
    const imageSrc =
      resource.toLowerCase() === "gas"
        ? "img/resources/gas.png"
        : "img/resources/minerals.png";
    const imageTag = `<img src="${imageSrc}" alt="${resource}" class="resource-image">`;

    return `<span class="${colorClass}">${num} ${capitalizeFirstLetter(
      resource
    )}</span> ${imageTag}`;
  });
}

function capitalizeFirstWord(text) {
  // Capitalize only the first word of the actionText
  return text.replace(/^\w/, (char) => char.toUpperCase());
}

// Automatically trigger analysis when the user types in the buildOrderInput field
document
  .getElementById("buildOrderInput")
  .addEventListener("input", (event) => {
    analyzeBuildOrder(event.target.value);
  });

// Function to toggle visibility of a section using data-section attribute
function toggleSection(header) {
  const sectionId = header.getAttribute("data-section");
  const section = document.getElementById(sectionId);
  const arrow = header.querySelector(".arrow");

  if (section.style.display === "none" || !section.style.display) {
    section.style.display = "block";
    arrow.classList.add("open"); // Rotate arrow down
  } else {
    section.style.display = "none";
    arrow.classList.remove("open"); // Rotate arrow right
  }
}

// Add event listeners to headers with the class "toggle-title"
document.querySelectorAll(".toggle-title").forEach((header) => {
  header.addEventListener("click", () => toggleSection(header));
});

// Add event listeners for each header
document.querySelectorAll(".toggle-header").forEach((header) => {
  header.addEventListener("click", () => toggleSection(header));
});

document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  document
    .getElementById("videoInput")
    .addEventListener("input", updateYouTubeEmbed);
});

// Global variable for storing all builds
let savedBuilds = [];

// Load saved builds from local storage on page load
window.addEventListener("load", () => {
  const storedBuilds = localStorage.getItem("savedBuilds");
  if (storedBuilds) {
    savedBuilds = JSON.parse(storedBuilds);
    filterBuilds("all"); // Display all builds on load
  }
});

// Setup event listeners
function initializeEventListeners() {
  document
    .getElementById("saveBuildsButton")
    .addEventListener("click", saveBuildsToFile);
  document
    .getElementById("loadBuildsButton")
    .addEventListener("change", loadBuildsFromFile);
  document
    .getElementById("showBuildsButton")
    .addEventListener("click", showAllBuilds);
  document
    .getElementById("closeModalButton")
    .addEventListener("click", closeModal);

  // Close modal on outside click
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("buildsModal");
    if (event.target === modal) {
      closeModal();
    }
  });
}

function saveCurrentBuild() {
  const title = document.getElementById("buildOrderTitleInput").value.trim();
  const comment = document.getElementById("commentInput").value.trim();
  const videoLink = document.getElementById("videoInput").value.trim();
  const buildOrderInput = document
    .getElementById("buildOrderInput")
    .value.trim();
  const category = document.getElementById("buildCategoryDropdown").value;

  const buildOrder = [];
  const table = document.getElementById("buildOrderTable");
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    buildOrder.push({
      workersOrTimestamp: row.cells[0].textContent,
      action: row.cells[1].innerHTML,
    });
  }

  if (!title) {
    alert("Please provide a title for the build.");
    return;
  }

  const build = {
    title: title,
    comment: comment,
    videoLink: videoLink,
    buildOrder: buildOrder,
    category: category,
    timestamp: Date.now(), // Add creation timestamp
  };

  // Check for duplicate titles
  const existingIndex = savedBuilds.findIndex((b) => b.title === title);
  if (existingIndex !== -1) {
    if (
      !confirm(
        `A build with the title "${title}" already exists. Overwrite it?`
      )
    ) {
      return;
    }
    savedBuilds[existingIndex] = build; // Overwrite existing build
  } else {
    savedBuilds.push(build); // Add new build
  }

  // Save builds to local storage
  localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));

  alert("Build saved successfully!");
  filterBuilds("all"); // Refresh the build list
}

// Save all builds to a JSON file
function saveBuildsToFile() {
  console.log(savedBuilds); // Debugging line
  const blob = new Blob([JSON.stringify(savedBuilds, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "build_orders.json";
  downloadLink.click();
  URL.revokeObjectURL(url);
}

// Load builds from a file
function loadBuildsFromFile(event) {
  const file = event.target.files[0];
  if (!file) {
    alert("No file selected.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const importedBuilds = JSON.parse(e.target.result);

      // Validate imported builds
      importedBuilds.forEach((build) => {
        if (!build.title || !build.category) {
          throw new Error(
            "Invalid build format. Each build must include a title and category."
          );
        }
      });

      // Replace the saved builds array with the imported builds
      savedBuilds = importedBuilds;

      // Update local storage
      localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));

      alert("Builds loaded successfully!");

      // Refresh the build list
      filterBuilds("all");
    } catch (error) {
      alert(`Error loading builds: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

document.getElementById("loadBuildsButton").addEventListener("click", () => {
  document.getElementById("loadBuildsInput").click();
});

document
  .getElementById("loadBuildsInput")
  .addEventListener("change", loadBuildsFromFile);

// Display all builds in the modal
function showAllBuilds() {
  const modal = document.getElementById("buildsModal");
  const buildsContainer = document.getElementById("modalBuildsContainer");
  buildsContainer.innerHTML = ""; // Clear existing builds

  savedBuilds.forEach((build, index) => {
    const buildElement = document.createElement("div");
    buildElement.classList.add("build-card");

    buildElement.innerHTML = `
      <div class="delete-icon" onclick="deleteBuild(${index})">×</div>
      <h4 class="build-card-title">${build.title}</h4>
      <button onclick="viewBuild(${index})">View</button>
    `;

    buildsContainer.appendChild(buildElement);
  });

  modal.style.display = "block"; // Show the modal
}

// Close the modal
function closeModal() {
  const modal = document.getElementById("buildsModal");
  modal.style.display = "none";
}

// View a specific build
function viewBuild(index) {
  const build = savedBuilds[index];
  if (!build) return;

  const titleInput = document.getElementById("buildOrderTitleInput");
  const titleText = document.getElementById("buildOrderTitleText");

  // Update the title input and text display
  titleInput.value = build.title;
  titleText.textContent = build.title;
  titleText.classList.remove("dimmed");

  // Populate comment and video link
  document.getElementById("commentInput").value = build.comment || "";
  document.getElementById("videoInput").value = build.videoLink || "";

  // Update the YouTube embed with the new video link
  updateYouTubeEmbed();

  // Populate build order input as a formatted string
  const buildOrderInput = document.getElementById("buildOrderInput");
  const formattedBuildOrder = build.buildOrder
    .map(
      (step) =>
        `[${step.workersOrTimestamp}] ${step.action.replace(
          /<\/?[^>]+(>|$)/g,
          ""
        )}` // Strip HTML tags
    )
    .join("\n");
  buildOrderInput.value = formattedBuildOrder;

  // Populate the build order table
  displayBuildOrder(build.buildOrder);

  closeModal();
}

function deleteBuild(index) {
  if (!confirm("Are you sure you want to delete this build?")) {
    return;
  }

  // Remove the build from the array
  savedBuilds.splice(index, 1);

  // Update local storage
  localStorage.setItem("savedBuilds", JSON.stringify(savedBuilds));

  // Refresh the build list
  filterBuilds("all");
  alert("Build deleted successfully!");
}

// Function to display the build order in the table
function displayBuildOrder(buildOrder) {
  const table = document.getElementById("buildOrderTable");

  // Clear existing rows (except the header)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  buildOrder.forEach((step) => {
    const row = table.insertRow();
    row.insertCell(0).innerHTML = formatWorkersOrTimestamp(
      step.workersOrTimestamp
    );
    row.insertCell(1).innerHTML = step.action;
  });
}

// Function to toggle the title input field
function toggleTitleInput(showInput) {
  const titleText = document.getElementById("buildOrderTitleText");
  const titleInput = document.getElementById("buildOrderTitleInput");

  if (showInput) {
    titleText.style.display = "none";
    titleInput.style.display = "inline-block";
    titleInput.value = titleText.classList.contains("dimmed")
      ? ""
      : titleText.textContent;
    titleInput.focus();
    titleText.classList.remove("dimmed");
  } else {
    const titleValue = titleInput.value.trim();
    titleText.textContent = titleValue || "Enter build order title here...";
    titleInput.style.display = "none";
    titleText.style.display = "inline-block";

    if (!titleValue) {
      titleText.classList.add("dimmed");
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const toggleHeaders = document.querySelectorAll(".toggle-title");
  toggleHeaders.forEach((header) => {
    const sectionId = header.getAttribute("data-section");
    const section = document.getElementById(sectionId);
    const arrow = header.querySelector(".arrow");

    // Set arrow based on initial display state
    if (section.style.display === "block") {
      arrow.classList.add("open"); // Rotate down if section is open
    } else {
      arrow.classList.remove("open"); // Keep right if section is closed
    }
  });
});

// Build storage example
let builds = [
  { title: "ZvP Build 1", category: "zvp" },
  { title: "ZvT Build 2", category: "zvt" },
  { title: "PvP Build 1", category: "pvp" },
  { title: "TvT Build 1", category: "tvt" },
  { title: "ZvZ Build 1", category: "zvz" },
];

// Function to filter builds by category or subcategory
function filterBuilds(category) {
  const buildList = document.getElementById("modalBuildsContainer");
  const modalTitle = document.querySelector(".modal-content h3"); // Reference the modal's h3 title

  // Clear existing cards
  buildList.innerHTML = "";

  // Filter builds by category
  const filteredBuilds =
    category === "all"
      ? savedBuilds
      : savedBuilds.filter((build) => build.category === category);

  // Sort by timestamp (newest first)
  const sortedBuilds = filteredBuilds.sort((a, b) => b.timestamp - a.timestamp);

  // Dynamically update the modal title based on the selected category
  const categoryTitles = {
    all: "All Builds",
    zerg: "Zerg Builds",
    protoss: "Protoss Builds",
    terran: "Terran Builds",
    zvp: "ZvP Builds",
    zvt: "ZvT Builds",
    zvz: "ZvZ Builds",
    pvp: "PvP Builds",
    pvz: "PvZ Builds",
    pvt: "PvT Builds",
    tvp: "TvP Builds",
    tvt: "TvT Builds",
    tvz: "TvZ Builds",
  };

  modalTitle.textContent = categoryTitles[category] || "Builds"; // Default to "Builds" if category not found

  // Display sorted and filtered builds
  sortedBuilds.forEach((build, index) => {
    const buildCard = document.createElement("div");
    buildCard.classList.add("build-card");

    // Populate build card content without comment section
    buildCard.innerHTML = `
      <div class="delete-icon" onclick="deleteBuild(${index})">×</div>
      <h4 class="build-card-title">${build.title}</h4>
      <button onclick="viewBuild(${index})">View</button>
    `;

    // Append build card to the container
    buildList.appendChild(buildCard);
  });
}

function highlightActiveTab(category) {
  document
    .querySelectorAll("#buildCategoryTabs button, #buildSubCategoryTabs button")
    .forEach((button) => {
      button.classList.remove("active-tab");
    });
  document
    .querySelector(`[onclick="filterBuilds('${category}')"]`)
    .classList.add("active-tab");
}

// Function to open the modal
function openModal() {
  const modal = document.getElementById("buildsModal");
  modal.style.display = "block";
  filterBuilds("all"); // Default to show all builds
}

// Function to close the modal
function closeModal() {
  const modal = document.getElementById("buildsModal");
  modal.style.display = "none";
}

function showSubcategories(category) {
  const subcategories = document.querySelectorAll(".subcategory-container");
  subcategories.forEach((container) => {
    container.style.display = "none"; // Hide all subcategories
  });

  const activeSubcategory = document.querySelector(
    `.subcategory-container.${category}`
  );
  if (activeSubcategory) {
    activeSubcategory.style.display = "block";
  }
}

// Optional: Hide subcategories when the mouse leaves the category tab
document
  .getElementById("buildCategoryTabs")
  .addEventListener("mouseleave", () => {
    const subcategories = document.querySelectorAll(".subcategory-container");
    subcategories.forEach((container) => {
      container.style.display = "none"; // Hide all subcategories
    });
  });

function getYouTubeVideoID(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function updateYouTubeEmbed() {
  const videoInput = document.getElementById("videoInput");
  const videoIframe = document.getElementById("videoIframe");

  const videoURL = videoInput.value.trim();
  const videoID = getYouTubeVideoID(videoURL);

  if (videoID) {
    // Show iframe with the video
    videoIframe.src = `https://www.youtube.com/embed/${videoID}`;
    videoIframe.style.display = "block";
  } else {
    // Hide iframe if the URL is invalid
    videoIframe.style.display = "none";
    videoIframe.src = "";
  }
}
