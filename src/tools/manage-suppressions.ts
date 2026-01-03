/**
 * Temporal suppression management
 * Handles snoozing genres, artists, or tags for specified periods
 */

import { Suppression, AddSuppressionInput } from '../types.js';
import { StorageLayer } from '../storage/storage-interface.js';

export class SuppressionManager {
  constructor(private storage: StorageLayer) {}

  async addSuppression(input: AddSuppressionInput): Promise<Suppression> {
    const { userId, type, value, days } = input;

    // Calculate expiration date
    const until = new Date();
    until.setDate(until.getDate() + days);

    const suppression: Suppression = {
      type,
      value,
      until: until.toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Load existing suppressions
    const suppressions = await this.getAllSuppressions(userId);

    // Add new suppression
    suppressions.push(suppression);

    // Save back to storage
    await this.storage.saveSuppressions(userId, suppressions);

    return suppression;
  }

  async getActiveSuppressions(userId: string): Promise<Suppression[]> {
    return this.storage.getActiveSuppressions(userId);
  }

  async getAllSuppressions(userId: string): Promise<Suppression[]> {
    return this.storage.getAllSuppressions(userId);
  }

  async removeSuppression(
    userId: string,
    type: string,
    value: string
  ): Promise<void> {
    const suppressions = await this.getAllSuppressions(userId);

    // Filter out the specified suppression
    const filtered = suppressions.filter(
      (s) => !(s.type === type && s.value.toLowerCase() === value.toLowerCase())
    );

    await this.storage.saveSuppressions(userId, filtered);
  }

  async clearAllSuppressions(userId: string): Promise<void> {
    await this.storage.saveSuppressions(userId, []);
  }

  /**
   * Format suppressions for display
   */
  formatSuppressions(suppressions: Suppression[]): string {
    if (suppressions.length === 0) {
      return 'No active suppressions';
    }

    return suppressions
      .map((s) => {
        const until = new Date(s.until);
        const daysLeft = Math.ceil(
          (until.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return `${s.type}: "${s.value}" (${daysLeft} days remaining)`;
      })
      .join('\n');
  }
}
