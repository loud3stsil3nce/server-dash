import assert from 'node:assert/strict';
import {
  getRecommendedJavaVersion,
  parseProperties,
  serializeProperties,
} from '../services/minecraftService.js';

export async function runMinecraftServiceTests() {
  console.log('🧪 Testing Minecraft Service...');

  // Test 1: Java Version Recommendation
  assert.equal(getRecommendedJavaVersion('1.20.5'), 'java21', '1.20.5 should recommend java21');
  assert.equal(getRecommendedJavaVersion('1.20.4'), 'java17', '1.20.4 should recommend java17');
  assert.equal(getRecommendedJavaVersion('1.17.1'), 'java17', '1.17.1 should recommend java17');
  assert.equal(getRecommendedJavaVersion('1.12.2'), 'java8', '1.12.2 should recommend java8');
  assert.equal(getRecommendedJavaVersion('26.0'), 'java25', '26.0 should recommend java25');
  console.log('  ✓ getRecommendedJavaVersion test passed');

  // Test 2: Properties Parser
  const rawProps = `
# Minecraft server properties
gamemode=survival
difficulty=hard
pvp=true
motd=Zenbook Server
  `;

  const parsed = parseProperties(rawProps);
  assert.equal(parsed.gamemode, 'survival');
  assert.equal(parsed.difficulty, 'hard');
  assert.equal(parsed.pvp, 'true');
  assert.equal(parsed.motd, 'Zenbook Server');
  console.log('  ✓ parseProperties test passed');

  // Test 3: Properties Serializer
  const serialized = serializeProperties(parsed);
  assert.ok(serialized.includes('gamemode=survival'));
  assert.ok(serialized.includes('difficulty=hard'));
  console.log('  ✓ serializeProperties test passed');
}
