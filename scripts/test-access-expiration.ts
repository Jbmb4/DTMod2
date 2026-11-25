import assert from 'node:assert/strict';
import {
  accessExpirationInputSchema,
  calculateAccessExpiration,
  getAccessDaysRemaining,
  isAccessActive,
  isAccessExpired,
} from '../src/utils/access-expiration';

const base = new Date('2026-08-21T12:00:00.000Z');

const lifetimeInput = accessExpirationInputSchema.parse({
  access_type: 'lifetime',
  access_duration: 0,
  access_unit: 'months',
});
assert.equal(calculateAccessExpiration(lifetimeInput, base), null);
assert.throws(() => accessExpirationInputSchema.parse({ access_type: 'duration' }));
assert.equal(
  calculateAccessExpiration({ access_type: 'duration', access_duration: 10, access_unit: 'days' }, base)?.toISOString(),
  '2026-08-31T12:00:00.000Z'
);
assert.equal(
  calculateAccessExpiration(
    { access_type: 'duration', access_duration: 2, access_unit: 'months' },
    base
  )?.toISOString(),
  '2026-10-21T12:00:00.000Z'
);
assert.equal(
  calculateAccessExpiration({ access_type: 'duration', access_duration: 1, access_unit: 'years' }, base)?.toISOString(),
  '2027-08-21T12:00:00.000Z'
);

const activeDate = new Date('2026-08-22T00:00:00.000Z');
const expiredDate = new Date('2026-08-20T00:00:00.000Z');
assert.equal(isAccessActive(activeDate, base), true);
assert.equal(isAccessExpired(expiredDate, base), true);
assert.equal(isAccessActive(null, base), true);
assert.equal(
  getAccessDaysRemaining(
    calculateAccessExpiration({ access_type: 'duration', access_duration: 31, access_unit: 'days' }, base),
    base
  ),
  31
);
assert.equal(getAccessDaysRemaining(new Date(base.getTime() + 1), base), 1);
assert.equal(getAccessDaysRemaining(base, base), 0);
assert.equal(getAccessDaysRemaining('data-invalida', base), null);
assert.equal(getAccessDaysRemaining(null, base), null);

console.log('access-expiration tests passed');
