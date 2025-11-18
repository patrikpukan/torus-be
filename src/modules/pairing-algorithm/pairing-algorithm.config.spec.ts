import type { PairingAlgorithmConfig as PairingAlgorithmConfigType } from './pairing-algorithm.config';

describe('PairingAlgorithmConfig', () => {
  const originalEnv = process.env;

  const resetEnv = () => {
    process.env = { ...originalEnv } as NodeJS.ProcessEnv;
    delete process.env.PAIRING_CRON_ENABLED;
    delete process.env.PAIRING_CRON_SCHEDULE;
    delete process.env.PAIRING_DEFAULT_PERIOD_DAYS;
    delete process.env.PAIRING_MIN_PERIOD_DAYS;
    delete process.env.PAIRING_MAX_PERIOD_DAYS;
  };

  const loadConfig = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('./pairing-algorithm.config') as {
      PairingAlgorithmConfig: new () => PairingAlgorithmConfigType;
    };
    return module.PairingAlgorithmConfig;
  };

  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values', () => {
    const PairingAlgorithmConfig = loadConfig();
    const config = new PairingAlgorithmConfig();

    expect(config.cronEnabled).toBe(true);
    expect(config.cronSchedule).toBe('0 0 * * 1');
    expect(config.defaultPeriodDays).toBe(21);
    expect(config.minPeriodDays).toBe(7);
    expect(config.maxPeriodDays).toBe(365);
  });

  it('should validate period constraints', () => {
    const PairingAlgorithmConfig = loadConfig();
    const config = new PairingAlgorithmConfig();

    expect(config.minPeriodDays).toBeLessThan(config.defaultPeriodDays);
    expect(config.defaultPeriodDays).toBeLessThan(config.maxPeriodDays);
  });
});
