/**
 * The back end this build talks to. Every value comes from the build
 * environment (VITE_*), so a clone or fork ships with none: the game then
 * runs on the records kept on the device, sends no scores and no beacons,
 * and the stats page says the data is away.
 *
 * Where the live values are:
 *   - GitHub Pages: repository variables, read by .github/workflows/deploy.yml.
 *     Forks do not inherit them.
 *   - This machine (make portal, make shots): .env.local, gitignored, written
 *     by `make env` from the Terraform outputs in infra/.
 */
const env = import.meta.env;

/** Base URL of the records API (infra/records.tf). */
export const RECORDS_API: string = env.VITE_RECORDS_API ?? '';
/** The cached leaderboard, GET /board through CloudFront. */
export const BOARD_URL: string = env.VITE_BOARD_URL ?? '';
/** The analytics rollup the ?stats page reads. */
export const STATS_URL: string = env.VITE_STATS_URL ?? '';

/** Global records exist only when the build names a back end. */
export const RECORDS_ON = RECORDS_API !== '' && BOARD_URL !== '';
