import { Injectable } from '@nestjs/common';
import { RabbitService } from '../../common/rabbit/rabbit.service';
import { DatabaseService } from '../../common/db/db.service';
import { IHide_nameSubscriptionUpdateCallbackReceivedPayload, IHide_nameSubscriptionRenewCallbackReceivedPayload, IHide_nameSubscriptionCallbackOrderResolvedEventPayload } from '../../common/rabbit/interfaces';
import { Invoice, SubscriptionStatus } from '@prisma/client';
import { collectMetrics } from '../monitor/collectMetrics.decorator';
import { MonitorService } from '../monitor/monitor.service';
@Injectable()
export class SubscriptionService {
  constructor(private readonly db: DatabaseService, private readonly rabbitService: RabbitService, private readonly monitorService: MonitorService) {}

  @collectMetrics
  public async initSubscription(data: IHide_nameSubscriptionCallbackOrderResolvedEventPayload): Promise<void> {
    const { subscription: incomeSubscription, invoice } = data.incomeData;
    const { order } = data.pipelineData;

    const subscription = await this.db.subscription.create({
      data: {
        ...incomeSubscription,
        callbackUrl: order.callbackUrl,
        source: order.source,
      },
    });

    await this.db.invoice.create({
      data: { ...invoice, subscriptionId: subscription.subscriptionId },
    });

    await this.rabbitService.subscriptionInitedEvent({ ...data, pipelineData: { subscription } });
  }

  @collectMetrics
  public async renewSubscription(data: IHide_nameSubscriptionRenewCallbackReceivedPayload): Promise<void> {
    const { subscription: incomeSubscription, invoices } = data.incomeData;
    const subscriptionBeforeRenew = await this.db.subscription.findFirst({
      where: { subscriptionId: incomeSubscription.subscriptionId },
    });

    const [subscription] = await Promise.all([
      this.db.subscription.update({
        where: { subscriptionId: incomeSubscription.subscriptionId },
        data: { ...incomeSubscription },
      }),
      this.processInvoices(invoices),
    ]);
    const didTrialJustEnded = Boolean(subscriptionBeforeRenew?.isTrial && !subscription.isTrial);

    if (didTrialJustEnded) {
      this.rabbitService.hide_nameSubscriptionTrialPeriodEndedEvent({ ...data, pipelineData: { subscription } });
    }

    await this.rabbitService.hide_nameSubscriptionRenewCallbackSubscriptionUpdatedEvent({ ...data, pipelineData: { subscription } });
  }

  @collectMetrics
  public async cancelSubscription(data: IHide_nameSubscriptionUpdateCallbackReceivedPayload): Promise<void> {
    const { subscription: incomeSubscription, invoices } = data.incomeData;

    const [subscription] = await Promise.all([
      this.db.subscription.update({
        where: { subscriptionId: incomeSubscription.subscriptionId },
        data: incomeSubscription,
      }),
      this.processInvoices(invoices),
    ]);

    await this.rabbitService.subscriptionCanceledEvent({ ...data, pipelineData: { subscription } });
  }

  @collectMetrics
  public async updateSubscription(data: IHide_nameSubscriptionUpdateCallbackReceivedPayload): Promise<void> {
    const { subscription: incomeSubscription, invoices } = data.incomeData;

    const softCancelledAt = await this.getSoftCancelledAt(data);

    const [subscription] = await Promise.all([
      this.db.subscription.update({
        where: { subscriptionId: incomeSubscription.subscriptionId },
        data: { ...incomeSubscription, softCancelledAt },
      }),
      this.processInvoices(invoices),
    ]);

    await this.rabbitService.subscriptionUpdatedEvent({ ...data, pipelineData: { subscription } });
  }

  private async getSoftCancelledAt(data: IHide_nameSubscriptionUpdateCallbackReceivedPayload): Promise<Date | null> {
    const { subscriptionId, cancelledAt } = data.incomeData.subscription;

    if (!cancelledAt) return null;

    const subscription = await this.db.subscription.findUnique({ where: { subscriptionId } });

    if (subscription?.softCancelledAt) return subscription.softCancelledAt;
    if (subscription?.status === SubscriptionStatus.CANCELED) return null;

    return new Date();
  }

  @collectMetrics
  private async processInvoices(invoices: Invoice[]): Promise<void> {
    await Promise.all(
      invoices.map(async (invoice) => {
        await this.db.invoice.upsert({
          where: {
            invoiceId: invoice.invoiceId,
          },
          create: invoice,
          update: {},
        });
      }),
    );
  }
}
