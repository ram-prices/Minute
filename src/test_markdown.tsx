import React from 'react';
import { renderToString } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const html = renderToString(
  <Markdown remarkPlugins={[remarkGfm]}>
    https://media.giphy.com/media/6HwEvs7F0blBi/100.gif
  </Markdown>
);
console.log(html);
