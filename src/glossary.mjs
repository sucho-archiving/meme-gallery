import log from "loglevel";

import { fetchDocument } from "./fetch-data.mjs";
import {
  contentTypeGlossaryDocId,
  templateTypeGlossaryDocId,
} from "./config.mjs";
import { parseGlossaryDoc } from "./parse-glossary-docs.mjs";

let start = performance.now();
log.info(" --> Fetching and parsing data from Google Docs...");

const contentTypeHtml = await fetchDocument(contentTypeGlossaryDocId);
export const contentTypeGlossary = parseGlossaryDoc(contentTypeHtml);

const templateTypeHtml = await fetchDocument(templateTypeGlossaryDocId);
export const templateTypeGlossary = parseGlossaryDoc(templateTypeHtml);

log.info(`     ... completed in ${(performance.now() - start).toFixed(0)}ms.`);
