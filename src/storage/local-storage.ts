/**
 * Local filesystem storage implementation
 * Stores data in data/users/{userId}/ directory structure
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  UserProfile,
  Suppression,
  PlaylistGeneration,
  MusicServiceCredentials,
} from '../types.js';
import { StorageLayer } from './storage-interface.js';

export class LocalStorage implements StorageLayer {
  private baseDir: string;

  constructor(baseDir: string = './data') {
    this.baseDir = baseDir;
  }

  /**
   * Get the user's base directory path
   */
  private getUserDir(userId: string): string {
    return path.join(this.baseDir, 'users', userId);
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Read a JSON file, returning null if it doesn't exist
   */
  private async readJSON<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write data to a JSON file
   */
  private async writeJSON<T>(filePath: string, data: T): Promise<void> {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // User Profile

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const profilePath = path.join(this.getUserDir(userId), 'profile.json');
    return this.readJSON<UserProfile>(profilePath);
  }

  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    const profilePath = path.join(this.getUserDir(userId), 'profile.json');
    await this.writeJSON(profilePath, profile);
  }

  // Suppressions

  async getActiveSuppressions(userId: string): Promise<Suppression[]> {
    const suppressions = await this.getAllSuppressions(userId);

    // Filter out expired suppressions
    const now = new Date();
    return suppressions.filter((s) => new Date(s.until) > now);
  }

  async getAllSuppressions(userId: string): Promise<Suppression[]> {
    const suppressionsPath = path.join(
      this.getUserDir(userId),
      'suppressions.json'
    );
    const suppressions = await this.readJSON<Suppression[]>(suppressionsPath);

    return suppressions || [];
  }

  async saveSuppressions(
    userId: string,
    suppressions: Suppression[]
  ): Promise<void> {
    const suppressionsPath = path.join(
      this.getUserDir(userId),
      'suppressions.json'
    );
    await this.writeJSON(suppressionsPath, suppressions);
  }

  // Playlist History

  async savePlaylistGeneration(
    userId: string,
    playlist: PlaylistGeneration
  ): Promise<void> {
    const playlistsDir = path.join(this.getUserDir(userId), 'playlists');
    await this.ensureDir(playlistsDir);

    // Use playlistId for filename to ensure uniqueness and avoid race conditions
    const filename = `${playlist.playlistId}.json`;
    const playlistPath = path.join(playlistsDir, filename);
    await this.writeJSON(playlistPath, playlist);
  }

  async getPlaylistHistory(
    userId: string,
    limit: number = 10
  ): Promise<PlaylistGeneration[]> {
    const playlistsDir = path.join(this.getUserDir(userId), 'playlists');

    try {
      const files = await fs.readdir(playlistsDir);

      // Read all playlists
      const playlists: PlaylistGeneration[] = [];
      for (const file of files) {
        const playlist = await this.readJSON<PlaylistGeneration>(
          path.join(playlistsDir, file)
        );
        if (playlist) {
          playlists.push(playlist);
        }
      }

      // Sort by generatedAt timestamp descending (newest first)
      playlists.sort((a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );

      return playlists.slice(0, limit);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  // Service Credentials

  async getServiceCredentials(
    userId: string,
    service: string
  ): Promise<MusicServiceCredentials | null> {
    const servicesDir = path.join(this.getUserDir(userId), 'services');
    const credPath = path.join(servicesDir, `${service}.json`);
    return this.readJSON<MusicServiceCredentials>(credPath);
  }

  async saveServiceCredentials(
    userId: string,
    credentials: MusicServiceCredentials
  ): Promise<void> {
    const servicesDir = path.join(this.getUserDir(userId), 'services');
    await this.ensureDir(servicesDir);

    const credPath = path.join(servicesDir, `${credentials.service}.json`);
    await this.writeJSON(credPath, credentials);
  }
}
