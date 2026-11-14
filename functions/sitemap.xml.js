// Pages: /sitemap.xml gerado com o endereço real do site (no Worker, quem responde é worker/index.js).
import { seo } from '../worker/seo.js';

export const onRequestGet = ({ request, env }) => seo('/sitemap.xml', new URL(request.url), env, request);
