import React from 'react';
import { renderToString } from 'react-dom/server';

const html = renderToString(
  <img src="https://media.giphy.com/media/6HwEvs7F0blBi/100.gif" referrerPolicy="no-referrer" />
);
console.log(html);
