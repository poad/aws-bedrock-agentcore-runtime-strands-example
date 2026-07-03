import { config } from '@dotenvx/dotenvx';

export const configureDotenvX = () => {
  config({ path: ['.env', '.env.test'], override: true, ignore: ['MISSING_ENV_FILE'] });
};