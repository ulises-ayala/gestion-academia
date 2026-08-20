import type { Branch, DanceType, Room } from '@academy/database';
export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';
export type RoomWithBranch = Room & { branch: Pick<Branch, 'id' | 'name'> };
export interface CatalogRepository {
  listDanceTypes(status?: CatalogStatus): Promise<DanceType[]>; findDanceType(id: string): Promise<DanceType | null>; findDanceTypeByNormalizedName(name: string): Promise<DanceType | null>; createDanceType(data: Omit<DanceType, 'id' | 'createdAt' | 'updatedAt'>): Promise<DanceType>; updateDanceType(id: string, data: Omit<DanceType, 'id' | 'createdAt' | 'updatedAt'>): Promise<DanceType>; danceTypeHasActiveClasses(id: string): Promise<boolean>;
  listBranches(status?: CatalogStatus): Promise<Branch[]>; findBranch(id: string): Promise<Branch | null>; createBranch(data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch>; updateBranch(id: string, data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch>; branchHasActiveRooms(id: string): Promise<boolean>;
  listRooms(status?: CatalogStatus, branchId?: string): Promise<RoomWithBranch[]>; findRoom(id: string): Promise<RoomWithBranch | null>; createRoom(data: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomWithBranch>; updateRoom(id: string, data: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomWithBranch>; roomHasActiveSchedules(id: string): Promise<boolean>;
}
