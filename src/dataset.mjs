import path from "path";

import log from "loglevel";
import { renderPicture } from "astro-imagetools/api";
import sizeOf from "image-size";

import { memeMediaFolder } from "./config.mjs";
import {
  fetchMemes,
  fetchMetadataHierarchies,
  fetchFile,
  purgeFiles,
} from "./fetch-data.mjs";

log.setLevel(log.levels[process.env.LOG_LEVEL || "INFO"]);

const getAspectRatio = (imgPath) => {
  const dimensions = sizeOf(imgPath);
  return dimensions.width / dimensions.height;
};

// Given a <picture/> element as an HTML string (as returned by renderPicture),
// extract the srcset attribute values and return an object of the form
// { <ext>: <srcset>, ... }
const getSrcsetFromPicture = (picture) =>
  Object.fromEntries(
    [...picture.matchAll(/srcset="(?<s>[^"]*?)"/g)].map((s) => [
      s[1].match(/(?<=\.)[^\s.]+(?=\s|$)/)[0],
      s.groups.s,
    ]),
  );

const generateImages = async (meme) => {
  const { picture } = await renderPicture({
    src: "/src/../meme_media/" + meme.filename,
    format: "webp",
    fallbackFormat: false,
    includeSourceFormat: false,
    alt: meme.title,
    placeholder: "none",
    includeSourceFormat: false,
  });
  const srcsets = getSrcsetFromPicture(picture);
  return srcsets;
};

// fetch minimally-parsed data from the spreadsheet(s)
let start = performance.now();
log.info(" --> Fetching data from Google Sheets...");
let memes = await fetchMemes();
let metadataHierarchies = await fetchMetadataHierarchies();
log.info(`     ... completed in ${(performance.now() - start).toFixed(0)}ms.`);

// parse some of the metadata values and sort by date
memes = memes
  .map((meme) => ({
    ...meme,
    memeTypes: meme.memeContentType.split(", ").map((type) => type.trim()),
    people: meme.peopleIndividuals.split(", ").map((person) => person.trim()),
    templateTypes: meme.memeTemplateType.split(", ").map((type) => type.trim()),
    languages: meme.language.split(", ").map((language) => language.trim()),
    countries: meme.country.split(", ").map((country) => country.trim()),
    timestamp: new Date(meme.timestamp),
  }))
  .sort((a, b) => b.timestamp - a.timestamp);

// ensure all media files are available locally
start = performance.now();
let downloadedCount = 0;
let skippedCount = 0;
log.info(" --> Fetching needed media files from Google Drive...");
for (const meme of memes) {
  const [filename, downloaded] = await fetchFile(meme, memeMediaFolder);
  meme.filename = filename;
  if (downloaded) {
    downloadedCount++;
  } else {
    skippedCount++;
  }
}
log.info(
  `     ... completed in ${(performance.now() - start).toFixed(
    0,
  )}ms -- ${skippedCount} file(s) already available locally, ${downloadedCount} file(s) downloaded.`,
);

purgeFiles(memes, memeMediaFolder);

// filter out non-image files
// note: may prove to be inadequate (if other image types are submitted)
// note: must be done after files are fetched, as we don't know file types / extensions
//  until after they are downloaded
memes = memes.filter((meme) =>
  meme.filename.match(/\.jpg|\.jpeg|\.png|\.webp$/i),
);

// parse the images and calculate aspect ratios
for (const meme of memes) {
  const filepath = path.join(memeMediaFolder, meme.filename);
  meme.aspectRatio = getAspectRatio(filepath);
  meme.srcSets = await generateImages(meme);
}

// Prepare facets and facet counts
const memeTypes = [
  ...new Set(
    memes
      .map((meme) => meme.memeTypes)
      .flat()
      .filter((x) => x),
  ),
]
  .map((memeType) => ({
    value: memeType,
    count: memes.filter((meme) => meme.memeTypes.includes(memeType)).length,
    group:
      Object.entries(metadataHierarchies.memeTypes).find(([group, memeTypes]) =>
        memeTypes.includes(memeType),
      )?.[0] || "Other",
  }))
  .sort((a, b) =>
    a.value
      .replace(/^["“'‘]+/, "")
      .localeCompare(b.value.replace(/^["“'‘]+/, "")),
  );

const people = [
  ...new Set(
    memes
      .map((meme) => meme.people)
      .flat()
      .filter((x) => x),
  ),
]
  .map((person) => ({
    value: person,
    count: memes.filter((meme) => meme.people.includes(person)).length,
  }))
  .sort((a, b) => a.value.localeCompare(b.value));

const languages = [
  ...new Set(
    memes
      .map((meme) => meme.languages)
      .flat()
      .filter((x) => x),
  ),
]
  .map((language) => ({
    value: language,
    count: memes.filter((meme) => meme.languages.includes(language)).length,
  }))
  .sort((a, b) => a.value.localeCompare(b.value));

const countries = [
  ...new Set(
    memes
      .map((meme) => meme.countries)
      .flat()
      .filter((x) => x),
  ),
]
  .map((country) => ({
    value: country,
    count: memes.filter((meme) => meme.countries.includes(country)).length,
  }))
  .sort((a, b) => a.value.localeCompare(b.value));

const templateTypes = [
  ...new Set(
    memes
      .map((meme) => meme.templateTypes)
      .flat()
      .filter((x) => x && x !== "Other"),
  ),
]
  .map((templateType) => ({
    value: templateType,
    count: memes.filter((meme) => meme.templateTypes.includes(templateType))
      .length,
    group:
      Object.entries(metadataHierarchies.templateTypes).find(
        ([group, templateTypes]) => templateTypes.includes(templateType),
      )?.[0] || "Other",
  }))
  .sort((a, b) => a.value.localeCompare(b.value));

const groupOrders = Object.fromEntries(
  Object.entries(metadataHierarchies).map(([key, value]) => [
    key,
    Object.keys(value),
  ]),
);

export {
  memes,
  memeTypes,
  people,
  languages,
  countries,
  templateTypes,
  groupOrders,
};

// If called as a node script, print memes to stdout.
// See `yarn print-dataset`  (requires node >= v17.5.0)
import { fileURLToPath } from "url";
const nodePath = path.resolve(process.argv[1]);
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (nodePath === modulePath) {
  switch (process.argv[2]) {
    case "memeTypes":
      log.info(memeTypes);
      break;

    case "people":
      log.info(people);
      break;

    case "countries":
      log.info(countries);
      break;

    case "templateTypes":
      log.info(templateTypes);
      break;

    case "languages":
      log.info(languages);
      break;

    default:
      log.info(JSON.stringify(memes, null, 2));
  }
}
