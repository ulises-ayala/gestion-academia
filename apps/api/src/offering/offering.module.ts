import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CATALOG_REPOSITORY } from './application/catalog.repository';
import { CatalogService } from './application/catalog.service';
import { CLASS_REPOSITORY } from './application/class.repository';
import { ClassesService } from './application/classes.service';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository';
import { PrismaClassRepository } from './infrastructure/prisma-class.repository';
import { BranchesController } from './presentation/branches.controller';
import { ClassesController } from './presentation/classes.controller';
import { DanceTypesController } from './presentation/dance-types.controller';
import { RoomsController } from './presentation/rooms.controller';
@Module({ imports: [DatabaseModule], controllers: [DanceTypesController, BranchesController, RoomsController, ClassesController], providers: [CatalogService, ClassesService, PrismaCatalogRepository, PrismaClassRepository, { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository }, { provide: CLASS_REPOSITORY, useExisting: PrismaClassRepository }] })
export class OfferingModule {}
