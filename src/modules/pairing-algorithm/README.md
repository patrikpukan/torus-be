# Pairing Algorithm

## Overview
The pairing algorithm automatically matches users within an organization into pairs for each period. It ensures fairness, respects user preferences (blocking), and avoids repetitive pairings.

## How It Works

### Algorithm Steps
1. **Initialization**
   - Load algorithm settings (period length, random seed)
   - Get or create current active period
   - Fetch all eligible users (active, not suspended, not already paired)

2. **Identify Guaranteed Users**
   - New users (never paired before)
   - Users who were unpaired in the previous period

3. **Fetch Constraints**
   - User blocking relationships (bidirectional)
   - Pairing history (last 2 periods)

4. **Pairing Process**
   - Shuffle users using seeded random generator
   - Pair guaranteed users first
   - Pair remaining users
   - Avoid pairs from last 2 periods when possible
   - Never pair users who block each other
   - Never create same pair 3 times in a row (exception: only 2 users)

5. **Save Results**
   - Store all pairings in database
   - Mark unpaired users (if odd number)
   - Log summary statistics

## Guarantees

### ✅ New User Guarantee
New users are always paired in their first available period (unless blocking constraints make it impossible).

### ✅ Unpaired User Guarantee
If a user wasn't paired in the previous period, they are guaranteed to be paired in the next period.

### ✅ Blocking Respect
Users will never be paired with someone they've blocked or who has blocked them.

### ✅ History Constraint
- Low probability of same pair appearing in 2 consecutive periods
- Never same pair 3 times in a row (unless only 2 users exist)

## Configuration

### Algorithm Settings
````graphql
mutation UpdateSettings {
  updateAlgorithmSettings(input: {
    organizationId: "org-uuid"
    periodLengthDays: 21
    randomSeed: 12345
  }) {
    id
    periodLengthDays
    randomSeed
    warning
  }
}
````

**Parameters:**
- `periodLengthDays`: Duration of each pairing period (default: 21 days)
  - Warning if < 7 days (too short, frequent changes)
  - Warning if > 365 days (too long, low engagement)
- `randomSeed`: Seed for random number generator (ensures reproducibility)

### Environment Variables
````env
PAIRING_CRON_ENABLED=true
PAIRING_CRON_SCHEDULE="0 0 * * 1"  # Every Monday at midnight
PAIRING_DEFAULT_PERIOD_DAYS=21
PAIRING_MIN_PERIOD_DAYS=7
PAIRING_MAX_PERIOD_DAYS=365
````

## Manual Execution

Admins can manually trigger pairing:
````graphql
mutation ExecutePairing {
  executePairingAlgorithm(organizationId: "org-uuid") {
    success
    pairingsCreated
    message
    unpairedUsers
  }
}
````

## Automatic Execution

The algorithm runs automatically via cron job (configurable schedule). For each organization:
1. Check if current period has ended
2. Close the period (status → 'completed')
3. Execute pairing for new period
4. Log results

## Edge Cases

### Odd Number of Users
One user will remain unpaired and receive guarantee for next period.

### Only 2 Users
The 3-period repetition rule is suspended. Same pair can be created indefinitely.

### All Partners Blocked
If a user has blocked all potential partners, they remain unpaired and receive guarantee.

### Impossible Constraints
If constraints cannot be satisfied (e.g., circular blocking), the algorithm will fail gracefully with detailed error message.

## Performance

- **Time Complexity**: O(n²) worst case, O(n log n) average
- **100 users**: < 1 second
- **1000 users**: < 5 seconds

## Future Improvements

- [ ] Weighted pairing based on user preferences
- [ ] Skill-based matching
- [ ] Location-based pairing
- [ ] Machine learning for optimal pairs
- [ ] Support for group pairing (3+ people)

## Testing
````bash
# Unit tests
npm test -- pairing-algorithm.service.spec

# Integration tests
npm test -- integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
````
