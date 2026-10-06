import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseBody,
  clientIpFromRequest,
  decidePurchase,
  isCapiCronRequest,
  MISSING_CAPI_TOKEN_ERROR,
  outboxAfterFailure,
  normalizeMatchText,
  normalizePhoneForMeta,
  redactPurchaseBody,
  sha256Hex,
  sumDeliveriesContentsIls,
  websiteAttributionFromBody,
} from './capi.js';
import { whatsAppFirstTouch } from './waAttribution.js';

describe('normalizePhoneForMeta', () => {
  it('prefixes an Israeli mobile and drops the leading zero', () => {
    assert.equal(normalizePhoneForMeta('0521234567'), '972521234567');
  });

  it('keeps an existing 972 number', () => {
    assert.equal(normalizePhoneForMeta('+972-52-123-4567'), '972521234567');
  });

  it('returns empty for a blank phone', () => {
    assert.equal(normalizePhoneForMeta(''), '');
  });
});

describe('normalizeMatchText', () => {
  it('lowercases, strips punctuation, and collapses spaces', () => {
    assert.equal(normalizeMatchText('  John  Doe! '), 'john doe');
  });

  it('keeps Hebrew letters', () => {
    assert.equal(normalizeMatchText('יוסי, כהן'), 'יוסי כהן');
  });
});

describe('decidePurchase', () => {
  const base = { id: 'MSN-1', type: 'pickup', status: 'received' };

  it('enqueues only a pickup moving to completed with a positive value', () => {
    const decision = decidePurchase(base, { ...base, status: 'completed' }, { value: 120 });
    assert.equal(decision.action, 'enqueue');
    assert.equal(decision.eventId, 'deal_MSN-1_won');
  });

  it('ignores a save that is already completed', () => {
    const done = { ...base, status: 'completed' };
    assert.equal(decidePurchase(done, done, { value: 120 }).action, 'ignore');
  });

  it('ignores empty-box missions', () => {
    assert.equal(
      decidePurchase(
        { ...base, type: 'empty_box' },
        { ...base, type: 'empty_box', status: 'completed' },
        { value: 50 },
      ).action,
      'ignore',
    );
  });

  it('skips a zero value', () => {
    assert.equal(
      decidePurchase(base, { ...base, status: 'completed' }, { value: 0 }).action,
      'skip',
    );
  });

  it('does not enqueue again after a successful send', () => {
    const prev = { ...base, status: 'received' };
    const next = { ...base, status: 'completed', capi_status: 'sent', capi_event_id: 'deal_MSN-1_won' };
    assert.equal(decidePurchase(prev, next, { value: 80 }).action, 'ignore');
  });

  it('does not enqueue when a row is already pending', () => {
    assert.equal(
      decidePurchase(base, { ...base, status: 'completed' }, { value: 80, hasPending: true }).action,
      'ignore',
    );
  });
});

describe('buildPurchaseBody', () => {
  const mission = {
    id: 'MSN-9',
    customerPhone: '0521234567',
    fullName: 'Dana Levi',
    senderAddress: { city: 'Tel Aviv' },
    country: 'thailand',
    fbp: 'fb.1.1.abc',
    utm_campaign: 'spring',
  };

  it('hashes phone, name, city, and country, and leaves fbp plain', () => {
    const body = buildPurchaseBody({
      mission,
      externalId: 'USR-1',
      value: 40,
      eventTimeSec: 1_700_000_000,
      eventId: 'deal_MSN-9_won',
    });
    const event = body.data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.action_source, 'system_generated');
    assert.equal(event.messaging_channel, undefined);
    assert.equal(event.user_data.ph[0], sha256Hex('972521234567'));
    assert.equal(event.user_data.fn[0], sha256Hex('dana levi'));
    assert.equal(event.user_data.ct[0], sha256Hex('tel aviv'));
    assert.equal(event.user_data.country[0], sha256Hex('il'));
    assert.equal(event.user_data.external_id[0], sha256Hex('USR-1'));
    assert.equal(event.user_data.fbp, 'fb.1.1.abc');
    assert.equal(event.user_data.em, undefined);
    assert.equal(event.custom_data.currency, 'ILS');
    assert.equal(event.custom_data.value, 40);
    assert.equal(event.custom_data.content_category, 'thailand');
    assert.equal(event.custom_data.lead_channel, 'website');
    assert.equal(event.custom_data.utm_campaign, 'spring');
  });

  it('includes the landing url when the mission stored one', () => {
    const body = buildPurchaseBody({
      mission: {
        id: 'MSN-4',
        customerPhone: '0521234567',
        event_source_url: 'https://isa-express.com/?utm_campaign=spring',
      },
      value: 5,
      eventTimeSec: 10,
      eventId: 'deal_MSN-4_won',
    });
    assert.equal(body.data[0].event_source_url, 'https://isa-express.com/?utm_campaign=spring');
  });

  it('uses business_messaging when the lead has ctwa_clid', () => {
    const body = buildPurchaseBody({
      mission: { id: 'MSN-2', customerPhone: '0521234567', country: 'india' },
      lead: { ctwaClid: 'CLICK', channel: 'whatsapp', waSourceId: '99' },
      value: 10,
      eventTimeSec: 10,
      eventId: 'deal_MSN-2_won',
      wabaId: 'WABA1',
    });
    const event = body.data[0];
    assert.equal(event.action_source, 'business_messaging');
    assert.equal(event.messaging_channel, 'whatsapp');
    assert.equal(event.user_data.ctwa_clid, 'CLICK');
    assert.equal(event.user_data.whatsapp_business_account_id, 'WABA1');
    assert.equal(event.custom_data.lead_channel, 'whatsapp');
    assert.equal(event.custom_data.content_category, 'india');
  });

  it('omits a blank name instead of hashing it', () => {
    const body = buildPurchaseBody({
      mission: { id: 'MSN-3', customerPhone: '0521234567' },
      value: 5,
      eventTimeSec: 10,
      eventId: 'deal_MSN-3_won',
    });
    assert.equal(body.data[0].user_data.fn, undefined);
    assert.equal(body.data[0].user_data.ln, undefined);
    assert.equal(body.data[0].custom_data.lead_channel, undefined);
  });
});

describe('websiteAttributionFromBody', () => {
  it('keeps present fields and builds fbc from fbclid', () => {
    const saved = websiteAttributionFromBody({
      fbp: ' fb.1.1.p ',
      fbclid: 'IwAR123',
      utm_campaign: 'box',
      ignored: 'no',
    });
    assert.equal(saved.fbp, 'fb.1.1.p');
    assert.equal(saved.fbclid, 'IwAR123');
    assert.match(saved.fbc, /^fb\.1\.\d+\.IwAR123$/);
    assert.equal(saved.utm_campaign, 'box');
    assert.equal(saved.ignored, undefined);
  });
});

describe('whatsAppFirstTouch', () => {
  it('stores referral fields once and does not overwrite them', () => {
    const first = whatsAppFirstTouch({}, {
      referral: {
        ctwa_clid: 'CLICK1',
        source_id: '555',
        source_type: 'ad',
        source_url: 'https://fb.me/ad',
        headline: 'Ship to Thailand',
      },
    }, { display_phone_number: '055-309-0593' });
    assert.deepEqual(first, {
      channel: 'whatsapp',
      ctwaClid: 'CLICK1',
      waSourceId: '555',
      waSourceType: 'ad',
      waSourceUrl: 'https://fb.me/ad',
      waHeadline: 'Ship to Thailand',
      businessPhone: '055-309-0593',
    });
    const again = whatsAppFirstTouch({ ...first }, {
      referral: { ctwa_clid: 'CLICK2', source_id: '999' },
    }, { display_phone_number: '055-964-0862' });
    assert.deepEqual(again, {});
  });
});

describe('sumDeliveriesContentsIls', () => {
  it('sums qty times price', () => {
    const total = sumDeliveriesContentsIls([
      { boxContents: [[{ qty: 2, price: 10 }, { qty: 1, price: 5.5 }]] },
    ]);
    assert.equal(total, 25.5);
  });
});

describe('clientIpFromRequest', () => {
  it('uses the first forwarded address', () => {
    assert.equal(
      clientIpFromRequest({ headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' } }),
      '203.0.113.8',
    );
  });

  it('drops a header that is not an IP', () => {
    assert.equal(clientIpFromRequest({ headers: { 'x-forwarded-for': 'not an ip' }, ip: '' }), '');
  });
});

describe('outboxAfterFailure', () => {
  it('keeps the row pending when the token is not set yet', () => {
    const result = outboxAfterFailure({ attempts: 7, error: MISSING_CAPI_TOKEN_ERROR });
    assert.equal(result.status, 'pending');
    assert.equal(result.giveUp, false);
    assert.equal(result.attempts, 7);
  });

  it('fails permanently after repeated Meta errors', () => {
    const result = outboxAfterFailure({ attempts: 7, error: 'Meta HTTP 500' });
    assert.equal(result.status, 'failed');
    assert.equal(result.giveUp, true);
    assert.equal(result.attempts, 8);
  });
});

describe('isCapiCronRequest', () => {
  it('accepts a Vercel cron call without an extra secret', () => {
    assert.equal(isCapiCronRequest({
      headers: {
        'user-agent': 'vercel-cron/1.0',
        'x-vercel-cron-schedule': '*/5 * * * *',
      },
    }), true);
  });

  it('rejects a normal browser request', () => {
    assert.equal(isCapiCronRequest({ headers: { 'user-agent': 'Mozilla' } }), false);
  });
});

describe('redactPurchaseBody', () => {
  it('hides unhashed identifiers', () => {
    const redacted = redactPurchaseBody({
      data: [{ user_data: { ph: ['abc'], ctwa_clid: 'CLICK', fbp: 'fb.1', client_ip_address: '1.1.1.1' } }],
    });
    assert.equal(redacted.data[0].user_data.ph[0], 'abc');
    assert.equal(redacted.data[0].user_data.ctwa_clid, '<present>');
    assert.equal(redacted.data[0].user_data.fbp, '<present>');
    assert.equal(redacted.data[0].user_data.client_ip_address, '<present>');
  });
});
