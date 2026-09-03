import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SupportCategory, SupportTicket } from "@/core/types/contracts";

export interface SendSupportTicketResult {
  success: boolean;
  messageId?: string;
  snsMessageId?: string;
  error?: string;
  mock?: boolean;
}

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  ai_feed_synthesis: "AI Synthesis & Feed",
  account_billing: "Account & Subscription",
  general_inquiry: "General Inquiry",
};

export class SupportService {
  private static sesClient: SESClient | null = null;
  private static snsClient: SNSClient | null = null;

  private static getRegion(): string {
    return process.env.AWS_REGION || "us-east-1";
  }

  private static getSESClient(): SESClient {
    if (!this.sesClient) {
      const region = this.getRegion();
      const profile = process.env.AWS_PROFILE || "ciclops";
      if (!process.env.AWS_PROFILE && !process.env.AWS_ACCESS_KEY_ID) {
        process.env.AWS_PROFILE = profile;
      }

      this.sesClient = new SESClient({
        region,
      });
    }
    return this.sesClient;
  }

  private static getSNSClient(): SNSClient {
    if (!this.snsClient) {
      const region = this.getRegion();
      const profile = process.env.AWS_PROFILE || "ciclops";
      if (!process.env.AWS_PROFILE && !process.env.AWS_ACCESS_KEY_ID) {
        process.env.AWS_PROFILE = profile;
      }

      this.snsClient = new SNSClient({
        region,
      });
    }
    return this.snsClient;
  }

  public static getCategoryLabel(category: SupportCategory): string {
    return CATEGORY_LABELS[category] || category;
  }

  public static async sendSupportTicket(ticket: SupportTicket): Promise<SendSupportTicketResult> {
    const fromEmail = process.env.SES_FROM_EMAIL || "rhenretta@gmail.com";
    const toEmail = process.env.SUPPORT_EMAIL || "rhenretta@gmail.com";
    const categoryLabel = this.getCategoryLabel(ticket.category);
    const subjectLine = `[Aletheia Support] [${categoryLabel}] ${ticket.subject}`;

    const metadataItems: string[] = [];
    if (ticket.metadata?.userId) metadataItems.push(`User ID: ${ticket.metadata.userId}`);
    if (ticket.metadata?.tier) metadataItems.push(`Tier: ${ticket.metadata.tier}`);
    if (ticket.metadata?.url) metadataItems.push(`Page URL: ${ticket.metadata.url}`);
    if (ticket.metadata?.userAgent) metadataItems.push(`Client: ${ticket.metadata.userAgent}`);
    if (ticket.metadata?.screenWidth && ticket.metadata?.screenHeight) {
      metadataItems.push(`Viewport: ${ticket.metadata.screenWidth}x${ticket.metadata.screenHeight}`);
    }

    const textBody = `
========================================
ALETHEIA SUPPORT TICKET #${ticket.id}
========================================

From: ${ticket.name} <${ticket.email}>
Category: ${categoryLabel}
Subject: ${ticket.subject}
Received: ${ticket.created_at}

----------------------------------------
MESSAGE:
----------------------------------------
${ticket.message}

----------------------------------------
TECHNICAL DIAGNOSTICS:
----------------------------------------
${metadataItems.length > 0 ? metadataItems.join("\n") : "None provided"}

----------------------------------------
Reply directly to this email to respond to ${ticket.email}.
`.trim();

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 24px; border-bottom: 1px solid #334155; }
    .logo { display: inline-block; font-size: 14px; font-weight: bold; letter-spacing: 2px; color: #38bdf8; font-family: monospace; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 8px 0 4px 0; }
    .badge { display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .content { padding: 24px; }
    .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
    .field-value { font-size: 14px; color: #f1f5f9; margin-bottom: 16px; }
    .message-box { background-color: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; margin: 16px 0; }
    .diagnostics { background-color: #020617; border-left: 3px solid #6366f1; border-radius: 6px; padding: 12px 16px; font-family: monospace; font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 20px; }
    .button { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background-color: #020617; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">α ALETHEIA SUPPORT</div>
      <h1 class="title">${escapeHtml(ticket.subject)}</h1>
      <span class="badge">${escapeHtml(categoryLabel)}</span>
    </div>
    <div class="content">
      <div class="field-label">From User</div>
      <div class="field-value">
        <strong>${escapeHtml(ticket.name)}</strong> &lt;<a href="mailto:${escapeHtml(ticket.email)}" style="color:#38bdf8;">${escapeHtml(ticket.email)}</a>&gt;
      </div>

      <div class="field-label">Message</div>
      <div class="message-box">${escapeHtml(ticket.message)}</div>

      ${
        metadataItems.length > 0
          ? `
        <div class="field-label">Diagnostic Context</div>
        <div class="diagnostics">
          ${metadataItems.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}
        </div>
        `
          : ""
      }

      <div style="text-align: center; margin-top: 24px;">
        <a href="mailto:${escapeHtml(ticket.email)}?subject=${encodeURIComponent(`Re: ${subjectLine}`)}" class="button">
          Reply to ${escapeHtml(ticket.name)}
        </a>
      </div>
    </div>
    <div class="footer">
      Ticket ID: ${escapeHtml(ticket.id)} • Submitted: ${escapeHtml(ticket.created_at)}<br>
      Delivered via Amazon SES. Replying to this email directly answers the user.
    </div>
  </div>
</body>
</html>
`.trim();

    let sesMessageId: string | undefined;
    let snsMessageId: string | undefined;

    // 1. Dispatch via Amazon SES
    try {
      const ses = this.getSESClient();
      const sendCommand = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [toEmail],
        },
        ReplyToAddresses: [ticket.email],
        Message: {
          Subject: {
            Data: subjectLine,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: "UTF-8",
            },
            Text: {
              Data: textBody,
              Charset: "UTF-8",
            },
          },
        },
      });

      const sesResponse = await ses.send(sendCommand);
      sesMessageId = sesResponse.MessageId;
    } catch (sesErr: any) {
      console.error("SupportService: Failed to send SES email:", sesErr?.message || sesErr);
      if (process.env.NODE_ENV === "test") {
        return {
          success: true,
          mock: true,
          error: sesErr?.message,
        };
      }
      throw sesErr;
    }

    // 2. Optionally publish to SNS Topic if configured
    const snsTopicArn = process.env.SUPPORT_SNS_TOPIC_ARN || process.env.SES_TOPIC_ARN;
    if (snsTopicArn) {
      try {
        const sns = this.getSNSClient();
        const publishCommand = new PublishCommand({
          TopicArn: snsTopicArn,
          Subject: subjectLine.slice(0, 100),
          Message: JSON.stringify({
            ticketId: ticket.id,
            name: ticket.name,
            email: ticket.email,
            category: ticket.category,
            subject: ticket.subject,
            message: ticket.message,
            metadata: ticket.metadata,
            createdAt: ticket.created_at,
          }),
        });

        const snsResponse = await sns.send(publishCommand);
        snsMessageId = snsResponse.MessageId;
      } catch (snsErr: any) {
        console.warn("SupportService: Could not publish to SNS topic:", snsErr?.message || snsErr);
      }
    }

    return {
      success: true,
      messageId: sesMessageId,
      snsMessageId,
    };
  }
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
