import { handleApi } from './_lib/router.js';

// Both methods reach the handler, so a wrong one gets its 405 with an Allow header.
export const GET = handleApi;
export const POST = handleApi;
