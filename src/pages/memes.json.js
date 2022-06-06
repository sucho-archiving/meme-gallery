import { memes as rawData } from "../dataset.mjs";

const memes = rawData.map((meme) => ({
  title: meme.title,
  textTranslatedIntoEnglish: meme.textTranslatedIntoEnglish,
  mediaPath: meme.mediaPath,
  mediaAspectRatio: meme.mediaAspectRatio,
  memeTypes: meme.memeTypes,
}));

export async function get() {
  return {
    body: JSON.stringify(memes),
  };
}
