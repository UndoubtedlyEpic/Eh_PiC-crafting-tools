// asking prices (div): median of the cheapest 20 rare listings, status any, built by tools/build_base_prices.py from jewel_base_price.py searches
window.BASE_PRICES = {
 "Diamond": {
  "mode": "effect",
  "shapes": [
   {
    "name": "2 crit lines (attacks) + Effect",
    "needs": [
     "Critical Hit Chance for Attacks",
     "Critical Damage Bonus for Attack Damage"
    ],
    "on": {
     "plain": 600.0,
     "quality": 805.5
    },
    "off": {
     "plain": 11.5,
     "quality": null
    }
   },
   {
    "name": "3 spear-shape crit lines + Effect",
    "needs": [
     "Critical Hit Chance for Attacks",
     "Critical Damage Bonus for Attack Damage",
     "Critical Damage Bonus with Spears"
    ],
    "on": {
     "plain": 820.0,
     "quality": 940.0
    },
    "off": {
     "plain": null,
     "quality": null
    }
   },
   {
    "name": "2 crit lines (spells) + Effect",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus"
    ],
    "on": {
     "plain": 600.0,
     "quality": 1259.0
    },
    "off": {
     "plain": 10.0,
     "quality": null
    }
   }
  ],
  "starter": 1.0
 },
 "Time-Lost Diamond": {
  "mode": "radius",
  "shapes": [
   {
    "name": "crit chance + crit damage (attacks)",
    "needs": [
     "Critical Hit Chance for Attacks",
     "Critical Damage Bonus for Attack Damage"
    ],
    "on": {
     "plain": 699.0,
     "quality": 799.5
    },
    "off": {
     "plain": 460.0,
     "quality": 888.0
    }
   },
   {
    "name": "crit chance + crit damage (attacks) + attack speed",
    "needs": [
     "Critical Hit Chance for Attacks",
     "Critical Damage Bonus for Attack Damage",
     "% increased Attack Speed$"
    ],
    "on": {
     "plain": 749.0,
     "quality": 800.0
    },
    "off": {
     "plain": null,
     "quality": null
    }
   },
   {
    "name": "crit chance + crit damage (spells)",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus"
    ],
    "on": {
     "plain": 750.0,
     "quality": 1075.0
    },
    "off": {
     "plain": 29.0,
     "quality": null
    }
   }
  ],
  "starter": 10.0
 },
 "Time-Lost Ruby": {
  "mode": "radius",
  "shapes": [
   {
    "name": "rage on melee hit",
    "needs": [
     "Gain \\d+ Rage on Melee Hit"
    ],
    "on": {
     "plain": 3.0,
     "quality": null
    },
    "off": {
     "plain": null,
     "quality": 2888.0
    }
   },
   {
    "name": "rage on melee hit + effect of small passives",
    "needs": [
     "Gain \\d+ Rage on Melee Hit",
     "Effect of Small Passive Skills in Radius"
    ],
    "on": {
     "plain": null,
     "quality": null
    },
    "off": {
     "plain": 3.5,
     "quality": null
    }
   },
   {
    "name": "rage when hit",
    "needs": [
     "Rage when Hit by an Enemy"
    ],
    "on": {
     "plain": 5.0,
     "quality": null
    },
    "off": {
     "plain": null,
     "quality": null
    }
   }
  ],
  "starter": 1.0
 },
 "Time-Lost Sapphire": {
  "mode": "radius",
  "shapes": [
   {
    "name": "crit chance + crit damage (spells)",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus"
    ],
    "on": {
     "plain": 25.0,
     "quality": 240.0
    },
    "off": {
     "plain": 1.0,
     "quality": 139.0
    }
   },
   {
    "name": "crit chance + crit damage (spells) + cast speed",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus",
     "% increased Cast Speed$"
    ],
    "on": {
     "plain": 360.0,
     "quality": 700.0
    },
    "off": {
     "plain": null,
     "quality": 375.0
    }
   },
   {
    "name": "crit damage (spells) only",
    "needs": [
     "Critical Spell Damage Bonus"
    ],
    "on": {
     "plain": 5.0,
     "quality": 170.0
    },
    "off": {
     "plain": null,
     "quality": 100.0
    }
   }
  ],
  "starter": 1.0
 },
 "Emerald": {
  "mode": "effect",
  "shapes": [],
  "starter": 1.0
 },
 "Sapphire": {
  "mode": "effect",
  "shapes": [
   {
    "name": "2 spell crit lines",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus"
    ],
    "on": {
     "plain": 100.0,
     "quality": 231.5
    },
    "off": {
     "plain": null,
     "quality": 92.5
    }
   },
   {
    "name": "2 spell crit lines + cast speed",
    "needs": [
     "Critical Hit Chance for Spells",
     "Critical Spell Damage Bonus",
     "% increased Cast Speed$"
    ],
    "on": {
     "plain": 154.0,
     "quality": 435.0
    },
    "off": {
     "plain": 135.0,
     "quality": 195.0
    }
   }
  ],
  "starter": 1.0
 },
 "Time-Lost Emerald": {
  "mode": "radius",
  "shapes": [],
  "starter": 1.0
 },
 "Ruby": {
  "mode": "effect",
  "shapes": [
   {
    "name": "attack + melee damage",
    "needs": [
     "% increased Attack Damage$",
     "% increased Melee Damage$"
    ],
    "on": {
     "plain": 249.5,
     "quality": 700.0
    },
    "off": {
     "plain": null,
     "quality": 25.0
    }
   }
  ]
 }
};
