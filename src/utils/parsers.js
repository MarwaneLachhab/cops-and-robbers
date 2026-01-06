// Helper to safely parse players (handle both string and object)
export function parsePlayers(players) {
  if (!players) return [];
  if (typeof players === 'string') {
    try {
      return JSON.parse(players);
    } catch (e) {
      console.error('Error parsing players string:', e);
      return [];
    }
  }
  if (Array.isArray(players)) {
    return players;
  }
  return [];
}
