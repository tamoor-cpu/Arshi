const crypto = require('crypto');

/**
 * Dispatch a webhook event to all matching endpoints for a tenant.
 * Fire-and-forget — errors are logged but don't break the caller.
 */
async function dispatchWebhook(prisma, tenantId, event, payload) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId, isActive: true },
    });

    for (const ep of endpoints) {
      const events = JSON.parse(ep.events || '[]');
      // Match if endpoint subscribes to this event or to '*' (all)
      if (!events.includes(event) && !events.includes('*')) continue;

      deliverWebhook(prisma, ep, event, payload).catch((err) => {
        console.error(`[Webhook] Delivery failed for ${ep.id}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[Webhook] Dispatch error:', err.message);
  }
}

/**
 * Deliver a single webhook to an endpoint with HMAC-SHA256 signature.
 */
async function deliverWebhook(prisma, endpoint, event, payload) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = crypto
    .createHmac('sha256', endpoint.signingSecret)
    .update(body)
    .digest('hex');

  let delivery;
  try {
    delivery = await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: endpoint.id,
        event,
        payload: body,
        attemptCount: 1,
      },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WashOps-Signature': `sha256=${signature}`,
        'X-WashOps-Event': event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => '');

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: response.status,
        responseBody: responseBody.slice(0, 1000),
        deliveredAt: new Date(),
      },
    });

    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { lastDeliveryAt: new Date() },
    });
  } catch (err) {
    if (delivery) {
      // Schedule retry with exponential backoff
      const retryDelays = [60, 300, 1800]; // 1m, 5m, 30m
      const attempt = delivery.attemptCount;
      const nextRetry = attempt < retryDelays.length
        ? new Date(Date.now() + retryDelays[attempt] * 1000)
        : null;

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: 0,
          responseBody: err.message?.slice(0, 500) || 'Unknown error',
          nextRetryAt: nextRetry,
        },
      }).catch(() => {});
    }
  }
}

/**
 * Retry pending webhook deliveries (called by cron).
 */
async function retryPendingWebhooks(prisma) {
  try {
    const pending = await prisma.webhookDelivery.findMany({
      where: {
        nextRetryAt: { lte: new Date() },
        deliveredAt: null,
        attemptCount: { lt: 4 }, // max 3 retries
      },
      include: {
        webhookEndpoint: true,
      },
      take: 50,
    });

    for (const delivery of pending) {
      if (!delivery.webhookEndpoint?.isActive) {
        // Endpoint deactivated — cancel retry
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { nextRetryAt: null },
        });
        continue;
      }

      const payload = JSON.parse(delivery.payload || '{}');
      const body = delivery.payload;
      const signature = crypto
        .createHmac('sha256', delivery.webhookEndpoint.signingSecret)
        .update(body)
        .digest('hex');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(delivery.webhookEndpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WashOps-Signature': `sha256=${signature}`,
            'X-WashOps-Event': delivery.event,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseBody = await response.text().catch(() => '');

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            statusCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            deliveredAt: new Date(),
            attemptCount: delivery.attemptCount + 1,
            nextRetryAt: null,
          },
        });
      } catch (err) {
        const retryDelays = [60, 300, 1800];
        const attempt = delivery.attemptCount;
        const nextRetry = attempt < retryDelays.length
          ? new Date(Date.now() + retryDelays[attempt] * 1000)
          : null;

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attemptCount: delivery.attemptCount + 1,
            nextRetryAt: nextRetry,
            responseBody: err.message?.slice(0, 500) || 'Retry failed',
          },
        }).catch(() => {});
      }
    }

    if (pending.length > 0) {
      console.log(`[Webhook] Retried ${pending.length} pending deliveries`);
    }
  } catch (err) {
    console.error('[Webhook] Retry error:', err.message);
  }
}

module.exports = { dispatchWebhook, retryPendingWebhooks };
