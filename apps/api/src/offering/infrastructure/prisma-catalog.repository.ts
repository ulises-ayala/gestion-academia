import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CatalogRepository } from '../application/catalog.repository';
@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  listDanceTypes(status?: 'ACTIVE' | 'INACTIVE') { return this.prisma.danceType.findMany({ where: status ? { status } : {}, orderBy: { name: 'asc' } }); }
  findDanceType(id: string) { return this.prisma.danceType.findUnique({ where: { id } }); }
  findDanceTypeByNormalizedName(normalizedName: string) { return this.prisma.danceType.findUnique({ where: { normalizedName } }); }
  createDanceType(data: Parameters<typeof this.prisma.danceType.create>[0]['data']) { return this.prisma.danceType.create({ data }); }
  updateDanceType(id: string, data: Parameters<typeof this.prisma.danceType.update>[0]['data']) { return this.prisma.danceType.update({ where: { id }, data }); }
  async danceTypeHasActiveClasses(id: string) { return (await this.prisma.academyClass.count({ where: { danceTypeId: id, status: 'ACTIVE' } })) > 0; }
  listBranches(status?: 'ACTIVE' | 'INACTIVE') { return this.prisma.branch.findMany({ where: status ? { status } : {}, orderBy: { name: 'asc' } }); }
  findBranch(id: string) { return this.prisma.branch.findUnique({ where: { id } }); }
  createBranch(data: Parameters<typeof this.prisma.branch.create>[0]['data']) { return this.prisma.branch.create({ data }); }
  updateBranch(id: string, data: Parameters<typeof this.prisma.branch.update>[0]['data']) { return this.prisma.branch.update({ where: { id }, data }); }
  async branchHasActiveRooms(id: string) { return (await this.prisma.room.count({ where: { branchId: id, status: 'ACTIVE' } })) > 0; }
  listRooms(status?: 'ACTIVE' | 'INACTIVE', branchId?: string) { return this.prisma.room.findMany({ where: { ...(status ? { status } : {}), ...(branchId ? { branchId } : {}) }, include: { branch: { select: { id: true, name: true } } }, orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }] }); }
  findRoom(id: string) { return this.prisma.room.findUnique({ where: { id }, include: { branch: { select: { id: true, name: true } } } }); }
  createRoom(data: Parameters<typeof this.prisma.room.create>[0]['data']) { return this.prisma.room.create({ data, include: { branch: { select: { id: true, name: true } } } }); }
  updateRoom(id: string, data: Parameters<typeof this.prisma.room.update>[0]['data']) { return this.prisma.room.update({ where: { id }, data, include: { branch: { select: { id: true, name: true } } } }); }
  async roomHasActiveSchedules(id: string) { return (await this.prisma.classSchedule.count({ where: { roomId: id, status: 'ACTIVE', class: { status: 'ACTIVE' } } })) > 0; }
}
