import { IHIDE_SYSTEM_NAMESubscriptionCallbackOrderResolvedEventPayload, IHIDE_SYSTEM_NAMESubscriptionRenewCallbackReceivedPayload, IHIDE_SYSTEM_NAMESubscriptionUpdateCallbackReceivedPayload } from '../../common/rabbit/interfaces';
import { Controller, UseFilters } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { Events } from '../../common/rabbit/constants';
import { AllExceptionsFilter } from '../../filters/allExceptionsFilter';
import { SubscriptionService } from './subscription.service';

@UseFilters(AllExceptionsFilter)
@Controller()
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @EventPattern(Events.HIDE_SYSTEM_NAME_SUBSCRIPTION_INIT_CALLBACK_ORDER_RESOLVED)
  async initSubscriptionEventHandler(data: IHIDE_SYSTEM_NAMESubscriptionCallbackOrderResolvedEventPayload): Promise<void> {
    await this.subscriptionService.initSubscription(data);
  }

  @EventPattern(Events.HIDE_SYSTEM_NAME_SUBSCRIPTION_RENEW_CALLBACK_RECEIVED)
  async renewSubscriptionEventHandler(data: IHIDE_SYSTEM_NAMESubscriptionRenewCallbackReceivedPayload): Promise<void> {
    await this.subscriptionService.renewSubscription(data);
  }

  @EventPattern(Events.HIDE_SYSTEM_NAME_SUBSCRIPTION_CANCEL_CALLBACK_RECEIVED)
  async cancelSubscriptionEventHandler(data: IHIDE_SYSTEM_NAMESubscriptionUpdateCallbackReceivedPayload): Promise<void> {
    await this.subscriptionService.cancelSubscription(data);
  }

  @EventPattern(Events.HIDE_SYSTEM_NAME_SUBSCRIPTION_UPDATE_CALLBACK_RECEIVED)
  async updateSubscriptionEventHandler(data: IHIDE_SYSTEM_NAMESubscriptionUpdateCallbackReceivedPayload): Promise<void> {
    await this.subscriptionService.updateSubscription(data);
  }
}
