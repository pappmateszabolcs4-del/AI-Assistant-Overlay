const TUTORIAL_PATTERNS = [
  /\buse (the )?[^.]{1,40} menu to\b/i,
  /\butilize (the )?[^.]{1,40} menu to\b/i,
  /\bselect (the )?area\b/i,
  /\bclick (the )?[^.]{1,40}\b/i,
  /\bpress (the )?[^.]{1,40}\b/i,
  /\bopen (the )?[^.]{1,40}\b/i,
  /\bgo to (the )?[^.]{1,40}\b/i,
  /\bcreate (a )?[^.]{1,40} zone to\b/i,
  /\bdesignate (a )?[^.]{1,40} zone to\b/i,
  /\bkeep an eye on\b/i,
  /\bmake sure to\b/i,
  /\bensure you\b/i,
  /\bremember to\b/i
];

const GENERIC_PATTERNS = [
  /\bprioritize\b/i,
  /\bbalanc(e|ing)\b/i,
  /\btrade-?offs?\b/i,
  /\bis crucial\b/i,
  /\bis essential\b/i,
  /\bcan lead to\b/i,
  /\bmay lead to\b/i,
  /\bto avoid\b/i,
  /\bto prevent\b/i,
  /\boptimi[sz]e\b/i,
  /\bmanage\b/i,
  /\bmonitor\b/i,
  /\binvest\b/i,
  /\bweigh\b/i
];

const WEAK_TRADEOFF_TEMPLATES = [
  /\b(improves|increases|boosts|enhances|helps)\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\b(provides|adds|gives|offers)\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\ballows\b[^.]{0,80}\b(but|however)\b[^.]{0,80}\b(resources?|time|power|materials?|food|energy|risk)\b/i,
  /\b(building|constructing|using)\b[^.]{0,60}\b(costs|consumes|requires)\b[^.]{0,40}\b(resources?|time|power|materials?|food|energy)\b/i,
  /\b(defenses?|turrets?)\b[^.]{0,60}\b(costs|consumes|requires)\b[^.]{0,40}\b(resources?|time|power|materials?|food|energy)\b/i
];

const LOW_SIGNAL_PATTERNS = [
  /\barmor\b[^.]{0,40}\b(reduces|reducing)\b[^.]{0,40}\bdamage\b/i,
  /\bresearch\b[^.]{0,40}\b(unlocks?|unlocking)\b[^.]{0,40}\b(technology|tech)\b/i,
  /\bsolar\b[^.]{0,40}\b(requires|needs)\b[^.]{0,40}\bsunlight\b/i,
  /\bwalls?\b[^.]{0,40}\b(requires|needs)\b[^.]{0,40}\b(wood|stone)\b/i,
  /\b(requires|needs)\b[^.]{0,40}\b(resources?|materials?)\b/i,
  /\b(consumes|costs)\b[^.]{0,40}\b(resources?|materials?)\b/i,
  /\b(requires|needs)\b[^.]{0,40}\bcomponents?\b/i,
  /\bblocked\b[^.]{0,40}\bwithout\b[^.]{0,40}\bresources?\b/i
];

const LIVE_SERVICE_PATTERNS = [
  /\bpatch\b/i,
  /\bhotfix\b/i,
  /\bupdate\b[^.]{0,40}\bnotes?\b/i,
  /\bseason\b/i,
  /\bbattle pass\b/i,
  /\bseries\b\s*\d+\b/i,
  /\bcampaign\b/i,
  /\blimited[-\s]?time\b/i,
  /\bseasonal\b/i,
  /\bactive event\b/i,
  /\bevent reward\b/i,
  /\bshop\b/i,
  /\bstore\b/i,
  /\bcosmetic\b/i,
  /\bskin\b/i,
  /\bskins\b/i,
  /\brotation\b/i,
  /\bpromot(e|ion|ional)\b/i,
  /\bevent\b[^.]{0,40}\b(announcement|schedule|timing)\b/i,
  /\bevent\b[^.]{0,40}\b(reward|limited|seasonal)\b/i,
  /\brelease\b[^.]{0,40}\bdate\b/i,
  /\broadmap\b/i,
  /\bpre-?order\b/i,
  /\bdlc\b/i,
  /\bmonetization\b/i
];

const WIKI_EDITORIAL_PATTERNS = [
  /\bview source\b/i,
  /\bedit (this )?page\b/i,
  /\bpage history\b/i,
  /\brecent changes\b/i,
  /\bcommunity portal\b/i,
  /\buser (talk|page)\b/i,
  /\bhelp (portal|page)\b/i,
  /\bnamespace\b/i,
  /\bcategory\b/i,
  /\bsearch\b/i,
  /\bwiki\b[^.]{0,40}\bnavigation\b/i,
  /\bmain page\b/i,
  /\brandom article\b/i,
  /\bwhat links here\b/i,
  /\bspecial pages?\b/i
];

const TIME_BOUND_PATTERNS = [
  /\b\d{4}\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\bseason(al)?\b/i,
  /\bseries\b\s*\d+\b/i,
  /\bcampaign\b/i,
  /\blimited[-\s]?time\b/i,
  /\bpatch\s*\d+(\.\d+)*\b/i,
  /\bversion\s*\d+(\.\d+)*\b/i,
  /\bupdate\s*\d+(\.\d+)*\b/i,
  /\brelease\b[^.]{0,20}\b(schedule|window|date)\b/i,
  /\brollout\b/i,
  /\bavailability\b[^.]{0,20}\b(window|period)\b/i,
  /\bevent\b[^.]{0,20}\b(window|period|schedule|timing)\b/i,
  /\bpromotion\b/i
];

const DEPENDENCY_GATING_PATTERNS = [
  /\brequires\b[^.]{0,40}\blevel\b/i,
  /\brequires\b[^.]{0,40}\bquest\b/i,
  /\brequires\b[^.]{0,40}\bparty\b/i,
  /\brequires\b[^.]{0,40}\baccess\b/i,
  /\bmust\b[^.]{0,40}\bcomplete\b[^.]{0,40}\bquest\b/i,
  /\bunlock\b[^.]{0,40}\baccess\b/i,
  /\benter\b[^.]{0,40}\brequires\b/i,
  /\bqueue\b[^.]{0,40}\brequires\b/i
];

const EVERGREEN_TIGHTEN_PATTERNS = [
  /\bexpansion\b/i,
  /\bmsq\b/i,
  /\bpatch\b\s*\d+(\.\d+)*\b/i,
  /\btier\b[^.]{0,20}\b(raid|trial)\b/i,
  /\bseason\b\s*\d+\b/i,
  /\bcampaign\b/i,
  /\bevent\b[^.]{0,20}\b(access|unlock)\b/i
];

const EVERGREEN_MECHANIC_PATTERNS = [
  /\bcooldown\b/i,
  /\btradeoff\b/i,
  /\bpositioning\b/i,
  /\bline of sight\b/i,
  /\bresource\b/i,
  /\bobjective\b/i,
  /\bmovement\b/i,
  /\bcombat\b/i,
  /\bability\b/i,
  /\bsynergy\b/i,
  /\binteraction\b/i
];

const LORE_NARRATIVE_PATTERNS = [
  /\bfaction\b[^.]{0,40}\b(history|founding|origins?)\b/i,
  /\bempire\b[^.]{0,40}\b(founding|rise|fall)\b/i,
  /\bkingdom\b[^.]{0,40}\b(founding|succession|dynasty)\b/i,
  /\bpolitic(al|s)\b/i,
  /\bworldbuilding\b/i,
  /\blore\b/i,
  /\bmyth\b/i,
  /\blegend\b/i,
  /\bchronicle\b/i,
  /\bhistory\b/i
];

const COSMETIC_ONLY_PATTERNS = [
  /\b(cosmetic|skin|skins|appearance|visual|aesthetic|cosmetics)\b/i,
  /\bno\s+gameplay\s+(impact|effect|difference)\b/i,
  /\bdoes\s+not\s+affect\s+gameplay\b/i,
  /\bno\s+gameplay\s+advantage\b/i,
  /\bpurely\s+cosmetic\b/i,
  /\bvisual\s+only\b/i,
  /\bjust\s+cosmetic\b/i
];

const GAMEPLAY_SIGNAL_PATTERNS = [
  /\bability\b/i,
  /\bskill\b/i,
  /\bcooldown\b/i,
  /\bdamage\b/i,
  /\bresource\b/i,
  /\bcombat\b/i,
  /\bweapon\b/i,
  /\barmor\b/i,
  /\bmovement\b/i,
  /\bpositioning\b/i,
  /\bobjective\b/i,
  /\btradeoff\b/i,
  /\bresearch\b/i,
  /\bcraft(ing)?\b/i,
  /\bbuild(ing)?\b/i,
  /\bquest\b/i,
  /\bloot\b/i,
  /\bcurrency\b/i,
  /\bpower\b/i,
  /\benergy\b/i,
  /\befficien(t|cy)\b/i,
  /\bthroughput\b/i,
  /\boutput\b/i,
  /\bratio\b/i,
  /\bcapacity\b/i,
  /\bconsumption\b/i,
  /\bpollution\b/i,
  /\bheat\b/i,
  /\btemperature\b/i,
  /\bcooling\b/i,
  /\bgenerator\b/i,
  /\breactor\b/i,
  /\bfuel\b/i
];

const SUPPORTING_SIGNAL_PATTERNS = [
  /\bsetup\b/i,
  /\bprerequisite\b/i,
  /\bunlock\b/i,
  /\bworkstation\b/i,
  /\btool\b/i,
  /\bmaintenance\b/i,
  /\bworkflow\b/i,
  /\binfrastructure\b/i,
  /\bsupply\b/i,
  /\bthroughput\b/i,
  /\bcapacity\b/i,
  /\bnetwork\b/i,
  /\bplumbing\b/i,
  /\bpower\b/i,
  /\bfuel\b/i,
  /\bwater\b/i,
  /\bresource\b/i,
  /\bchain\b/i
];

const NON_ACTIONABLE_PATTERNS = [
  /\bfounding\b/i,
  /\bempire\b/i,
  /\bpolitic(al|s)\b/i,
  /\bhistory\b/i,
  /\blineage\b/i,
  /\bmyth\b/i,
  /\blegend\b/i,
  /\bchronicle\b/i
];

const GAMEPLAY_IMPACT_PATTERNS = [
  /\bdamage\b/i,
  /\bcooldown\b/i,
  /\bability\b/i,
  /\bskill\b/i,
  /\bweapon\b/i,
  /\barmor\b/i,
  /\bmovement\b/i,
  /\bobjective\b/i,
  /\bmatch\b/i,
  /\braid\b/i,
  /\bresource\b/i,
  /\bpower\b/i,
  /\btradeoff\b/i
];

const OBVIOUSNESS_BOOST_PATTERNS = [
  /\brequires power\b/i,
  /\bprovides power\b/i,
  /\bgenerates energy\b/i,
  /\bstores resources\b/i,
  /\bimproves defense\b/i,
  /\bincreases efficiency\b/i,
  /\bused for crafting\b/i,
  /\bhelps production\b/i
];

const RESOURCE_DEPENDENCY_PATTERNS = [
  /\brequires (steel|wood|components|materials?|resources?)\b/i,
  /\brequires components\b/i,
  /\brequires materials\b/i,
  /\bconsumes (materials?|resources?)\b/i,
  /\bblocked by lack of (materials?|resources?|components|wood|steel)\b/i,
  /\bblocked without (materials?|resources?|components|wood|steel)\b/i
];

const EMERGENT_CONSEQUENCE_PATTERNS = [
  /\breduces morale\b/i,
  /\blimits mobility\b/i,
  /\bincreases raid vulnerability\b/i,
  /\bdepletes supplies\b/i,
  /\bstrains power grid\b/i,
  /\bcreates bottlenecks\b/i,
  /\bcauses downtime\b/i,
  /\blimits night operations\b/i,
  /\bincreases maintenance burden\b/i,
  /\bblocks recovery\b/i,
  /\bweakens defenses\b/i,
  /\bcreates resource pressure\b/i,
  /\bincreases risk during raids\b/i,
  /\breduces treatment quality\b/i
];

const MULTI_STEP_PATTERNS = [
  /\bthen\b/i,
  /\bafter\b/i,
  /\bwhen\b[^.]{0,40}\bthen\b/i,
  /\bchain\b/i,
  /\bsequence\b/i,
  /\bloop\b/i
];

const OPTIMIZATION_CHAIN_PATTERNS = [
  /\boptimi[sz]e\b/i,
  /\bthroughput\b/i,
  /\bscaling\b/i,
  /\bcapacity\b/i,
  /\bbottleneck\b/i,
  /\bratio\b/i,
  /\befficien(t|cy)\b/i,
  /\boutput\b/i,
  /\bload\b/i
];

const DEEP_IMPLICATION_PATTERNS = [
  /\bdownstream\b/i,
  /\bknock-?on\b/i,
  /\bchain reaction\b/i,
  /\bcascade\b/i,
  /\bpropagat(e|ion)\b/i,
  /\bfeedback loop\b/i,
  /\bsnowball\b/i
];

const SCALING_CONSTRAINT_PATTERNS = [
  /\bscal(e|ing)\b/i,
  /\bthroughput\b/i,
  /\bcapacity\b/i,
  /\bsaturation\b/i,
  /\bcongestion\b/i,
  /\bbackpressure\b/i,
  /\bbottleneck\b/i,
  /\bqueue\b/i,
  /\blatency\b/i
];

const FAILURE_BEHAVIOR_PATTERNS = [
  /\bfailure\b/i,
  /\bstall\b/i,
  /\bdeadlock\b/i,
  /\bbackup\b/i,
  /\bclog\b/i,
  /\boverflow\b/i,
  /\bbreakdown\b/i
];

const SHALLOW_ACTION_PATTERNS = [
  /\bincreases?\b/i,
  /\bimproves?\b/i,
  /\bboosts?\b/i,
  /\ballows?\b/i,
  /\benables?\b/i,
  /\bused for\b/i,
  /\bcan be used\b/i,
  /\bprovides?\b/i,
  /\badds?\b/i
];

const CONDITION_PATTERNS = [
  /\bif\b/i,
  /\bwhen\b/i,
  /\bwhile\b/i,
  /\bunless\b/i,
  /\buntil\b/i,
  /\bonly when\b/i,
  /\brequires?\b/i,
  /\bwithout\b/i,
  /\bblocked by\b/i,
  /\bafter\b/i,
  /\bbefore\b/i,
  /\bnear\b/i,
  /\bwithin\b/i
];

const STATE_CHANGE_PATTERNS = [
  /\bcauses?\b/i,
  /\bresults in\b/i,
  /\bleads to\b/i,
  /\bforces?\b/i,
  /\bcreates?\b/i,
  /\breduces?\b/i,
  /\blimits?\b/i,
  /\bblocks?\b/i,
  /\bprevents?\b/i,
  /\bhalts?\b/i,
  /\bstalls?\b/i,
  /\bslows?\b/i,
  /\bdelays?\b/i,
  /\bdepletes?\b/i,
  /\bdrains?\b/i,
  /\boverloads?\b/i,
  /\bdisables?\b/i,
  /\bconsumes?\b/i,
  /\bconverts?\b/i
];

const SYNTHETIC_NARRATION_PATTERNS = [
  /\boverall\b/i,
  /\bgenerally\b/i,
  /\bmaximize\b/i,
  /\bminimize\b/i,
  /\boptimi[sz]e\b/i,
  /\bimprove\b[^.]{0,20}\b(efficiency|effectiveness|performance|output)\b/i,
  /\bconsider\b[^.]{0,20}\b(strategy|strategies|approach|approaches)\b/i,
  /\bbest practice\b/i,
  /\bimportant to\b/i,
  /\buseful for\b/i
];

const ADVICE_TONE_PATTERNS = [
  /\bshould\b/i,
  /\bshouldn\b/i,
  /\brecommended\b/i,
  /\bideal\b/i,
  /\bcareful\b/i,
  /\bplanning\b/i,
  /\bmonitor\b/i,
  /\bkeep an eye on\b/i,
  /\bmake sure\b/i,
  /\bensure\b/i,
  /\bavoid\b/i,
  /\bstrategic\b/i,
  /\bstrategy\b/i,
  /\bchoose\b/i,
  /\bplace\b/i,
  /\bposition\b/i,
  /\buse\b[^.]{0,20}\bto\b/i,
  /\bset up\b/i,
  /\bprioritize\b/i,
  /\bmaintain\b/i,
  /\bkeep\b[^.]{0,20}\bclear\b/i
];

const FAILURE_CONSTRAINT_PATTERNS = [
  /\bfailure\b/i,
  /\bconstraint\b/i,
  /\blimitation\b/i,
  /\blimited\b/i,
  /\bcap\b/i,
  /\bmaximum\b/i,
  /\bminimum\b/i,
  /\bbottleneck\b/i,
  /\bcongestion\b/i,
  /\bqueue\b/i,
  /\bstall\b/i,
  /\bdeadlock\b/i,
  /\boverload\b/i,
  /\bshortage\b/i,
  /\binsufficient\b/i,
  /\bblocked\b/i,
  /\bblocking\b/i,
  /\bdelay\b/i,
  /\bdowntime\b/i,
  /\bconflict\b/i
];

const STATE_TRANSITION_PATTERNS = [
  /\b(active|inactive)\b/i,
  /\b(enabled|disabled)\b/i,
  /\bavailable|unavailable\b/i,
  /\bblocked|unblocked\b/i,
  /\bfull|empty\b/i,
  /\breserved|released\b/i,
  /\brerouted\b/i,
  /\bturns?\s+(on|off)\b/i,
  /\bswitch(es)?\b/i,
  /\bchanges?\s+state\b/i,
  /\bbecomes?\b/i
];

const DOWNSTREAM_IMPACT_PATTERNS = [
  /\bdownstream\b/i,
  /\bknock-?on\b/i,
  /\bpropagat(e|ion)\b/i,
  /\bchain reaction\b/i,
  /\bcauses?\b[^.]{0,40}\b(stall|delay|block|shortage|backup|congestion)\b/i
];

const CONSTRAINT_CHAIN_PATTERNS = [
  /\bwhich\b[^.]{0,60}\b(stalls?|blocks?|delays?|forces?)\b/i,
  /\bthat\b[^.]{0,60}\b(stalls?|blocks?|delays?|forces?)\b/i,
  /\bthen\b[^.]{0,60}\b(stalls?|blocks?|delays?|forces?)\b/i
];

const CAUSAL_CHAIN_PATTERNS = [
  /\bcauses?\b/i,
  /\bresults in\b/i,
  /\bleads to\b/i,
  /\btherefore\b/i,
  /\bso that\b/i,
  /\bdrives\b/i,
  /\bforces\b/i,
  /\bcreates\b[^.]{0,40}\bpressure\b/i,
  /\bstarvation\b/i,
  /\bbackpressure\b/i,
  /\binstability\b/i
];

const SYSTEMIC_PATTERN_SIGNALS = [
  /\bfeedback loop\b/i,
  /\bself-?reinforcing\b/i,
  /\bcompounding\b/i,
  /\bpropagat(e|ion)\b/i,
  /\bcascade\b/i,
  /\bsnowball\b/i,
  /\bsystemic\b/i,
  /\bfragility\b/i
];

const INTERACTION_SPREAD_PATTERNS = [
  /\bacross\b/i,
  /\bbetween\b/i,
  /\bmultiple\b/i,
  /\bnetwork\b/i,
  /\bchain\b/i,
  /\bpropagat(e|ion)\b/i
];

const TRADEOFF_IMPLICATION_PATTERNS = [
  /\btradeoff\b/i,
  /\brisk\b/i,
  /\bvulnerab(le|ility)\b/i,
  /\breduces\b/i,
  /\blimits\b/i,
  /\bpenalty\b/i,
  /\bstrain(s)?\b/i,
  /\boverload(s)?\b/i,
  /\bdeplete(s|d)?\b/i,
  /\bdowntime\b/i,
  /\bslows?\b/i,
  /\bdelays?\b/i,
  /\bmorale\b/i,
  /\bmood\b/i,
  /\braid(s)?\b/i
];

const ABILITY_TEMPLATE_PATTERNS = [
  /\brequires timing\b/i,
  /\brequires positioning\b/i,
  /\brequires\b[^.]{0,40}\bto avoid\b/i,
  /\bwithout\b[^.]{0,40}\bability\b/i
];

const SPECIFICITY_BONUS_PATTERNS = [
  /\bline of sight\b/i,
  /\bpositioning\b/i,
  /\bflanking\b/i,
  /\bchokepoint\b/i,
  /\binfo(rmation)? asymmetr(y|ic)\b/i,
  /\btradeoff\b/i,
  /\bopportunity cost\b/i,
  /\bresource pressure\b/i,
  /\bcontextual\b/i,
  /\bwindow\b[^.]{0,20}\b(cooldown|timing)\b/i
];

const GAMEPLAY_IMPLICATION_PATTERNS = [
  /\bpositioning\b/i,
  /\btiming\b/i,
  /\bcoordination\b/i,
  /\btradeoff\b/i,
  /\bresource\b[^.]{0,20}\b(pressure|strain|cost)\b/i,
  /\bopportunity cost\b/i,
  /\binformation asymmetr(y|ic)\b/i,
  /\btactical\b[^.]{0,30}\b(vulnerability|risk|advantage)\b/i,
  /\brisk\b[^.]{0,20}\breward\b/i,
  /\bteam\b[^.]{0,20}\bcoordination\b/i
];

const ARCHETYPE_FAMILY_MAP = {
  tactical_fps: ['combat_operations', 'spatial_tactics', 'information_control', 'objective_control', 'tempo_management'],
  mmo_raider: ['combat_operations', 'team_coordination', 'tempo_management', 'survivability'],
  arpg_grinder: ['combat_operations', 'character_progression', 'ability_synergy', 'risk_reward'],
  automation_sandbox: ['production_systems', 'logistics_systems', 'resource_extraction', 'power_infrastructure', 'automation_control']
};

const ARCHETYPE_TEXT_PATTERNS = {
  tactical_fps: [
    /\bspike\b/i,
    /\bdefuse\b/i,
    /\bplant\b[^.]{0,20}\bsite\b/i,
    /\bbuy phase\b/i,
    /\bround timer\b/i
  ],
  mmo_raider: [
    /\braid\b/i,
    /\bdungeon\b/i,
    /\bparty\b/i,
    /\btrial\b/i
  ],
  arpg_grinder: [
    /\bgear\b/i,
    /\baffix\b/i,
    /\bloot\b/i,
    /\bbuild\b/i
  ],
  automation_sandbox: [
    /\bautomation\b/i,
    /\bproduction\b/i,
    /\blogistics\b/i,
    /\bconveyor\b/i
  ]
};

const ARCHETYPE_OBVIOUS_PATTERNS = {
  tactical_fps: [
    /\bultimate\b[^.]{0,40}\brequires\b[^.]{0,40}\bcharge\b/i,
    /\bspike\b[^.]{0,40}\bmust\b[^.]{0,40}\bplant\b/i,
    /\bdefuse\b[^.]{0,40}\brequires\b[^.]{0,40}\btime\b/i
  ],
  mmo_raider: [
    /\brequires\b[^.]{0,40}\bparty\b/i,
    /\brequires\b[^.]{0,40}\blevel\b/i,
    /\brequires\b[^.]{0,40}\bquest\b/i,
    /\brequires\b[^.]{0,40}\bitem level\b/i
  ],
  arpg_grinder: [
    /\bgear\b[^.]{0,40}\brequires\b[^.]{0,40}\blevel\b/i,
    /\bskills?\b[^.]{0,40}\bunlock\b[^.]{0,40}\blevel\b/i
  ],
  automation_sandbox: [
    /\brequires\b[^.]{0,40}\bpower\b/i,
    /\brequires\b[^.]{0,40}\bresources?\b/i
  ]
};

module.exports = {
  filters: {
    TUTORIAL_PATTERNS,
    GENERIC_PATTERNS,
    WEAK_TRADEOFF_TEMPLATES,
    LOW_SIGNAL_PATTERNS,
    LIVE_SERVICE_PATTERNS,
    WIKI_EDITORIAL_PATTERNS,
    TIME_BOUND_PATTERNS,
    DEPENDENCY_GATING_PATTERNS,
    EVERGREEN_TIGHTEN_PATTERNS,
    EVERGREEN_MECHANIC_PATTERNS,
    LORE_NARRATIVE_PATTERNS,
    COSMETIC_ONLY_PATTERNS,
    GAMEPLAY_SIGNAL_PATTERNS,
    SUPPORTING_SIGNAL_PATTERNS,
    NON_ACTIONABLE_PATTERNS,
    GAMEPLAY_IMPACT_PATTERNS
  },
  grounding: {
    CONDITION_PATTERNS,
    DEPENDENCY_GATING_PATTERNS,
    STATE_CHANGE_PATTERNS,
    STATE_TRANSITION_PATTERNS,
    DOWNSTREAM_IMPACT_PATTERNS,
    CONSTRAINT_CHAIN_PATTERNS,
    CAUSAL_CHAIN_PATTERNS,
    FAILURE_CONSTRAINT_PATTERNS,
    MULTI_STEP_PATTERNS,
    SYNTHETIC_NARRATION_PATTERNS,
    ADVICE_TONE_PATTERNS
  },
  scoring: {
    SUPPORTING_SIGNAL_PATTERNS,
    OBVIOUSNESS_BOOST_PATTERNS,
    RESOURCE_DEPENDENCY_PATTERNS,
    EMERGENT_CONSEQUENCE_PATTERNS,
    MULTI_STEP_PATTERNS,
    OPTIMIZATION_CHAIN_PATTERNS,
    DEEP_IMPLICATION_PATTERNS,
    SCALING_CONSTRAINT_PATTERNS,
    FAILURE_BEHAVIOR_PATTERNS,
    SHALLOW_ACTION_PATTERNS,
    TRADEOFF_IMPLICATION_PATTERNS,
    ABILITY_TEMPLATE_PATTERNS,
    SPECIFICITY_BONUS_PATTERNS,
    GAMEPLAY_IMPLICATION_PATTERNS,
    SYSTEMIC_PATTERN_SIGNALS,
    INTERACTION_SPREAD_PATTERNS,
    ARCHETYPE_FAMILY_MAP,
    ARCHETYPE_TEXT_PATTERNS,
    ARCHETYPE_OBVIOUS_PATTERNS
  }
};
