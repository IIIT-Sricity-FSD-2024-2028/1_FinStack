const FLAGS = ['none', 'none', 'none', 'mismatch', 'duplicate', 'low_ocr_quality', 'suspicious_amount']

function seededNumber(value) {
  let hash = 2166136261
  for (const character of String(value || 'expense')) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function randomConfidence(seed) {
  return 72 + (seededNumber(`${seed}:confidence`) % 28)
}

export function randomFlag(seed) {
  return FLAGS[seededNumber(`${seed}:flag`) % FLAGS.length]
}

export function calculateRisk(flag, confidence, seed = '') {
  const baseRisk = seededNumber(`${seed}:risk`) % 26
  const flagRisk = { none: 0, mismatch: 20, duplicate: 35, low_ocr_quality: 15, suspicious_amount: 30 }[flag] || 0
  return Math.min(baseRisk + flagRisk + Math.round((100 - confidence) * 0.65), 100)
}

export function riskLabel(score) {
  if (score < 30) return 'Low Risk'
  if (score < 70) return 'Moderate Risk'
  return 'High Risk'
}

export function demoAiForExpense(expense) {
  const seed = expense?.id || `${expense?.merchant}:${expense?.date}:${expense?.amount}`
  const confidence = randomConfidence(seed)
  const flag = randomFlag(seed)
  const riskScore = calculateRisk(flag, confidence, seed)
  return { confidence, flag, riskScore, riskLevel: riskLabel(riskScore) }
}

export const flagLabel = (flag) => ({
  none: 'Validated', mismatch: 'Amount mismatch', duplicate: 'Possible duplicate',
  low_ocr_quality: 'Low OCR quality', suspicious_amount: 'Amount review',
}[flag] || 'Review suggested')
