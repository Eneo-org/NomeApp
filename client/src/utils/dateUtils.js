// src/utils/dateUtils.js

/**
 * Converte millisecondi in una stringa leggibile (Giorni, Ore, Minuti, Secondi)
 * @param {number} ms - Millisecondi rimanenti
 * @returns {string} - Es: "13g 5h 20m 10s"
 */
export const formatCooldownTime = (ms) => {
  if (ms <= 0) return '0s'

  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))

  let result = ''
  if (days > 0) result += `${days}g `
  if (hours > 0) result += `${hours}h `
  if (minutes > 0) result += `${minutes}m `
  result += `${seconds}s`

  return result.trim()
}
