const UTILITY_PATTERNS = {
  continuityBearing: [
    /\bcontinu(ity|ous)\b/i,
    /\bkeep(s|ing)?\b[^.]{0,40}\b(running|moving|active)\b/i,
    /\bresume\b/i,
    /\bpersist(s|ent|ence)\b/i,
    /\bwithout\s+stopping\b/i
  ],
  operationalDependency: [
    /\bdepends?\s+on\b/i,
    /\brequires?\b/i,
    /\bmust\b/i,
    /\bonly\s+when\b/i,
    /\bunless\b/i,
    /\bcannot\b/i
  ],
  routingSignificance: [
    /\broute\b/i,
    /\brouting\b/i,
    /\bpath\b/i,
    /\bpathfinding\b/i,
    /\brepath\b/i,
    /\breroute\b/i,
    /\bintersection\b/i,
    /\bjunction\b/i,
    /\bsignal\b/i,
    /\btrack\b/i,
    /\bstation\b/i,
    /\bstop\b/i
  ],
  recoverySignificance: [
    /\brecover\b/i,
    /\brecovery\b/i,
    /\bresolve\b/i,
    /\bfix\b/i,
    /\bcleared\b/i,
    /\brestored\b/i,
    /\bretry\b/i,
    /\breset\b/i
  ],
  interruptionSensitive: [
    /\binterrupt\b/i,
    /\bpaused?\b/i,
    /\bhalt(ed|s)?\b/i,
    /\bstopped\b/i,
    /\bblocked\b/i,
    /\bdeadlock\b/i,
    /\bstall(ed|s)?\b/i,
    /\bwaiting\b/i,
    /\bdelay(ed|s)?\b/i,
    /\btimeout\b/i,
    /\bno\s+path\b/i,
    /\bdestination\s+full\b/i
  ],
  downstreamOperationalEffect: [
    /\bcauses?\b/i,
    /\bleads?\s+to\b/i,
    /\bresults?\s+in\b/i,
    /\btherefore\b/i,
    /\bso\s+that\b/i,
    /\bdownstream\b/i,
    /\bknock[-\s]?on\b/i,
    /\bcascade\b/i,
    /\bpropagat(e|es|ed|ion)\b/i,
    /\baffects?\b/i
  ]
};

module.exports = {
  UTILITY_PATTERNS
};
