import { serveUpload } from '../../lib/api.js';
export const onRequestGet = (context) => serveUpload(context);
