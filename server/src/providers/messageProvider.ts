export interface CampaignDispatchRecipient {
  contactId: string;
  name: string;
  phoneE164: string;
}

export interface CampaignDispatchInput {
  restaurantId: string;
  restaurantName: string;
  campaignId: string;
  title: string;
  message: string;
  recipients: CampaignDispatchRecipient[];
  now: Date;
}

export interface CampaignDispatchResult {
  status: 'sending_not_connected';
  code: 'SENDING_NOT_CONNECTED';
  message: 'sending not connected yet';
  provider: string;
  recipientCount: number;
  loggedAt: string;
}

export interface MessageProvider {
  readonly name: string;
  sendCampaign(input: CampaignDispatchInput): Promise<CampaignDispatchResult>;
}

export class LogOnlyMessageProvider implements MessageProvider {
  public readonly name = 'log-only';

  async sendCampaign(input: CampaignDispatchInput): Promise<CampaignDispatchResult> {
    const loggedAt = input.now.toISOString();
    console.info(
      JSON.stringify({
        event: 'campaign.send.log_only',
        provider: this.name,
        restaurantId: input.restaurantId,
        campaignId: input.campaignId,
        title: input.title,
        recipientCount: input.recipients.length,
        status: 'sending_not_connected',
        loggedAt,
      })
    );
    return {
      status: 'sending_not_connected',
      code: 'SENDING_NOT_CONNECTED',
      message: 'sending not connected yet',
      provider: this.name,
      recipientCount: input.recipients.length,
      loggedAt,
    };
  }
}
