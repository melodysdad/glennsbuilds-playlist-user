/**
 * Tests for suppression management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SuppressionManager } from '../../src/tools/manage-suppressions.js';
import { LocalStorage } from '../../src/storage/local-storage.js';
import { TEST_DATA_DIR } from '../setup.js';

describe('SuppressionManager', () => {
  let storage: LocalStorage;
  let manager: SuppressionManager;

  beforeEach(() => {
    storage = new LocalStorage(TEST_DATA_DIR);
    manager = new SuppressionManager(storage);
  });

  describe('addSuppression', () => {
    it('should add a genre suppression', async () => {
      const result = await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'country',
        days: 30,
      });

      expect(result.type).toBe('genre');
      expect(result.value).toBe('country');
      expect(result.createdAt).toBeDefined();
      expect(result.until).toBeDefined();

      // Verify until date is ~30 days from now
      const untilDate = new Date(result.until);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      const diffMs = Math.abs(untilDate.getTime() - expectedDate.getTime());
      expect(diffMs).toBeLessThan(1000); // Within 1 second
    });

    it('should add an artist suppression', async () => {
      const result = await manager.addSuppression({
        userId: 'user123',
        type: 'artist',
        value: 'Taylor Swift',
        days: 7,
      });

      expect(result.type).toBe('artist');
      expect(result.value).toBe('Taylor Swift');
    });

    it('should add a tag suppression', async () => {
      const result = await manager.addSuppression({
        userId: 'user123',
        type: 'tag',
        value: 'party',
        days: 14,
      });

      expect(result.type).toBe('tag');
      expect(result.value).toBe('party');
    });

    it('should add multiple suppressions for same user', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'country',
        days: 30,
      });

      await manager.addSuppression({
        userId: 'user123',
        type: 'artist',
        value: 'Artist 1',
        days: 7,
      });

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(2);
    });
  });

  describe('getActiveSuppressions', () => {
    it('should return empty array for user with no suppressions', async () => {
      const result = await manager.getActiveSuppressions('user123');
      expect(result).toEqual([]);
    });

    it('should return only active suppressions', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'active',
        days: 30,
      });

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0].value).toBe('active');
    });
  });

  describe('removeSuppression', () => {
    it('should remove a specific suppression', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'country',
        days: 30,
      });

      await manager.addSuppression({
        userId: 'user123',
        type: 'artist',
        value: 'Artist 1',
        days: 30,
      });

      await manager.removeSuppression('user123', 'genre', 'country');

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0].type).toBe('artist');
    });

    it('should be case-insensitive when removing', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'Country',
        days: 30,
      });

      await manager.removeSuppression('user123', 'genre', 'country');

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(0);
    });

    it('should do nothing if suppression does not exist', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'jazz',
        days: 30,
      });

      await manager.removeSuppression('user123', 'genre', 'rock');

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0].value).toBe('jazz');
    });
  });

  describe('clearAllSuppressions', () => {
    it('should remove all suppressions for a user', async () => {
      await manager.addSuppression({
        userId: 'user123',
        type: 'genre',
        value: 'country',
        days: 30,
      });

      await manager.addSuppression({
        userId: 'user123',
        type: 'artist',
        value: 'Artist 1',
        days: 30,
      });

      await manager.clearAllSuppressions('user123');

      const suppressions = await manager.getActiveSuppressions('user123');
      expect(suppressions).toHaveLength(0);
    });
  });

  describe('formatSuppressions', () => {
    it('should format empty suppressions list', () => {
      const result = manager.formatSuppressions([]);
      expect(result).toBe('No active suppressions');
    });

    it('should format single suppression', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const suppressions = [
        {
          type: 'genre' as const,
          value: 'country',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      const result = manager.formatSuppressions(suppressions);
      expect(result).toContain('genre');
      expect(result).toContain('country');
      expect(result).toContain('30 days');
    });

    it('should format multiple suppressions', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      const suppressions = [
        {
          type: 'genre' as const,
          value: 'country',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          type: 'artist' as const,
          value: 'Artist 1',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      const result = manager.formatSuppressions(suppressions);
      expect(result).toContain('country');
      expect(result).toContain('Artist 1');
      expect(result.split('\n')).toHaveLength(2);
    });
  });
});
