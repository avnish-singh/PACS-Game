/**
 * ═══════════════════════════════════════════════════════
 * PACS ENGINEER — levels.js
 * All level definitions. Each level object describes:
 *  - nodes and their positions
 *  - required connections (the correct solution)
 *  - config puzzles (wrong values the player must fix)
 *  - AE-title matching pairs
 *  - storage thresholds and events
 *  - objectives and scoring
 *
 * To ADD A NEW LEVEL: copy a level block, increment id,
 * and adjust nodes / solution / puzzle as desired.
 * ═══════════════════════════════════════════════════════
 */

const LEVELS = [

  /* ──────────────────── LEVEL 1 ──────────────────── */
  {
    id: 1,
    title: "X-Ray Connection",
    objective: "Connect the X-Ray modality to PACS then to the Viewer",
    story: "The radiology department reports X-Ray images are not appearing on the workstation. Connect the modality to the PACS server.",
    timeLimit: 90,
    puzzleType: "connection",  // drag-and-drop node wiring
    difficulty: 1,
    baseScore: 1000,

    nodes: [
      { id:"xray",    type:"modality",  label:"X-Ray",       icon:"🩻", x:80,  y:160, hasConfig:false, status:"error",
        info:{ modality:"CR", ae:"XRAY_01", ip:"192.168.1.10", port:"104" } },
      { id:"pacs",    type:"pacs",      label:"PACS Server", icon:"🗄️", x:350, y:160, hasConfig:false, status:"error",
        info:{ ae:"PACS_SRV", ip:"192.168.1.50", port:"104" } },
      { id:"viewer",  type:"viewer",    label:"RIS Viewer",  icon:"🖥️", x:620, y:160, hasConfig:false, status:"error",
        info:{ ae:"VIEWER_01", ip:"192.168.1.80", port:"11112" } },
    ],

    // Solution = list of [sourceNodeId, targetNodeId] pairs that MUST exist
    solution: [
      ["xray", "pacs"],
      ["pacs", "viewer"]
    ],

    studyQueue: [
      { id:"s1", modality:"CR", patient:"SMITH J", size:"42MB", stat:false, destination:"pacs" },
      { id:"s2", modality:"CR", patient:"DOE A",   size:"38MB", stat:false, destination:"pacs" },
      { id:"s3", modality:"CR", patient:"JONES K", size:"51MB", stat:true,  destination:"pacs" },
    ],

    storage: { pacs:20, archive:5, cloud:0 },
    storageLimit: 85,

    passCondition: { connectionsOk: true, studiesRouted: 2 },
    hint: "Drag from the ► port of X-Ray to the ◄ port of PACS Server.",
  },

  /* ──────────────────── LEVEL 2 ──────────────────── */
  {
    id: 2,
    title: "Fix AE Titles",
    objective: "Match modality AE Titles to the PACS routing table",
    story: "Studies are arriving at PACS but being rejected. The AE Title configuration is mismatched between modalities and PACS routing rules.",
    timeLimit: 120,
    puzzleType: "ae_match",   // AE title matching puzzle
    difficulty: 2,
    baseScore: 1400,

    nodes: [
      { id:"ct",    type:"modality", label:"CT Scanner", icon:"🔬", x:60,  y:120, hasConfig:true, status:"error",
        info:{ modality:"CT", ae:"CT_WRONG", ip:"192.168.1.20", port:"104" },
        correctConfig:{ ae:"CT_SCAN_01" } },
      { id:"mri",   type:"modality", label:"MRI Unit",   icon:"🧲", x:60,  y:280, hasConfig:true, status:"error",
        info:{ modality:"MR", ae:"MRI_OLD", ip:"192.168.1.21", port:"104" },
        correctConfig:{ ae:"MRI_UNIT_01" } },
      { id:"us",    type:"modality", label:"Ultrasound", icon:"📡", x:60,  y:440, hasConfig:true, status:"error",
        info:{ modality:"US", ae:"ULTRA_X", ip:"192.168.1.22", port:"104" },
        correctConfig:{ ae:"US_01" } },
      { id:"pacs",  type:"pacs",     label:"PACS",       icon:"🗄️", x:380, y:280, hasConfig:false, status:"warn",
        info:{ ae:"PACS_SRV", ip:"192.168.1.50", port:"104" } },
    ],

    // AE matching puzzle data
    aePairs: [
      { modality:"CT Scanner",  correct:"CT_SCAN_01",  wrong:["CT_WRONG","CT_001","SCANNER_CT"] },
      { modality:"MRI Unit",    correct:"MRI_UNIT_01", wrong:["MRI_OLD","MRI_A","MAGNET_01"] },
      { modality:"Ultrasound",  correct:"US_01",       wrong:["ULTRA_X","US_BAD","ECHO_01"] },
    ],

    solution: [
      ["ct","pacs"],["mri","pacs"],["us","pacs"]
    ],

    studyQueue: [
      { id:"s1", modality:"CT", patient:"BROWN T",  size:"240MB", stat:false, destination:"pacs" },
      { id:"s2", modality:"MR", patient:"GREEN S",  size:"180MB", stat:true,  destination:"pacs" },
      { id:"s3", modality:"US", patient:"WHITE R",  size:"28MB",  stat:false, destination:"pacs" },
      { id:"s4", modality:"CT", patient:"BLACK M",  size:"310MB", stat:false, destination:"pacs" },
    ],

    storage: { pacs:45, archive:20, cloud:10 },
    storageLimit: 85,

    passCondition: { aeFixed: 3, connectionsOk: true, studiesRouted: 3 },
    hint: "Click the ⚙ button on each modality to fix its AE Title.",
  },

  /* ──────────────────── LEVEL 3 ──────────────────── */
  {
    id: 3,
    title: "DICOM Gateway Route",
    objective: "Route CT through DICOM gateway — fix IP and port conflicts",
    story: "A DICOM router is misconfigured. CT images must pass through the gateway before reaching PACS. Fix the network configuration.",
    timeLimit: 100,
    puzzleType: "network_fix",  // fix wrong IP/port values
    difficulty: 3,
    baseScore: 1800,

    nodes: [
      { id:"ct",       type:"modality",  label:"CT Scanner",     icon:"🔬", x:50,  y:200, hasConfig:false, status:"ok",
        info:{ modality:"CT", ae:"CT_SCAN_01", ip:"192.168.1.20", port:"104" } },
      { id:"gateway",  type:"router",    label:"DICOM Gateway",  icon:"🔀", x:280, y:200, hasConfig:true,  status:"error",
        info:{ ae:"GW_01", ip:"10.0.0.BAD", port:"9999" },
        correctConfig:{ ip:"192.168.1.40", port:"2762" } },
      { id:"pacs",     type:"pacs",      label:"PACS Server",    icon:"🗄️", x:510, y:200, hasConfig:false, status:"warn",
        info:{ ae:"PACS_SRV", ip:"192.168.1.50", port:"104" } },
      { id:"archive",  type:"archive",   label:"Long-term Archive",icon:"📦",x:510, y:380, hasConfig:false, status:"ok",
        info:{ ae:"ARCHIVE_01", ip:"192.168.1.60", port:"104" } },
      { id:"viewer",   type:"viewer",    label:"Workstation",    icon:"🖥️", x:700, y:200, hasConfig:false, status:"error",
        info:{ ae:"VIEWER_01", ip:"192.168.1.80", port:"11112" } },
    ],

    solution: [
      ["ct","gateway"],
      ["gateway","pacs"],
      ["pacs","viewer"],
      ["pacs","archive"]
    ],

    studyQueue: [
      { id:"s1", modality:"CT", patient:"PATEL V",  size:"420MB", stat:true,  destination:"pacs" },
      { id:"s2", modality:"CT", patient:"WONG L",   size:"380MB", stat:false, destination:"pacs" },
      { id:"s3", modality:"CT", patient:"MILLER D", size:"290MB", stat:false, destination:"archive" },
      { id:"s4", modality:"CT", patient:"DAVIS C",  size:"510MB", stat:false, destination:"archive" },
      { id:"s5", modality:"CT", patient:"TAYLOR N", size:"200MB", stat:true,  destination:"pacs" },
    ],

    storage: { pacs:55, archive:30, cloud:5 },
    storageLimit: 85,

    passCondition: { configFixed: 1, connectionsOk: true, studiesRouted: 4 },
    hint: "Fix the Gateway IP (should be 192.168.1.40) and port (2762).",
  },

  /* ──────────────────── LEVEL 4 ──────────────────── */
  {
    id: 4,
    title: "IP Conflict Crisis",
    objective: "Resolve IP conflicts across 4 nodes before the queue overflows",
    story: "Multiple devices share the same IP address causing DICOM failures across all modalities. Identify and correct each conflict.",
    timeLimit: 110,
    puzzleType: "network_fix",
    difficulty: 4,
    baseScore: 2200,

    nodes: [
      { id:"xray",   type:"modality", label:"X-Ray",    icon:"🩻", x:50,  y:100, hasConfig:true, status:"error",
        info:{ modality:"CR", ae:"XRAY_01", ip:"192.168.1.50", port:"104" },  // IP conflict!
        correctConfig:{ ip:"192.168.1.11" } },
      { id:"ct",     type:"modality", label:"CT",       icon:"🔬", x:50,  y:260, hasConfig:true, status:"error",
        info:{ modality:"CT", ae:"CT_SCAN_01", ip:"192.168.1.50", port:"104" },  // IP conflict!
        correctConfig:{ ip:"192.168.1.20" } },
      { id:"mri",    type:"modality", label:"MRI",      icon:"🧲", x:50,  y:420, hasConfig:true, status:"error",
        info:{ modality:"MR", ae:"MRI_UNIT_01", ip:"192.168.1.50", port:"104" }, // IP conflict!
        correctConfig:{ ip:"192.168.1.21" } },
      { id:"router", type:"router",   label:"Router",   icon:"🔀", x:300, y:260, hasConfig:true,  status:"error",
        info:{ ae:"GW_01", ip:"192.168.1.50", port:"2762" },  // IP conflict!
        correctConfig:{ ip:"192.168.1.40" } },
      { id:"pacs",   type:"pacs",     label:"PACS",     icon:"🗄️", x:550, y:100, hasConfig:false, status:"ok",
        info:{ ae:"PACS_SRV", ip:"192.168.1.50", port:"104" } },  // The real .50
      { id:"viewer", type:"viewer",   label:"Viewer",   icon:"🖥️", x:550, y:420, hasConfig:false, status:"warn",
        info:{ ae:"VIEWER_01", ip:"192.168.1.80", port:"11112" } },
    ],

    solution: [
      ["xray","router"],["ct","router"],["mri","router"],
      ["router","pacs"],["pacs","viewer"]
    ],

    studyQueue: [
      { id:"s1", modality:"CR", patient:"HARRIS B", size:"55MB",  stat:false, destination:"pacs" },
      { id:"s2", modality:"CT", patient:"MARTIN C", size:"480MB", stat:true,  destination:"pacs" },
      { id:"s3", modality:"MR", patient:"CLARK F",  size:"260MB", stat:false, destination:"pacs" },
      { id:"s4", modality:"CR", patient:"LEWIS G",  size:"48MB",  stat:false, destination:"pacs" },
      { id:"s5", modality:"CT", patient:"YOUNG H",  size:"390MB", stat:true,  destination:"pacs" },
      { id:"s6", modality:"MR", patient:"ALLEN J",  size:"175MB", stat:false, destination:"pacs" },
    ],

    storage: { pacs:60, archive:40, cloud:20 },
    storageLimit: 85,

    passCondition: { configFixed: 4, connectionsOk: true, studiesRouted: 5 },
    hint: "PACS IP is 192.168.1.50. All other devices have that same IP — fix each one.",
  },

  /* ──────────────────── LEVEL 5 ──────────────────── */
  {
    id: 5,
    title: "Storage Crisis",
    objective: "Prevent PACS storage overload — route studies to archive and cloud",
    story: "PACS storage is at 78% and a large trauma case is inbound. Move older studies to archive and cloud to prevent a crash.",
    timeLimit: 90,
    puzzleType: "storage",    // storage management puzzle
    difficulty: 5,
    baseScore: 2600,
    emergencyChance: 1.0,     // guaranteed emergency in this level

    nodes: [
      { id:"ct",      type:"modality", label:"CT (Trauma)", icon:"🔬", x:50,  y:100, hasConfig:false, status:"ok",
        info:{ modality:"CT", ae:"CT_SCAN_01", ip:"192.168.1.20", port:"104" } },
      { id:"mri",     type:"modality", label:"MRI",         icon:"🧲", x:50,  y:260, hasConfig:false, status:"ok",
        info:{ modality:"MR", ae:"MRI_UNIT_01", ip:"192.168.1.21", port:"104" } },
      { id:"us",      type:"modality", label:"Ultrasound",  icon:"📡", x:50,  y:420, hasConfig:false, status:"ok",
        info:{ modality:"US", ae:"US_01", ip:"192.168.1.22", port:"104" } },
      { id:"pacs",    type:"pacs",     label:"PACS",        icon:"🗄️", x:320, y:260, hasConfig:false, status:"warn",
        info:{ ae:"PACS_SRV", ip:"192.168.1.50", port:"104" } },
      { id:"archive", type:"archive",  label:"Archive",     icon:"📦", x:580, y:160, hasConfig:false, status:"ok",
        info:{ ae:"ARCHIVE_01", ip:"192.168.1.60", port:"104" } },
      { id:"cloud",   type:"cloud",    label:"Cloud Backup",icon:"☁️", x:580, y:360, hasConfig:false, status:"ok",
        info:{ ae:"CLOUD_01", ip:"10.0.1.50", port:"11113" } },
      { id:"viewer",  type:"viewer",   label:"Viewer",      icon:"🖥️", x:750, y:260, hasConfig:false, status:"warn",
        info:{ ae:"VIEWER_01", ip:"192.168.1.80", port:"11112" } },
    ],

    solution: [
      ["ct","pacs"],["mri","pacs"],["us","pacs"],
      ["pacs","archive"],["pacs","cloud"],["pacs","viewer"]
    ],

    studyQueue: [
      { id:"s1", modality:"CT", patient:"TRAUMA — ANON", size:"890MB", stat:true,  destination:"pacs" },
      { id:"s2", modality:"MR", patient:"KING P",        size:"320MB", stat:false, destination:"archive" },
      { id:"s3", modality:"US", patient:"SCOTT A",       size:"44MB",  stat:false, destination:"cloud" },
      { id:"s4", modality:"CT", patient:"MORRIS L",      size:"550MB", stat:false, destination:"archive" },
      { id:"s5", modality:"MR", patient:"NELSON Q",      size:"280MB", stat:false, destination:"cloud" },
      { id:"s6", modality:"CT", patient:"PARKER E",      size:"720MB", stat:true,  destination:"pacs" },
      { id:"s7", modality:"US", patient:"TURNER W",      size:"38MB",  stat:false, destination:"cloud" },
    ],

    storage: { pacs:78, archive:30, cloud:10 },
    storageLimit: 92,  // harder threshold

    passCondition: { connectionsOk: true, studiesRouted: 6, storageBelow: 90 },
    hint: "Route large studies (MR, CT archives) to Archive or Cloud to keep PACS below 90%.",
  },

];

// ── EMERGENCY EVENTS (randomly triggered during gameplay) ──
const EMERGENCY_EVENTS = [
  { desc:"STAT CT — Trauma Bay",   modality:"CT", size:"600MB", bonus:300 },
  { desc:"STAT MRI — Stroke Code", modality:"MR", size:"400MB", bonus:350 },
  { desc:"STAT X-Ray — ICU",       modality:"CR", size:"70MB",  bonus:150 },
  { desc:"STAT US — OB Emergency", modality:"US", size:"55MB",  bonus:200 },
  { desc:"STAT CT — Cardiac",      modality:"CT", size:"520MB", bonus:280 },
];

// ── PATIENT NAME GENERATOR (AI-simulated queue) ──
const FIRST_NAMES = ["James","Maria","Robert","Linda","Michael","Patricia","William","Barbara","David","Susan","Richard","Jessica","Joseph","Sarah","Thomas","Karen"];
const LAST_NAMES  = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Taylor","Anderson","Martinez","Thomas","Jackson","White","Harris"];
const MODALITIES  = ["CT","MR","CR","US","DX","MG","PT","NM"];
const SIZES_MB    = { CT:[200,900], MR:[150,500], CR:[30,80], US:[20,60], DX:[25,70], MG:[60,150], PT:[300,700], NM:[200,500] };

function generatePatient() {
  const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const mod = MODALITIES[Math.floor(Math.random() * MODALITIES.length)];
  const [min,max] = SIZES_MB[mod];
  const size = Math.floor(Math.random() * (max - min) + min);
  return {
    id: 'gen_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    modality: mod,
    patient: `${ln.toUpperCase()}, ${fn[0]}`,
    size: `${size}MB`,
    stat: Math.random() < 0.12,
    destination: "pacs",
  };
}
