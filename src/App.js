import React, { useEffect, useRef, useState } from 'react';
import canvasTxt from 'canvas-txt';
import pixelmatch from 'pixelmatch';

import { toPx, clamp, renderDelay } from './helpers';

import './App.scss';

const DEFAULT_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

const ONE_FRAME = 1 / 60;
const TEN_FRAMES = 10 * ONE_FRAME;

canvasTxt.vAlign = 'top';
canvasTxt.align = 'left';
canvasTxt.justify = false;

const PIXELMATCH_OPTIONS = {
  threshold: 0.2,
  includeAA: true,
  diffMask: false,
};

const CANVAS_PADDING_X = 20;
const CANVAS_PADDING_Y = 20;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000;

const DEFAULT_FONT_WEIGHT = 400;
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_WORD_SPACING = 0;
const DEFAULT_WEBFONT_FAMILY = 'Georgia';
const DEFAULT_FALLBACK_FAMILY = 'Times New Roman';
const DEFAULT_FONT_SIZE = 20;
const DEFAULT_LINE_HEIGHT = 1.1;
const DEFAULT_TEXT_TRANSFORM = 'none';

const BG_COLOR_WHITE = '#fff';
const BG_COLOR_RED = '#ff0000';
const BG_COLOR_BLACK = '#000';
const BG_COLOR_FALLBACK = '#FFF9B3';
const BG_COLOR_WEBFONT = '#B3FFCB';

const INITIAL_LETTER_SPACING = toPx(DEFAULT_LETTER_SPACING);
const INITIAL_WORD_SPACING = toPx(DEFAULT_WORD_SPACING);

const CANVAS_FRAME_FULL = [0, 0, CANVAS_WIDTH, CANVAS_HEIGHT];

const CANVAS_FRAME_TEXT = [
  CANVAS_PADDING_X,
  CANVAS_PADDING_Y,
  CANVAS_WIDTH - CANVAS_PADDING_X * 2,
  CANVAS_HEIGHT - CANVAS_PADDING_Y * 2,
];

const getImageData = (canvas) => {
  const ctx1 = canvas.getContext('2d');
  return ctx1.getImageData(...CANVAS_FRAME_FULL).data;
};

const createEmptyDiff = (canvas) => {
  const diffCtx = canvas.getContext('2d');
  diffCtx.clearRect(...CANVAS_FRAME_FULL);
  return diffCtx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
};

const drawDiff = (canvas, data) => {
  const ctx = canvas.getContext('2d');
  ctx.putImageData(data, 0, 0);
};

const drawColoredRect = (canvas, color = BG_COLOR_WHITE) => {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(...CANVAS_FRAME_FULL);
  ctx.fillStyle = color;
  ctx.fillRect(...CANVAS_FRAME_FULL);
};

const draw = (
  canvas,
  txt,
  {
    fontFamily,
    fontSize,
    lineHeight,
    fontWeight = DEFAULT_FONT_WEIGHT,
    textTransform = DEFAULT_TEXT_TRANSFORM,
    letterSpacing = INITIAL_LETTER_SPACING,
    wordSpacing = INITIAL_WORD_SPACING,
  },
  bgColor,
) => {
  const transformedText = getTransformedText(txt, textTransform);
  const ctx = canvas.getContext('2d');
  drawColoredRect(canvas, bgColor);
  canvas.style.letterSpacing = letterSpacing;
  canvas.style.wordSpacing = wordSpacing;
  ctx.fillStyle = BG_COLOR_BLACK;
  canvasTxt.font = fontFamily;
  canvasTxt.fontWeight = Number(fontWeight);
  canvasTxt.fontSize = Number(fontSize);
  canvasTxt.lineHeight = Number(lineHeight) * Number(fontSize);
  canvasTxt.drawText(ctx, transformedText, ...CANVAS_FRAME_TEXT);
};

const getTransformedText = (txt, transformType) => {
  switch (transformType) {
    case 'uppercase':
      return txt.toUpperCase();
    case 'lowercase':
      return txt.toLowerCase();
    case 'none':
    default:
      return txt;
  }
};

const drawResult = (
  canvas,
  txt,
  originalFont,
  fallbackFont,
  {
    fontSize,
    lineHeight,
    fontWeight = DEFAULT_FONT_WEIGHT,
    wordSpacingOriginal = INITIAL_WORD_SPACING,
    letterSpacingOriginal = INITIAL_LETTER_SPACING,
    textTransform = DEFAULT_TEXT_TRANSFORM,
    letterSpacing = INITIAL_LETTER_SPACING,
    wordSpacing = INITIAL_WORD_SPACING,
  },
) => {
  const transformedText = getTransformedText(txt, textTransform);
  const ctx = canvas.getContext('2d');
  drawColoredRect(canvas, BG_COLOR_WHITE);
  ctx.fillStyle = BG_COLOR_BLACK;
  canvas.style.letterSpacing = letterSpacingOriginal;
  canvas.style.wordSpacing = wordSpacingOriginal;
  canvasTxt.fontWeight = Number(fontWeight);
  canvasTxt.font = originalFont;
  canvasTxt.fontSize = Number(fontSize);
  canvasTxt.lineHeight = Number(lineHeight) * Number(fontSize);
  canvasTxt.drawText(ctx, transformedText, ...CANVAS_FRAME_TEXT);

  canvas.style.letterSpacing = letterSpacing;
  canvas.style.wordSpacing = wordSpacing;
  ctx.fillStyle = BG_COLOR_RED;
  canvasTxt.font = fallbackFont;
  canvasTxt.fontWeight = Number(fontWeight);
  canvasTxt.fontSize = Number(fontSize);
  canvasTxt.lineHeight = Number(lineHeight) * Number(fontSize);
  canvasTxt.drawText(ctx, transformedText, ...CANVAS_FRAME_TEXT);
};

const drawFallbackWithSettings = (
  originalImage,
  fallbackRef,
  diffRef,
  text,
  textSettings,
  bgFallbackColor = BG_COLOR_FALLBACK,
) => {
  draw(fallbackRef.current, text, textSettings, bgFallbackColor);
  const fallbackImage = getImageData(fallbackRef.current);
  const diff = createEmptyDiff(diffRef.current);

  const result = pixelmatch(originalImage, fallbackImage, diff.data, CANVAS_WIDTH, CANVAS_HEIGHT, PIXELMATCH_OPTIONS);

  return [result, diff];
};

const uploadFontFace = (file, callback) => {
  const { name } = file;

  const [fontFaceName] = name.split('.');
  const url = URL.createObjectURL(file);

  const style = document.createElement('style');

  style.textContent = `
      @font-face {
        font-family: "${fontFaceName}";
        src: url(${JSON.stringify(url)});
      }
    `;

  document.head.appendChild(style);

  callback(fontFaceName);
};

const App = () => {
  const [webfontFamily, setWebfontFamily] = useState(DEFAULT_WEBFONT_FAMILY);
  const [fallbackFamily, setFallbackFamily] = useState(DEFAULT_FALLBACK_FAMILY);

  const [text, setText] = useState(DEFAULT_TEXT);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);
  const [fontWeight, setFontWeight] = useState(DEFAULT_FONT_WEIGHT);
  const [letterSpacing, setLetterSpacing] = useState(DEFAULT_LETTER_SPACING);
  const [wordSpacing, setWordSpacing] = useState(DEFAULT_WORD_SPACING);
  const [textTransform, setTextTransform] = useState(DEFAULT_TEXT_TRANSFORM);

  const drawAreaRef = useRef(null);
  const resultRef = useRef(null);
  const diffRef = useRef(null);
  const webfontRef = useRef(null);
  const fallbackRef = useRef(null);

  useEffect(() => {
    drawColoredRect(diffRef.current);
  }, []);

  useEffect(() => {
    draw(
      webfontRef.current,
      text,
      {
        fontFamily: webfontFamily,
        fontSize,
        fontWeight,
        lineHeight,
        wordSpacing: toPx(wordSpacing),
        letterSpacing: toPx(letterSpacing),
        textTransform,
      },
      BG_COLOR_WEBFONT,
    );
  }, [webfontFamily, fontSize, lineHeight, letterSpacing, wordSpacing, fontWeight, textTransform, text]);

  useEffect(() => {
    draw(
      fallbackRef.current,
      text,
      { fontFamily: fallbackFamily, fontSize, lineHeight, fontWeight, textTransform },
      BG_COLOR_FALLBACK,
    );
  }, [fallbackFamily, fontSize, lineHeight, textTransform, fontWeight, text]);

  const onMatch = async () => {
    let progress = 0;
    drawAreaRef.current.style.display = 'block';
    diffRef.current.style.opacity = 1;

    drawColoredRect(webfontRef.current);
    const basicFontSettings = { fontSize, lineHeight, fontWeight };
    const fallbackFontSettings = { ...basicFontSettings, fontFamily: fallbackFamily };
    const webFontSettings = {
      ...basicFontSettings,
      fontFamily: webfontFamily,
      letterSpacing: toPx(letterSpacing),
      wordSpacing: toPx(wordSpacing),
    };

    draw(webfontRef.current, getTransformedText(text, textTransform), webFontSettings, BG_COLOR_WEBFONT);
    const originalImage = getImageData(webfontRef.current);

    const LETTER_SPACING_BOUNDARIES = Number(fontSize) * 0.2;

    const lsFrom = -LETTER_SPACING_BOUNDARIES;
    const lsTo = LETTER_SPACING_BOUNDARIES;

    const WORD_SPACING_BOUNDARIES = Number(fontSize) * 0.2;

    const wsFrom = -WORD_SPACING_BOUNDARIES;
    const wsTo = WORD_SPACING_BOUNDARIES;

    const anchorStepSize = 0.01;
    let currentStepSizeX = (lsTo - lsFrom) / 10;
    let currentStepSizeY = (wsTo - wsFrom) / 10;

    let current = { x: 0, y: 0 };
    while (currentStepSizeX > anchorStepSize && currentStepSizeY > anchorStepSize) {
      const arr = [
        { x: current.x, y: current.y - currentStepSizeY },
        { x: current.x - currentStepSizeX, y: current.y },
        { x: current.x, y: current.y },
        { x: current.x + currentStepSizeX, y: current.y },
        { x: current.x, y: current.y + currentStepSizeY },
      ].map(({ x, y }) => ({
        x: Math.round(clamp(x, lsFrom, lsTo) * 100) / 100,
        y: Math.round(clamp(y, wsFrom, wsTo) * 100) / 100,
      }));

      const [res, diff] = arr
        .map(({ x, y }) =>
          drawFallbackWithSettings(originalImage, fallbackRef, diffRef, getTransformedText(text, textTransform), {
            ...fallbackFontSettings,
            letterSpacing: toPx(x),
            wordSpacing: toPx(y),
          }),
        )
        .reduce(
          (acc, curr) => [
            [...acc[0], curr[0]],
            [...acc[1], curr[1]],
          ],
          [[], []],
        );

      const localMin = Math.min(...res);

      const localMinIndex = res.indexOf(localMin);

      const nextMin = arr[localMinIndex];

      if (current !== nextMin) {
        drawDiff(diffRef.current, diff[localMinIndex]);
        resultRef.current.innerText = `In Progress: Minimization Round ${progress}\n${JSON.stringify({
          letterSpacing: toPx(nextMin.x),
          wordSpacing: toPx(nextMin.y),
        })}`;
        await renderDelay(TEN_FRAMES);
      }

      current = nextMin;
      progress++;

      currentStepSizeX *= Math.pow(0.999, progress);
      currentStepSizeY *= Math.pow(0.999, progress);
    }

    const { x, y } = current;

    drawResult(diffRef.current, getTransformedText(text, textTransform), webfontFamily, fallbackFamily, {
      ...basicFontSettings,
      letterSpacingOriginal: toPx(letterSpacing),
      wordSpacingOriginal: toPx(wordSpacing),
      letterSpacing: toPx(x),
      wordSpacing: toPx(y),
    });

    resultRef.current.innerText = `Done on Minimization Round ${progress}\n${JSON.stringify({
      letterSpacing: toPx(x),
      wordSpacing: toPx(y),
    })}`;
  };

  const onChange = (changeHandler, { target: { value } }) => {
    changeHandler(() => value);
  };

  return (
    <div className="App">
      <header className="header">
        <h1 className="headline">Auto Font Matcher</h1>
        <p>
          <em>* only tested in Chrome</em>
        </p>
      </header>
      <main className="content">
        <div className="config mb-4">
          <div className="row mb-4">
            <div className="config-field col-6">
              <label htmlFor="font-size" className="form-label">
                Font Size
                <sup>
                  <em>(px)</em>
                </sup>
              </label>
              <input
                onBlur={onChange.bind(null, setFontSize)}
                className="form-control"
                id="font-size"
                type="number"
                step="1"
                defaultValue={DEFAULT_FONT_SIZE}
              />
            </div>
            <div className="config-field col-6">
              <label htmlFor="line-height" className="form-label">
                Line Height
                <sup>
                  <em>(unitless, relative)</em>
                </sup>
              </label>
              <input
                onBlur={onChange.bind(null, setLineHeight)}
                className="form-control"
                id="line-height"
                type="number"
                step="0.01"
                defaultValue={DEFAULT_LINE_HEIGHT}
              />
            </div>
          </div>
          <div className="row mb-4">
            <div className="config-field col-6">
              <label htmlFor="font-weight" className="form-label">
                Font Weight
              </label>
              <select
                onChange={onChange.bind(null, setFontWeight)}
                className="form-control form-select"
                id="font-weight"
                defaultValue={DEFAULT_FONT_WEIGHT}
              >
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="700">700</option>
                <option value="800">800</option>
                <option value="900">900</option>
              </select>
            </div>
            <div className="config-field col-6">
              <label htmlFor="text-transform" className="form-label">
                Text Transform
              </label>
              <select
                onChange={onChange.bind(null, setTextTransform)}
                className="form-control form-select"
                id="text-transform"
                defaultValue={DEFAULT_TEXT_TRANSFORM}
              >
                <option value="none">None</option>
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
              </select>
            </div>
          </div>
          <div className="row mb-4">
            <div className="config-field col-6">
              <label htmlFor="letter-spacing" className="form-label">
                Letter Spacing
                <sup>
                  <em>(px, webfont only)</em>
                </sup>
              </label>
              <input
                onBlur={onChange.bind(null, setLetterSpacing)}
                className="form-control"
                id="letter-spacing"
                type="number"
                step="0.01"
                defaultValue={DEFAULT_LETTER_SPACING}
              />
            </div>
            <div className="config-field col-6">
              <label htmlFor="word-spacing" className="form-label">
                Word Spacing
                <sup>
                  <em>(px, webfont only)</em>
                </sup>
              </label>
              <input
                onBlur={onChange.bind(null, setWordSpacing)}
                className="form-control"
                id="word-spacing"
                type="number"
                step="0.01"
                defaultValue={DEFAULT_WORD_SPACING}
              />
            </div>
          </div>
          <div className="config-field col-12">
            <label className="form-label" htmlFor="font-text">
              Text
            </label>
            <textarea
              onBlur={onChange.bind(null, setText)}
              className="form-control text"
              id="font-text"
              defaultValue={DEFAULT_TEXT}
            />
          </div>
          <hr className="my-4" />
          <div className="row mb-4">
            <div className="config-field col-6">
              <label htmlFor="font-webfont" className="form-label">
                Webfont Family
              </label>
              <div className="input-group">
                <input
                  style={{ fontFamily: webfontFamily }}
                  className="form-control"
                  id="font-webfont"
                  type="text"
                  value={webfontFamily}
                  onChange={onChange.bind(null, setWebfontFamily)}
                  onBlur={onChange.bind(null, setWebfontFamily)}
                />
                <label htmlFor="uploadFont" className="input-group-text upload-icon btn-primary">
                  <input
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,.svg"
                    className="uploadFont"
                    onChange={(e) => {
                      if (e.target.files) {
                        const [file] = e.target.files;
                        if (file) {
                          uploadFontFace(file, setWebfontFamily);
                        }
                      }
                    }}
                    id="uploadFont"
                  />
                  <span>&#8683;</span>
                </label>
              </div>
            </div>
            <div className="config-field col-6">
              <label htmlFor="font-fallback" className="form-label">
                Fallback Family
              </label>
              <input
                style={{ fontFamily: fallbackFamily }}
                className="form-control"
                id="font-fallback"
                type="text"
                defaultValue={DEFAULT_FALLBACK_FAMILY}
                onBlur={onChange.bind(null, setFallbackFamily)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={onMatch}>
            Start Auto Match
          </button>
        </div>
        <div className="result mb-4" ref={resultRef} />
        <div ref={drawAreaRef} className="drawArea">
          <canvas ref={webfontRef} className="canvas" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} id="webfont" />
          <canvas ref={fallbackRef} className="canvas" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} id="fallback" />
          <canvas ref={diffRef} className="canvas" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} id="diff" />
        </div>
      </main>
      <footer className="footer">
        <p>
          Developed by{' '}
          <a href="https://github.com/dazlious" target="_new">
            dazlious
          </a>
          {' – '}
          thanks to contribution from {''}
          <a href="https://github.com/apfelfabrik" target="_new">
            apfelfabrik
          </a>
        </p>
        <p>
          Inspired by{' '}
          <a href="https://meowni.ca/font-style-matcher/" target="_new">
            https://meowni.ca/font-style-matcher/
          </a>
        </p>
        <a href="https://github.com/dazlious/font-matcher" target="_new">
          Visit this on Github, although the code is quite messy
        </a>
        😎
      </footer>
    </div>
  );
};

export default App;
