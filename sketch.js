let capture;
let pixelGrid = [];
let densitySlider, ratioSlider, sizeSlider;
let relationSlider, contrastSlider, modeSelect;
let lastCols = -1;
let lastRows = -1;

// Character sets for the text-based modes, ordered dark to bright.
const CHARSETS = {
  text: " .:-=+*#%@",
  blocks: " ░▒▓█",
  binary: "01"
};

// Four-tone handheld-console palette, dark to bright.
const GAMEBOY = [
  [15, 56, 15],
  [48, 98, 48],
  [139, 172, 15],
  [155, 188, 15]
];

function setup() {
  createCanvas(640, 480).parent("canvas-container");
  pixelDensity(1);
  frameRate(15);

  // Keep the video resolution fixed; the display grid is adjusted independently.
  capture = createCapture({ video: true, audio: false });
  capture.size(160, 120);
  capture.hide();
  const video = capture.elt;
  video.addEventListener("loadeddata", () => {
    document.getElementById("status").textContent = "Camera connected.";
  });

  textFont("monospace");
  textAlign(CENTER, CENTER);
  rectMode(CENTER);
  noStroke();

  densitySlider = addSlider("Pixel density (columns)", 20, 100, 64, 1);
  ratioSlider = addSlider("Cell aspect ratio", 0.5, 2, 1, 0.05);
  sizeSlider = addSlider("Character / shape size", 0.3, 1.8, 1, 0.05);
  relationSlider = addSlider("Brightness affects size", 0, 1, 0.5, 0.05);
  contrastSlider = addSlider("Contrast", 0.5, 3, 1.4, 0.1);

  const row = createDiv().class("control").parent("controls");
  createElement("label", "Pixel style").attribute("for", "pixel-mode").parent(row);
  modeSelect = createSelect().id("pixel-mode").parent(row);
  modeSelect.option("ASCII text", "text");
  modeSelect.option("Block characters", "blocks");
  modeSelect.option("Binary 0 / 1", "binary");
  modeSelect.option("Squares", "rect");
  modeSelect.option("Circles", "circle");
  modeSelect.option("Rings", "ring");
  modeSelect.option("Diamonds", "diamond");
  modeSelect.option("Crosses", "cross");
  modeSelect.option("Triangles", "triangle");
  modeSelect.option("Diagonal lines", "line");
  modeSelect.option("Halftone (B&W)", "halftone");
  modeSelect.option("Game Boy palette", "gameboy");
}

// Create a slider with a label that shows its live value.
function addSlider(name, minimum, maximum, initial, step) {
  const row = createDiv().class("control").parent("controls");
  const id = "slider-" + document.querySelectorAll('input[type="range"]').length;
  const label = createElement("label").attribute("for", id).parent(row);
  const slider = createSlider(minimum, maximum, initial, step).id(id).parent(row);
  const updateLabel = () => label.html(name + ": " + slider.value());
  slider.input(updateLabel);
  updateLabel();
  return slider;
}

function rebuildGrid(cols, rows) {
  pixelGrid = [];
  // Nested loop: create one object per row and column, rebuilt only when the grid changes.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      pixelGrid.push(new CustomPixel(x, y, cols, rows));
    }
  }
  lastCols = cols;
  lastRows = rows;
}

function draw() {
  background(15);
  const cols = Number(densitySlider.value());
  const ratio = Number(ratioSlider.value());
  const rows = max(1, round(height / ((width / cols) / ratio)));
  if (cols !== lastCols || rows !== lastRows) rebuildGrid(cols, rows);

  // loadPixels gives direct access to the current video frame's RGBA array.
  capture.loadPixels();
  const expected = capture.width * capture.height * 4;
  if (expected === 0 || capture.pixels.length < expected) return;

  const settings = {
    size: Number(sizeSlider.value()),
    relation: Number(relationSlider.value()),
    contrast: Number(contrastSlider.value()),
    mode: modeSelect.value()
  };
  for (const pixel of pixelGrid) pixel.display(settings);
}

// Each instance represents one cell: it samples a color and draws a shape.
class CustomPixel {
  constructor(gridX, gridY, cols, rows) {
    this.u = (gridX + 0.5) / cols;
    this.v = (gridY + 0.5) / rows;
    this.w = width / cols;
    this.h = height / rows;
    // Mirror only the position, not the characters themselves.
    this.x = width * (1 - this.u);
    this.y = height * this.v;
  }

  display(settings) {
    const videoX = floor(this.u * capture.width);
    const videoY = floor(this.v * capture.height);
    // Each pixel holds four values: red, green, blue and alpha.
    const index = (videoY * capture.width + videoX) * 4;
    const r = capture.pixels[index];
    const g = capture.pixels[index + 1];
    const b = capture.pixels[index + 2];
    let light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    light = constrain((light - 128) * settings.contrast + 128, 0, 255);

    // Interpolate between a uniform size and a brightness-driven size.
    const brightnessScale = map(light, 0, 255, 0.15, 1);
    const sizeFactor = settings.size * lerp(1, brightnessScale, settings.relation);
    const w = this.w * sizeFactor;
    const h = this.h * sizeFactor;
    fill(r, g, b);

    push();
    translate(this.x, this.y);
    switch (settings.mode) {
      case "text":
      case "blocks":
      case "binary": {
        const chars = CHARSETS[settings.mode];
        const charIndex = floor(map(light, 0, 255, 0, chars.length - 1));
        scale(this.w / this.h, 1);
        textSize(this.h * 1.15 * sizeFactor);
        text(chars[charIndex], 0, 0);
        break;
      }
      case "rect":
        rect(0, 0, w, h);
        break;
      case "circle":
        ellipse(0, 0, w, h);
        break;
      case "ring":
        noFill();
        stroke(r, g, b);
        strokeWeight(max(1, min(this.w, this.h) * 0.15));
        ellipse(0, 0, w * 0.8, h * 0.8);
        noStroke();
        break;
      case "diamond":
        quad(0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0);
        break;
      case "cross": {
        const t = max(1, min(w, h) * 0.25);
        rect(0, 0, w, t);
        rect(0, 0, t, h);
        break;
      }
      case "triangle":
        // Brightness flips the triangle: dark points down, bright points up.
        if (light < 128) scale(1, -1);
        triangle(-w / 2, h / 2, w / 2, h / 2, 0, -h / 2);
        break;
      case "halftone": {
        // Classic print look: white dots that grow with brightness, ignoring color.
        const d = min(this.w, this.h) * settings.size * map(light, 0, 255, 0, 1.3);
        fill(240);
        ellipse(0, 0, d, d);
        break;
      }
      case "gameboy": {
        // Snap brightness to one of four palette tones.
        const tone = GAMEBOY[min(3, floor(light / 64))];
        fill(tone[0], tone[1], tone[2]);
        rect(0, 0, w, h);
        break;
      }
      default:
        // Brightness also changes the direction of the diagonal line.
        rotate(map(light, 0, 255, -PI / 2, PI / 2));
        rect(0, 0, w, max(1, this.h * 0.12 * sizeFactor));
    }
    pop();
  }
}
