import type {
  CreateEnrollmentBillingConditionDto,
  EndEnrollmentBillingConditionDto,
  ReverseMonthlyChargeAdjustmentDto,
} from '@academy/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parseUuid } from '../../shared/presentation/request-validation';
import { BillingAdjustmentsService } from '../application/billing-adjustments.service';

@Controller()
export class BillingAdjustmentsController {
  constructor(private readonly service: BillingAdjustmentsService) {}

  @Get('enrollments/:id/billing-conditions')
  @Permissions('charges:read')
  list(@Param('id') id: string) {
    return this.service.list(parseUuid(id));
  }

  @Post('enrollments/:id/billing-conditions')
  @Permissions('charges:manage')
  create(
    @Param('id') id: string,
    @Body() input: CreateEnrollmentBillingConditionDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.create(parseUuid(id), input, actor);
  }

  @Post('billing-conditions/:id/end')
  @Permissions('charges:manage')
  end(
    @Param('id') id: string,
    @Body() input: EndEnrollmentBillingConditionDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.end(parseUuid(id), input, actor);
  }

  @Post('billing-conditions/:id/renew')
  @Permissions('charges:manage')
  renew(
    @Param('id') id: string,
    @Body() input: CreateEnrollmentBillingConditionDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.renew(parseUuid(id), input, actor);
  }

  @Post('monthly-charges/:chargeId/adjustments/:adjustmentId/reverse')
  @Permissions('charges:manage')
  reverse(
    @Param('chargeId') chargeId: string,
    @Param('adjustmentId') adjustmentId: string,
    @Body() input: ReverseMonthlyChargeAdjustmentDto,
    @CurrentUser() actor: PublicAuthUser,
  ) {
    return this.service.reverse(
      parseUuid(chargeId, 'chargeId'),
      parseUuid(adjustmentId, 'adjustmentId'),
      input.reason,
      actor,
    );
  }
}
