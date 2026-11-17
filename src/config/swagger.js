import {readFile} from 'node:fs/promises';
import config from './index.js';
const spec=JSON.parse(await readFile(new URL('../docs/openapi.json',import.meta.url),'utf8'));
spec.servers=[{url:config.apiBaseUrl}];
export default spec;
