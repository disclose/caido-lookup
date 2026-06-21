import type { Caido } from "@caido/sdk-frontend";

import type { API } from "caido-lookup-backend";

/**
 * The Caido frontend SDK, typed with this plugin's backend API so that
 * `sdk.backend.lookup(input)` is fully typed and returns a Promise.
 */
export type CaidoSDK = Caido<API>;
